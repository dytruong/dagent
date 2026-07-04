import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPolicyEngine } from "../../src/policy/policy-engine.js";

describe("policy engine", () => {
  it("allows read-only tools by default", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-policy-"));
    const policy = await createPolicyEngine(root);
    expect(policy.decide({ toolName: "systemd.logs", safety: "read-only", targetAlias: "prod-api" })).toEqual({
      allowed: true,
      requiresApproval: false,
      reason: "Read-only tool allowed by default",
    });
  });

  it("requires approval for state-changing tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-policy-"));
    const policy = await createPolicyEngine(root);
    expect(policy.decide({ toolName: "systemd.restart", safety: "state-changing", targetAlias: "prod-api" })).toEqual({
      allowed: true,
      requiresApproval: true,
      reason: "State-changing tool requires approval",
    });
  });

  it("blocks destructive tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-policy-"));
    const policy = await createPolicyEngine(root);
    expect(policy.decide({ toolName: "disk.wipe", safety: "destructive", targetAlias: "prod-api" })).toEqual({
      allowed: false,
      requiresApproval: false,
      reason: "Destructive tools are blocked in version 1",
    });
  });

  it("loads explicit tool denials from rules/tools.yaml", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-policy-"));
    await mkdir(join(root, "rules"), { recursive: true });
    await writeFile(join(root, "rules", "tools.yaml"), "deniedTools:\n  - process.list\n", "utf8");
    const policy = await createPolicyEngine(root);
    expect(policy.decide({ toolName: "process.list", safety: "read-only", targetAlias: "prod-api" }).allowed).toBe(false);
  });

  it("includes server-specific rules in model context", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-policy-"));
    await mkdir(join(root, "rules", "servers"), { recursive: true });
    await writeFile(join(root, "rules", "global.md"), "Prefer read-only tools.\n", "utf8");
    await writeFile(join(root, "rules", "servers", "prod-api.md"), "prod-api critical service: nginx\n", "utf8");
    const policy = await createPolicyEngine(root);
    expect(policy.modelContext("prod-api")).toContain("Prefer read-only tools.");
    expect(policy.modelContext("prod-api")).toContain("prod-api critical service: nginx");
  });
});
