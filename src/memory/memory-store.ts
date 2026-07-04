import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDagentPaths } from "../config/paths.js";

export function redactSecrets(text: string): string {
  return text
    .replace(/password=\S+/gi, "password=[REDACTED]")
    .replace(/token=\S+/gi, "token=[REDACTED]")
    .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, "[REDACTED]");
}

export function createMemoryStore(root = process.cwd()) {
  const paths = getDagentPaths(root);
  return {
    async loadGlobal(): Promise<string> {
      try {
        return await readFile(join(paths.memoryDir, "global.md"), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
        throw error;
      }
    },
    async loadServer(alias: string): Promise<string> {
      try {
        return await readFile(join(paths.memoryDir, "servers", `${alias}.md`), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
        throw error;
      }
    },
    async appendServerNote(alias: string, note: string): Promise<void> {
      const dir = join(paths.memoryDir, "servers");
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, `${alias}.md`), `${redactSecrets(note)}\n`, "utf8");
    },
  };
}
