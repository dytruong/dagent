import { z } from "zod";
import type { ToolResult } from "../../types.js";
import type { RegisteredTool, ToolContext } from "../tool-registry.js";

interface Runner {
  run(alias: string, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const logsSchema = z.object({
  server: z.string(),
  unit: z.string().optional(),
  since: z.string(),
  lines: z.number(),
});

const statusSchema = z.object({
  server: z.string(),
  unit: z.string(),
});

function toToolResult(
  toolName: string,
  targetAlias: string,
  result: { exitCode: number; stdout: string; stderr: string },
): ToolResult {
  const now = new Date().toISOString();
  return { toolName, targetAlias, startedAt: now, finishedAt: now, ...result };
}

export function createSystemdLogsTool(runner: Runner): RegisteredTool<z.infer<typeof logsSchema>> {
  return {
    name: "systemd.logs",
    description: "Read journal logs for a service or system",
    safety: "read-only",
    validateArgs: (input) => logsSchema.parse(input),
    async execute(args, context: ToolContext) {
      const argv = ["journalctl"];
      if (args.unit) argv.push("-u", args.unit);
      argv.push("--since", args.since, "-n", String(args.lines), "--no-pager");
      return toToolResult("systemd.logs", context.targetAlias, await runner.run(context.targetAlias, argv));
    },
  };
}

export function createSystemdStatusTool(runner: Runner): RegisteredTool<z.infer<typeof statusSchema>> {
  return {
    name: "systemd.status",
    description: "Read systemd service status",
    safety: "read-only",
    validateArgs: (input) => statusSchema.parse(input),
    async execute(args, context) {
      return toToolResult(
        "systemd.status",
        context.targetAlias,
        await runner.run(context.targetAlias, ["systemctl", "status", args.unit, "--no-pager"]),
      );
    },
  };
}
