import { describe, expect, it } from "vitest";

describe("cli wiring", () => {
  it("loads the CLI module without throwing", async () => {
    await expect(import("../src/cli.js")).resolves.toBeDefined();
  });
});
