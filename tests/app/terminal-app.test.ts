import { describe, expect, it, vi } from "vitest";
import { createTerminalApp } from "../../src/app/terminal-app.js";

describe("terminal app behavior", () => {
  it("renders orchestrator errors and continues", async () => {
    const output: string[] = [];
    const app = createTerminalApp({
      input: {
        question: vi.fn().mockResolvedValueOnce("/prod-api logs").mockResolvedValueOnce("exit"),
        close: vi.fn(),
      },
      output: { write: (text) => output.push(text) },
      orchestrator: {
        handlePrompt: vi.fn().mockRejectedValueOnce(new Error("LM Studio unavailable")),
      },
    });

    await app.run();

    expect(output.join("")).toContain("Error: LM Studio unavailable");
  });
});
