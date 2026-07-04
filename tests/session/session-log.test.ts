import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSessionLog } from "../../src/session/session-log.js";

describe("session log", () => {
  it("writes redacted JSONL events", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-session-"));
    const log = await createSessionLog(root, new Date("2026-07-04T14:30:00Z"));
    await log.write({ type: "tool-result", output: "token=abc123\nservice ok" });
    const jsonl = await readFile(join(root, ".dagent", "sessions", "2026-07-04-143000.jsonl"), "utf8");
    expect(jsonl).toContain("\"type\":\"tool-result\"");
    expect(jsonl).toContain("[REDACTED]");
    expect(jsonl).not.toContain("abc123");
  });
});
