import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { getDagentPaths } from "../config/paths.js";
import { isSafeServerAlias } from "../orchestrator/prompt-target.js";
import type { ServerConfig } from "../types.js";

const serverSchema = z.object({
  alias: z.string(),
  host: z.string().min(1),
  username: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  auth: z.union([
    z.object({ method: z.literal("certificate"), keyPath: z.string().min(1) }),
    z.object({ method: z.literal("password"), storage: z.literal("prompt-per-session") }),
  ]),
  tags: z.array(z.string()).optional(),
  environment: z.string().optional(),
  region: z.string().optional(),
  knownServices: z.array(z.string()).optional(),
});

export function createServerStore(root = process.cwd()) {
  const paths = getDagentPaths(root);

  return {
    async save(config: ServerConfig): Promise<void> {
      if (!isSafeServerAlias(config.alias)) {
        throw new Error("Invalid server alias");
      }
      const parsed = serverSchema.parse(config);
      await mkdir(paths.serversDir, { recursive: true });
      const path = join(paths.serversDir, `${parsed.alias}.yaml`);
      await writeFile(path, YAML.stringify(parsed), "utf8");
    },

    async load(alias: string): Promise<ServerConfig> {
      if (!isSafeServerAlias(alias)) {
        throw new Error("Invalid server alias");
      }
      const yaml = await readFile(join(paths.serversDir, `${alias}.yaml`), "utf8");
      return serverSchema.parse(YAML.parse(yaml));
    },

    async list(): Promise<string[]> {
      try {
        const entries = await readdir(paths.serversDir);
        return entries
          .filter((entry) => entry.endsWith(".yaml"))
          .map((entry) => entry.slice(0, -".yaml".length))
          .filter(isSafeServerAlias)
          .sort();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    },
  };
}
