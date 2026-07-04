import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../../src/tools/tool-registry.js";

describe("tool registry", () => {
  it("validates systemd logs arguments", () => {
    const registry = createToolRegistry([]);
    const tool = registry.get("systemd.logs");
    const args = tool.validateArgs({
      server: "prod-api",
      unit: "nginx.service",
      since: "10 minutes ago",
      lines: 300,
    }) as { lines: number };
    expect(args.lines).toBe(300);
  });

  it("rejects unknown tools", () => {
    const registry = createToolRegistry([]);
    expect(() => registry.get("shell.raw")).toThrow("Unknown tool");
  });
});
