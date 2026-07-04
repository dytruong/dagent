import { describe, expect, it, vi } from "vitest";
import { createOrchestrator } from "../../src/orchestrator/orchestrator.js";

describe("orchestrator", () => {
  it("runs a read-only tool call and returns a valid final report", async () => {
    const model = {
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          type: "tool-call",
          toolName: "systemd.logs",
          args: { server: "prod-api", unit: "nginx.service", since: "10 minutes ago", lines: 100 },
        })
        .mockResolvedValueOnce({
          type: "message",
          content:
            "Summary\nChecked nginx logs.\nEvidence\njournalctl returned ok.\nConclusion\nNo immediate issue.\nNext Actions\nRun another read-only check if symptoms return.",
        }),
    };
    const execute = vi.fn().mockResolvedValue({
      toolName: "systemd.logs",
      targetAlias: "prod-api",
      startedAt: "2026-07-04T14:30:00.000Z",
      finishedAt: "2026-07-04T14:30:01.000Z",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    });

    const orchestrator = createOrchestrator({
      model,
      serverStore: { load: vi.fn().mockResolvedValue({ alias: "prod-api" }), list: vi.fn() },
      memoryStore: { loadGlobal: vi.fn().mockResolvedValue(""), loadServer: vi.fn().mockResolvedValue("") },
      policy: {
        decide: vi.fn().mockReturnValue({ allowed: true, requiresApproval: false, reason: "Read-only tool allowed by default" }),
        modelContext: vi.fn().mockReturnValue(""),
      },
      toolRegistry: {
        get: vi.fn().mockReturnValue({ name: "systemd.logs", safety: "read-only", validateArgs: (input: unknown) => input, execute }),
      },
      approvals: { approve: vi.fn() },
      sessionLog: { write: vi.fn() },
      registration: { run: vi.fn() },
      render: { status: vi.fn(), tool: vi.fn(), report: vi.fn(), error: vi.fn() },
    });

    await orchestrator.handlePrompt("/prod-api get systemd logs");

    expect(execute).toHaveBeenCalled();
    expect(model.complete).toHaveBeenCalledTimes(2);
  });
});
