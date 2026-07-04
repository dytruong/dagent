import { describe, expect, it } from "vitest";
import { parsePromptTarget } from "../../src/orchestrator/prompt-target.js";

describe("parsePromptTarget", () => {
  it("extracts a slash-prefixed server alias", () => {
    expect(parsePromptTarget("/prod-api get systemd logs 10 minutes ago")).toEqual({
      targetAlias: "prod-api",
      prompt: "get systemd logs 10 minutes ago",
    });
  });

  it("returns the original prompt when no alias is present", () => {
    expect(parsePromptTarget("add remote server name dytruong-remote")).toEqual({
      targetAlias: undefined,
      prompt: "add remote server name dytruong-remote",
    });
  });

  it("rejects unsafe alias characters", () => {
    expect(() => parsePromptTarget("/../prod logs")).toThrow("Invalid server alias");
  });
});
