import { createSystemPrompt } from "../model/system-prompt.js";
import { createFinalReportRepairPrompt, validateFinalReport } from "./final-report.js";
import { parsePromptTarget } from "./prompt-target.js";
import { classifyRegistrationPrompt } from "./registration-classifier.js";

type Message = { role: "system" | "user" | "assistant" | "tool"; content: string; name?: string };
type ModelResult = { type: "message"; content: string } | { type: "tool-call"; toolName: string; args: unknown };
type ToolSafety = "read-only" | "state-changing" | "destructive";

export interface OrchestratorDeps {
  model: { complete(request: { messages: Message[]; tools: unknown[] }): Promise<ModelResult> };
  serverStore: { load(alias: string): Promise<unknown>; list(): Promise<string[]> };
  memoryStore: { loadGlobal(): Promise<string>; loadServer(alias: string): Promise<string> };
  policy: {
    decide(request: { toolName: string; safety: ToolSafety; targetAlias: string }): {
      allowed: boolean;
      requiresApproval: boolean;
      reason: string;
    };
    modelContext(targetAlias?: string): string;
  };
  toolRegistry: {
    get(name: string): {
      name: string;
      safety: ToolSafety;
      validateArgs(input: unknown): unknown;
      execute(args: unknown, context: { targetAlias: string }): Promise<unknown>;
    };
  };
  approvals: { approve(message: string): Promise<boolean> };
  sessionLog: { write(event: Record<string, unknown> & { type: string }): Promise<void> };
  registration: { run(alias: string): Promise<void> };
  render: { status(text: string): void; tool(text: string): void; report(text: string): void; error(text: string): void };
}

export function createOrchestrator(deps: OrchestratorDeps) {
  return {
    async handlePrompt(rawPrompt: string): Promise<void> {
      const registration = classifyRegistrationPrompt(rawPrompt);
      if (registration.matched) {
        await deps.registration.run(registration.alias);
        return;
      }

      const parsed = parsePromptTarget(rawPrompt);
      if (!parsed.targetAlias) {
        deps.render.error("Choose a server with /alias or register one with: add remote server name <alias>");
        return;
      }

      deps.render.status("Thinking: identify the right tool");
      try {
        await deps.serverStore.load(parsed.targetAlias);
      } catch {
        const aliases = await deps.serverStore.list();
        const suffix = aliases.length > 0 ? ` Available aliases: ${aliases.join(", ")}` : " No servers are registered yet.";
        deps.render.error(`Unknown server alias: ${parsed.targetAlias}.${suffix}`);
        await deps.sessionLog.write({ type: "unknown-server", targetAlias: parsed.targetAlias, availableAliases: aliases });
        return;
      }

      const memory = [await deps.memoryStore.loadGlobal(), await deps.memoryStore.loadServer(parsed.targetAlias)]
        .filter(Boolean)
        .join("\n");
      const messages: Message[] = [
        { role: "system", content: createSystemPrompt() },
        { role: "system", content: deps.policy.modelContext(parsed.targetAlias) },
        { role: "system", content: memory },
        { role: "user", content: parsed.prompt },
      ];

      const first = await deps.model.complete({ messages, tools: [] });
      if (first.type === "message") {
        deps.render.report(first.content);
        return;
      }

      const tool = deps.toolRegistry.get(first.toolName);
      const args = tool.validateArgs(first.args);
      const decision = deps.policy.decide({ toolName: tool.name, safety: tool.safety, targetAlias: parsed.targetAlias });
      if (!decision.allowed) {
        deps.render.error(decision.reason);
        await deps.sessionLog.write({ type: "policy-denial", toolName: tool.name, reason: decision.reason });
        return;
      }
      if (decision.requiresApproval) {
        const approved = await deps.approvals.approve(`Approval required: ${tool.name} on ${parsed.targetAlias}`);
        if (!approved) {
          deps.render.report(
            "Summary\nExecution was skipped.\nEvidence\nThe operator declined approval.\nConclusion\nNo changes were made.\nNext Actions\nUse read-only checks or approve the action when ready.",
          );
          return;
        }
      }

      deps.render.tool(`Tool: ${tool.name}\nTarget: ${parsed.targetAlias}`);
      const result = await tool.execute(args, { targetAlias: parsed.targetAlias });
      await deps.sessionLog.write({ type: "tool-result", toolName: tool.name, result });
      const final = await deps.model.complete({
        messages: [...messages, { role: "tool", name: tool.name, content: JSON.stringify(result) }],
        tools: [],
      });

      if (final.type === "tool-call") {
        deps.render.error("Model requested another tool after result; run a new prompt for additional checks.");
        return;
      }

      const validation = validateFinalReport(final.content);
      if (validation.ok) {
        deps.render.report(final.content);
        return;
      }

      const repaired = await deps.model.complete({
        messages: [...messages, { role: "assistant", content: createFinalReportRepairPrompt(final.content, validation.missingSections) }],
        tools: [],
      });
      deps.render.report(repaired.type === "message" ? repaired.content : final.content);
    },
  };
}
