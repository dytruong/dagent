import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import type { PolicyDecision, ToolSafety } from "../types.js";

export interface PolicyRequest {
  toolName: string;
  safety: ToolSafety;
  targetAlias: string;
}

export interface PolicyEngine {
  decide(request: PolicyRequest): PolicyDecision;
  modelContext(targetAlias?: string): string;
}

interface ToolRules {
  deniedTools?: string[];
  approvalRequiredTools?: string[];
}

export async function createPolicyEngine(root = process.cwd()): Promise<PolicyEngine> {
  let toolRules: ToolRules = {};
  let globalRules = "";
  const serverRules = new Map<string, string>();

  try {
    const text = await readFile(join(root, "rules", "tools.yaml"), "utf8");
    toolRules = YAML.parse(text) ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  try {
    globalRules = await readFile(join(root, "rules", "global.md"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  try {
    const entries = await readdir(join(root, "rules", "servers"));
    for (const entry of entries.filter((name) => name.endsWith(".md"))) {
      serverRules.set(entry.slice(0, -".md".length), await readFile(join(root, "rules", "servers", entry), "utf8"));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return {
    decide(request): PolicyDecision {
      if (toolRules.deniedTools?.includes(request.toolName)) {
        return { allowed: false, requiresApproval: false, reason: `Tool ${request.toolName} is denied by local policy` };
      }
      if (request.safety === "destructive") {
        return { allowed: false, requiresApproval: false, reason: "Destructive tools are blocked in version 1" };
      }
      if (request.safety === "state-changing" || toolRules.approvalRequiredTools?.includes(request.toolName)) {
        return { allowed: true, requiresApproval: true, reason: "State-changing tool requires approval" };
      }
      return { allowed: true, requiresApproval: false, reason: "Read-only tool allowed by default" };
    },
    modelContext(targetAlias?: string): string {
      return [globalRules, targetAlias ? serverRules.get(targetAlias) : undefined].filter(Boolean).join("\n");
    },
  };
}
