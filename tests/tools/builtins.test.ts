import { describe, expect, it, vi } from "vitest";
import { createDiskUsageTool } from "../../src/tools/builtins/disk.js";
import { createProcessListTool } from "../../src/tools/builtins/process.js";
import { createSystemdLogsTool, createSystemdStatusTool } from "../../src/tools/builtins/systemd.js";

describe("built-in tools", () => {
  it("runs journalctl logs with validated arguments", async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" });
    const tool = createSystemdLogsTool({ run });
    await tool.execute(
      { server: "prod-api", unit: "nginx.service", since: "10 minutes ago", lines: 300 },
      { targetAlias: "prod-api" },
    );
    expect(run).toHaveBeenCalledWith("prod-api", [
      "journalctl",
      "-u",
      "nginx.service",
      "--since",
      "10 minutes ago",
      "-n",
      "300",
      "--no-pager",
    ]);
  });

  it("runs systemctl status read-only", async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "active", stderr: "" });
    const tool = createSystemdStatusTool({ run });
    await tool.execute({ server: "prod-api", unit: "nginx.service" }, { targetAlias: "prod-api" });
    expect(run).toHaveBeenCalledWith("prod-api", ["systemctl", "status", "nginx.service", "--no-pager"]);
  });

  it("runs disk usage for a safe path", async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "50%", stderr: "" });
    const tool = createDiskUsageTool({ run });
    await tool.execute({ server: "prod-api", path: "/" }, { targetAlias: "prod-api" });
    expect(run).toHaveBeenCalledWith("prod-api", ["df", "-h", "/"]);
  });

  it("runs process list without raw model shell", async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "nginx", stderr: "" });
    const tool = createProcessListTool({ run });
    await tool.execute({ server: "prod-api", filter: "nginx" }, { targetAlias: "prod-api" });
    expect(run).toHaveBeenCalledWith("prod-api", ["pgrep", "-a", "nginx"]);
  });
});
