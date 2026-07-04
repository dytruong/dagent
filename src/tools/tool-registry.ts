import { z } from "zod";
import type { ToolResult, ToolSafety } from "../types.js";

export interface ToolContext {
  targetAlias: string;
}

export interface RegisteredTool<TArgs> {
  name: string;
  description: string;
  safety: ToolSafety;
  validateArgs(input: unknown): TArgs;
  execute(args: TArgs, context: ToolContext): Promise<ToolResult>;
}

export type AnyRegisteredTool = RegisteredTool<unknown>;

const systemdLogsSchema = z.object({
  server: z.string().min(1),
  unit: z.string().regex(/^[a-zA-Z0-9_.@-]+\.service$/).optional(),
  since: z.string().min(1).default("10 minutes ago"),
  lines: z.number().int().min(1).max(1000).default(300),
});

const systemdStatusSchema = z.object({
  server: z.string().min(1),
  unit: z.string().regex(/^[a-zA-Z0-9_.@-]+\.service$/),
});

const diskUsageSchema = z.object({
  server: z.string().min(1),
  path: z.string().regex(/^\/[a-zA-Z0-9/._-]*$/).default("/"),
});

const processListSchema = z.object({
  server: z.string().min(1),
  filter: z.string().regex(/^[a-zA-Z0-9_.@:-]+$/).optional(),
});

function unavailableTool<TArgs>(
  name: string,
  description: string,
  safety: ToolSafety,
  schema: z.ZodType<TArgs>,
): RegisteredTool<TArgs> {
  return {
    name,
    description,
    safety,
    validateArgs: (input) => schema.parse(input),
    async execute(): Promise<ToolResult> {
      throw new Error(`Tool ${name} has no executor bound`);
    },
  };
}

export function createToolRegistry(overrides: AnyRegisteredTool[]) {
  const tools = new Map<string, AnyRegisteredTool>();
  for (const tool of [
    unavailableTool("systemd.logs", "Read journal logs for a service or system", "read-only", systemdLogsSchema),
    unavailableTool("systemd.status", "Read systemd service status", "read-only", systemdStatusSchema),
    unavailableTool("disk.usage", "Inspect disk usage", "read-only", diskUsageSchema),
    unavailableTool("process.list", "List processes", "read-only", processListSchema),
    ...overrides,
  ]) {
    tools.set(tool.name, tool as AnyRegisteredTool);
  }

  return {
    list(): AnyRegisteredTool[] {
      return [...tools.values()];
    },
    get(name: string): AnyRegisteredTool {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return tool;
    },
  };
}
