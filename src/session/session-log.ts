import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getDagentPaths } from "../config/paths.js";
import { redactSecrets } from "../memory/memory-store.js";

export type SessionEvent = Record<string, unknown> & { type: string };

function sessionFileName(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace("T", "-").replaceAll(":", "")}.jsonl`;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value).slice(0, 20_000);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]));
  }
  return value;
}

export async function createSessionLog(root = process.cwd(), date = new Date()) {
  const paths = getDagentPaths(root);
  await mkdir(paths.sessionsDir, { recursive: true });
  const path = join(paths.sessionsDir, sessionFileName(date));
  return {
    path,
    async write(event: SessionEvent): Promise<void> {
      await appendFile(path, `${JSON.stringify(redactValue(event))}\n`, "utf8");
    },
  };
}
