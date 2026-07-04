import { z } from "zod";
import type { RegisteredTool } from "../tool-registry.js";

interface Runner {
  run(alias: string, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const schema = z.object({ server: z.string(), path: z.string().default("/") });

export function createDiskUsageTool(runner: Runner): RegisteredTool<z.infer<typeof schema>> {
  return {
    name: "disk.usage",
    description: "Inspect disk usage",
    safety: "read-only",
    validateArgs: (input) => schema.parse(input),
    async execute(args, context) {
      const now = new Date().toISOString();
      const result = await runner.run(context.targetAlias, ["df", "-h", args.path]);
      return { toolName: "disk.usage", targetAlias: context.targetAlias, startedAt: now, finishedAt: now, ...result };
    },
  };
}
