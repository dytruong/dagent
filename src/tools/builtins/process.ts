import { z } from "zod";
import type { RegisteredTool } from "../tool-registry.js";

interface Runner {
  run(alias: string, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const schema = z.object({ server: z.string(), filter: z.string().optional() });

export function createProcessListTool(runner: Runner): RegisteredTool<z.infer<typeof schema>> {
  return {
    name: "process.list",
    description: "List processes",
    safety: "read-only",
    validateArgs: (input) => schema.parse(input),
    async execute(args, context) {
      const now = new Date().toISOString();
      const argv = args.filter ? ["pgrep", "-a", args.filter] : ["ps", "aux"];
      const result = await runner.run(context.targetAlias, argv);
      return { toolName: "process.list", targetAlias: context.targetAlias, startedAt: now, finishedAt: now, ...result };
    },
  };
}
