import { describe, expect, it, vi } from "vitest";
import { createOrchestrator } from "../../src/orchestrator/orchestrator.js";

function baseDeps(overrides: Record<string, unknown> = {}) {
  const render = { status: vi.fn(), tool: vi.fn(), report: vi.fn(), error: vi.fn() };
  return {
    model: { complete: vi.fn() },
    serverStore: { load: vi.fn(), list: vi.fn().mockResolvedValue([]) },
    memoryStore: { loadGlobal: vi.fn().mockResolvedValue(""), loadServer: vi.fn().mockResolvedValue("") },
    policy: { decide: vi.fn(), modelContext: vi.fn().mockReturnValue("") },
    toolRegistry: { get: vi.fn() },
    approvals: { approve: vi.fn() },
    sessionLog: { write: vi.fn() },
    registration: { run: vi.fn() },
    render,
    ...overrides,
  };
}

describe("orchestrator error handling", () => {
  it("does not call the model for prompts without a server target", async () => {
    const deps = baseDeps();
    const orchestrator = createOrchestrator(deps);
    await orchestrator.handlePrompt("get systemd logs");
    expect(deps.model.complete).not.toHaveBeenCalled();
    expect(deps.render.error).toHaveBeenCalledWith(expect.stringContaining("Choose a server"));
  });

  it("stops when approval is declined", async () => {
    const deps = baseDeps({
      model: {
        complete: vi.fn().mockResolvedValue({ type: "tool-call", toolName: "systemd.restart", args: { server: "prod-api" } }),
      },
      serverStore: { load: vi.fn().mockResolvedValue({ alias: "prod-api" }), list: vi.fn().mockResolvedValue([]) },
      policy: {
        decide: vi.fn().mockReturnValue({ allowed: true, requiresApproval: true, reason: "State-changing tool requires approval" }),
        modelContext: vi.fn().mockReturnValue(""),
      },
      toolRegistry: {
        get: vi.fn().mockReturnValue({
          name: "systemd.restart",
          safety: "state-changing",
          validateArgs: (input: unknown) => input,
          execute: vi.fn(),
        }),
      },
      approvals: { approve: vi.fn().mockResolvedValue(false) },
    });
    const orchestrator = createOrchestrator(deps);
    await orchestrator.handlePrompt("/prod-api restart nginx");
    expect(deps.render.report).toHaveBeenCalledWith(expect.stringContaining("operator declined approval"));
  });
});
