import { describe, expect, it } from "vitest";
import { classifyRegistrationPrompt } from "../../src/orchestrator/registration-classifier.js";

describe("registration classifier", () => {
  it("detects add remote server prompts", () => {
    expect(classifyRegistrationPrompt("add remote server name dytruong-remote")).toEqual({
      matched: true,
      alias: "dytruong-remote",
    });
  });

  it("ignores operational prompts", () => {
    expect(classifyRegistrationPrompt("get systemd logs")).toEqual({ matched: false });
  });
});
