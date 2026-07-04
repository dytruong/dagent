import { describe, expect, it } from "vitest";
import { createSystemPrompt } from "../../src/model/system-prompt.js";

describe("system prompt", () => {
  it("contains safety boundary and final response contract", () => {
    const prompt = createSystemPrompt();
    expect(prompt).toContain("You cannot execute raw shell commands");
    expect(prompt).toContain("Summary");
    expect(prompt).toContain("Evidence");
    expect(prompt).toContain("Conclusion");
    expect(prompt).toContain("Next Actions");
  });
});
