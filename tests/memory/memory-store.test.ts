import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../src/memory/memory-store.js";

describe("memory store", () => {
  it("redacts secrets before writing server memory", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-memory-"));
    const memory = createMemoryStore(root);
    await memory.appendServerNote("prod-api", "password=secret token=abc123 nginx warning");
    const text = await readFile(join(root, ".dagent", "memory", "servers", "prod-api.md"), "utf8");
    expect(text).toContain("[REDACTED]");
    expect(text).toContain("nginx warning");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("abc123");
  });
});
