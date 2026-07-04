import { describe, expect, it, vi } from "vitest";
import { createTerminalApp } from "../src/app/terminal-app.js";

describe("terminal app", () => {
  it("starts with the configured prompt label", async () => {
    const output: string[] = [];
    const app = createTerminalApp({
      input: {
        question: vi.fn().mockResolvedValue("exit"),
        close: vi.fn(),
      },
      output: {
        write: (text: string) => output.push(text),
      },
      orchestrator: {
        handlePrompt: vi.fn(),
      },
    });

    await app.run();

    expect(output.join("")).toContain("dagent");
  });
});
