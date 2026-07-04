import { describe, expect, it, vi } from "vitest";
import { runRegistrationFlow } from "../../src/server/registration-flow.js";

describe("registration flow", () => {
  it("records password authentication as prompt-per-session", async () => {
    const save = vi.fn();
    const result = await runRegistrationFlow({
      alias: "dytruong-remote",
      prompts: {
        text: vi.fn().mockResolvedValueOnce("deploy").mockResolvedValueOnce("22").mockResolvedValueOnce("203.0.113.10"),
        select: vi.fn().mockResolvedValue("password"),
        confirm: vi.fn().mockResolvedValue(false),
      },
      serverStore: { save },
      connectionTester: { test: vi.fn() },
    });

    expect(result.alias).toBe("dytruong-remote");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { method: "password", storage: "prompt-per-session" },
      }),
    );
  });

  it("asks for certificate path for certificate authentication", async () => {
    const save = vi.fn();
    await runRegistrationFlow({
      alias: "prod-api",
      prompts: {
        text: vi
          .fn()
          .mockResolvedValueOnce("deploy")
          .mockResolvedValueOnce("22")
          .mockResolvedValueOnce("prod.example.com")
          .mockResolvedValueOnce("~/.ssh/prod_api"),
        select: vi.fn().mockResolvedValue("certificate"),
        confirm: vi.fn().mockResolvedValue(false),
      },
      serverStore: { save },
      connectionTester: { test: vi.fn() },
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { method: "certificate", keyPath: "~/.ssh/prod_api" },
      }),
    );
  });
});
