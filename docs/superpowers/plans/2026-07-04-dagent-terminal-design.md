# dagent Terminal Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable `dagent` terminal assistant for safe remote server operations through typed tools, local policy enforcement, LM Studio, SSH execution, server registration, memory, audit sessions, approvals, and final report validation.

**Architecture:** Create a TypeScript Node.js CLI with a narrow orchestrator boundary between the LM Studio model and local tool execution. The model can request typed tools, but local Zod schemas, policy checks, approval prompts, and SSH tool implementations decide what actually runs.

**Tech Stack:** Node.js 22+, TypeScript, Vitest, Zod, Commander, Inquirer, OpenAI-compatible SDK, ssh2, yaml, pino-pretty-free structured terminal rendering through `node:readline/promises`.

---

## File Structure

- Create: `package.json` - scripts, runtime dependencies, dev dependencies, package metadata, and `bin` entry.
- Create: `tsconfig.json` - strict TypeScript configuration for `src/` and `tests/`.
- Create: `vitest.config.ts` - Vitest configuration.
- Create: `src/cli.ts` - executable CLI entrypoint that starts the interactive terminal app.
- Create: `src/app/terminal-app.ts` - REPL loop, prompt routing, status rendering, approval and hidden password prompts.
- Create: `src/orchestrator/orchestrator.ts` - request loop, target parsing, context assembly, tool-call validation, policy enforcement, execution, final report repair.
- Create: `src/orchestrator/prompt-target.ts` - `/alias` extraction and prompt normalization.
- Create: `src/orchestrator/registration-classifier.ts` - local classification for server registration prompts before model calls.
- Create: `src/orchestrator/final-report.ts` - required final response section validation and repair prompt creation.
- Create: `src/model/lm-studio-client.ts` - OpenAI-compatible LM Studio chat client.
- Create: `src/model/system-prompt.ts` - safety and final response contract.
- Create: `src/tools/tool-registry.ts` - typed tool definitions, schemas, safety metadata, and dispatch API.
- Create: `src/tools/builtins/systemd.ts` - `systemd.logs` and `systemd.status` implementations.
- Create: `src/tools/builtins/disk.ts` - `disk.usage` implementation.
- Create: `src/tools/builtins/process.ts` - `process.list` implementation.
- Create: `src/tools/shell-args.ts` - safe argument builders for tool implementations.
- Create: `src/policy/policy-engine.ts` - rules loading and authoritative policy decisions.
- Create: `src/ssh/ssh-executor.ts` - SSH connection lifecycle and remote command execution.
- Create: `src/ssh/session-password-cache.ts` - in-memory password cache with no persistence or model exposure.
- Create: `src/server/server-store.ts` - server YAML config loading, validation, duplicate handling, secret-free writing.
- Create: `src/server/registration-flow.ts` - guided server registration workflow and optional read-only connection test.
- Create: `src/memory/memory-store.ts` - local file-backed memory loading and redaction.
- Create: `src/session/session-log.ts` - JSONL audit event writer with output truncation and secret redaction.
- Create: `src/config/paths.ts` - root-relative path helpers for `servers/`, `rules/`, and `.dagent/`.
- Create: `src/types.ts` - shared types for servers, tools, policy, model messages, and session events.
- Create: `rules/global.md` - initial human-readable global rules.
- Create: `rules/tools.yaml` - initial local policy for built-in tools.
- Create: `rules/servers/.gitkeep` - preserves the server-specific rules directory from the initial policy layout.
- Create: `tests/**` - focused unit tests and orchestrator tests with mocked LM Studio and SSH.

## Task 1: Project Scaffold and CLI Smoke Test

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/cli.ts`
- Create: `src/app/terminal-app.ts`
- Create: `tests/cli-smoke.test.ts`

- [ ] **Step 1: Write the failing CLI smoke test**

```ts
// tests/cli-smoke.test.ts
import { describe, expect, it, vi } from "vitest";
import { createTerminalApp } from "../src/app/terminal-app";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/cli-smoke.test.ts`

Expected: FAIL with an import error for `../src/app/terminal-app`.

- [ ] **Step 3: Add project scaffold**

```json
// package.json
{
  "name": "dagent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "dagent": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@inquirer/prompts": "^7.5.0",
    "commander": "^14.0.0",
    "openai": "^5.8.2",
    "ssh2": "^1.16.0",
    "yaml": "^2.8.0",
    "zod": "^3.25.67"
  },
  "devDependencies": {
    "@types/node": "^22.15.34",
    "@types/ssh2": "^1.15.5",
    "tsx": "^4.20.3",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true,
  },
});
```

- [ ] **Step 4: Add minimal terminal app**

```ts
// src/app/terminal-app.ts
export interface PromptInput {
  question(prompt: string): Promise<string>;
  close(): void;
}

export interface TerminalOutput {
  write(text: string): void;
}

export interface PromptOrchestrator {
  handlePrompt(prompt: string): Promise<void>;
}

export interface TerminalAppDeps {
  input: PromptInput;
  output: TerminalOutput;
  orchestrator: PromptOrchestrator;
}

export function createTerminalApp(deps: TerminalAppDeps) {
  return {
    async run(): Promise<void> {
      deps.output.write("dagent\n");
      while (true) {
        const prompt = await deps.input.question("> ");
        const trimmed = prompt.trim();
        if (trimmed === "exit" || trimmed === "quit") {
          deps.input.close();
          return;
        }
        if (trimmed.length > 0) {
          await deps.orchestrator.handlePrompt(trimmed);
        }
      }
    },
  };
}
```

```ts
// src/cli.ts
#!/usr/bin/env node
import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createTerminalApp } from "./app/terminal-app.js";

const program = new Command();

program
  .name("dagent")
  .description("Interactive terminal assistant for safe remote server operations")
  .action(async () => {
    const readline = createInterface({ input, output });
    const app = createTerminalApp({
      input: readline,
      output: { write: (text) => output.write(text) },
      orchestrator: {
        async handlePrompt() {
          output.write("No orchestrator configured yet.\n");
        },
      },
    });
    await app.run();
  });

await program.parseAsync();
```

- [ ] **Step 5: Run verification**

Run: `npm install`

Expected: PASS, creates `package-lock.json`.

Run: `npm test -- tests/cli-smoke.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/cli.ts src/app/terminal-app.ts tests/cli-smoke.test.ts
git commit -m "chore: scaffold dagent cli"
```

## Task 2: Shared Types, Prompt Target Parsing, and Final Report Validation

**Files:**
- Create: `src/types.ts`
- Create: `src/orchestrator/prompt-target.ts`
- Create: `src/orchestrator/final-report.ts`
- Create: `tests/orchestrator/prompt-target.test.ts`
- Create: `tests/orchestrator/final-report.test.ts`

- [ ] **Step 1: Write prompt target tests**

```ts
// tests/orchestrator/prompt-target.test.ts
import { describe, expect, it } from "vitest";
import { parsePromptTarget } from "../../src/orchestrator/prompt-target";

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
```

- [ ] **Step 2: Write final report tests**

```ts
// tests/orchestrator/final-report.test.ts
import { describe, expect, it } from "vitest";
import { createFinalReportRepairPrompt, validateFinalReport } from "../../src/orchestrator/final-report";

describe("final report validation", () => {
  it("accepts all required sections", () => {
    const report = [
      "Summary",
      "Checked nginx logs.",
      "Evidence",
      "journalctl returned 3 warnings.",
      "Conclusion",
      "nginx is running with warnings.",
      "Next Actions",
      "Run another read-only log check after deployment.",
    ].join("\n");

    expect(validateFinalReport(report)).toEqual({ ok: true, missingSections: [] });
  });

  it("reports missing sections", () => {
    expect(validateFinalReport("Summary\nOnly one section.")).toEqual({
      ok: false,
      missingSections: ["Evidence", "Conclusion", "Next Actions"],
    });
  });

  it("creates a repair prompt without requesting tool reruns", () => {
    const prompt = createFinalReportRepairPrompt("Summary\nDone.", ["Evidence"]);
    expect(prompt).toContain("Do not request or run any additional tools");
    expect(prompt).toContain("Evidence");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/orchestrator/prompt-target.test.ts tests/orchestrator/final-report.test.ts`

Expected: FAIL with import errors.

- [ ] **Step 4: Add shared types**

```ts
// src/types.ts
export type AuthConfig =
  | { method: "certificate"; keyPath: string }
  | { method: "password"; storage: "prompt-per-session" };

export interface ServerConfig {
  alias: string;
  host: string;
  username: string;
  port: number;
  auth: AuthConfig;
  tags?: string[];
  environment?: string;
  region?: string;
  knownServices?: string[];
}

export type ToolSafety = "read-only" | "state-changing" | "destructive";

export interface ToolDefinition<TArgs> {
  name: string;
  description: string;
  safety: ToolSafety;
  schema: {
    parse(input: unknown): TArgs;
  };
}

export interface ToolResult {
  toolName: string;
  targetAlias: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}
```

- [ ] **Step 5: Implement prompt target parsing**

```ts
// src/orchestrator/prompt-target.ts
const SAFE_ALIAS = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/;

export interface ParsedPromptTarget {
  targetAlias?: string;
  prompt: string;
}

export function isSafeServerAlias(alias: string): boolean {
  return SAFE_ALIAS.test(alias) && !alias.includes("..");
}

export function parsePromptTarget(input: string): ParsedPromptTarget {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { prompt: trimmed };
  }

  const [rawAlias, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!rawAlias || !isSafeServerAlias(rawAlias)) {
    throw new Error("Invalid server alias");
  }

  return {
    targetAlias: rawAlias,
    prompt: rest.join(" ").trim(),
  };
}
```

- [ ] **Step 6: Implement final report validation**

```ts
// src/orchestrator/final-report.ts
const REQUIRED_SECTIONS = ["Summary", "Evidence", "Conclusion", "Next Actions"] as const;

export interface FinalReportValidation {
  ok: boolean;
  missingSections: string[];
}

export function validateFinalReport(report: string): FinalReportValidation {
  const missingSections = REQUIRED_SECTIONS.filter((section) => {
    const heading = new RegExp(`(^|\\n)${section}\\s*(\\n|$)`, "i");
    return !heading.test(report);
  });

  return {
    ok: missingSections.length === 0,
    missingSections,
  };
}

export function createFinalReportRepairPrompt(report: string, missingSections: string[]): string {
  return [
    "Repair the final operational report so it includes every required section.",
    `Missing sections: ${missingSections.join(", ")}`,
    "Required sections: Summary, Evidence, Conclusion, Next Actions.",
    "Use only the existing conversation and tool results.",
    "Do not request or run any additional tools.",
    "Original response:",
    report,
  ].join("\n");
}
```

- [ ] **Step 7: Run verification**

Run: `npm test -- tests/orchestrator/prompt-target.test.ts tests/orchestrator/final-report.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/orchestrator/prompt-target.ts src/orchestrator/final-report.ts tests/orchestrator/prompt-target.test.ts tests/orchestrator/final-report.test.ts
git commit -m "feat: add prompt parsing and report validation"
```

## Task 3: Server Config Store and Registration Flow

**Files:**
- Create: `src/config/paths.ts`
- Create: `src/server/server-store.ts`
- Create: `src/server/registration-flow.ts`
- Create: `tests/server/server-store.test.ts`
- Create: `tests/server/registration-flow.test.ts`

- [ ] **Step 1: Write server store tests**

```ts
// tests/server/server-store.test.ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createServerStore } from "../../src/server/server-store";

describe("server store", () => {
  it("writes certificate-backed config without copying keys", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-server-store-"));
    const store = createServerStore(root);

    await store.save({
      alias: "dytruong-remote",
      host: "dytruong.example.com",
      username: "deploy",
      port: 22,
      auth: { method: "certificate", keyPath: "~/.ssh/dytruong_remote" },
      tags: ["personal"],
    });

    const yaml = await readFile(join(root, "servers", "dytruong-remote.yaml"), "utf8");
    expect(yaml).toContain("keyPath: ~/.ssh/dytruong_remote");
    expect(yaml).not.toContain("PRIVATE KEY");
  });

  it("writes password config without persisting a password", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-server-store-"));
    const store = createServerStore(root);

    await store.save({
      alias: "prod-api",
      host: "203.0.113.10",
      username: "deploy",
      port: 22,
      auth: { method: "password", storage: "prompt-per-session" },
    });

    const yaml = await readFile(join(root, "servers", "prod-api.yaml"), "utf8");
    expect(yaml).toContain("storage: prompt-per-session");
    expect(yaml).not.toMatch(/password:\s*/i);
    expect(yaml).not.toMatch(/base64/i);
  });

  it("rejects invalid aliases", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-server-store-"));
    const store = createServerStore(root);
    await expect(
      store.save({
        alias: "../prod",
        host: "example.com",
        username: "deploy",
        port: 22,
        auth: { method: "password", storage: "prompt-per-session" },
      }),
    ).rejects.toThrow("Invalid server alias");
  });

  it("lists registered aliases", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-server-store-"));
    const store = createServerStore(root);
    await store.save({
      alias: "prod-api",
      host: "prod.example.com",
      username: "deploy",
      port: 22,
      auth: { method: "password", storage: "prompt-per-session" },
    });
    await store.save({
      alias: "dytruong-remote",
      host: "dytruong.example.com",
      username: "deploy",
      port: 22,
      auth: { method: "certificate", keyPath: "~/.ssh/dytruong_remote" },
    });

    expect(await store.list()).toEqual(["dytruong-remote", "prod-api"]);
  });
});
```

- [ ] **Step 2: Write registration flow tests**

```ts
// tests/server/registration-flow.test.ts
import { describe, expect, it, vi } from "vitest";
import { runRegistrationFlow } from "../../src/server/registration-flow";

describe("registration flow", () => {
  it("records password authentication as prompt-per-session", async () => {
    const save = vi.fn();
    const result = await runRegistrationFlow({
      alias: "dytruong-remote",
      prompts: {
        text: vi.fn()
          .mockResolvedValueOnce("deploy")
          .mockResolvedValueOnce("22")
          .mockResolvedValueOnce("203.0.113.10"),
        select: vi.fn().mockResolvedValue("password"),
        confirm: vi.fn().mockResolvedValue(false),
      },
      serverStore: { save },
      connectionTester: { test: vi.fn() },
    });

    expect(result.alias).toBe("dytruong-remote");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      auth: { method: "password", storage: "prompt-per-session" },
    }));
  });

  it("asks for certificate path for certificate authentication", async () => {
    const save = vi.fn();
    await runRegistrationFlow({
      alias: "prod-api",
      prompts: {
        text: vi.fn()
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

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      auth: { method: "certificate", keyPath: "~/.ssh/prod_api" },
    }));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/server/server-store.test.ts tests/server/registration-flow.test.ts`

Expected: FAIL with import errors.

- [ ] **Step 4: Add paths helper**

```ts
// src/config/paths.ts
import { join } from "node:path";

export interface DagentPaths {
  root: string;
  serversDir: string;
  rulesDir: string;
  memoryDir: string;
  sessionsDir: string;
}

export function getDagentPaths(root = process.cwd()): DagentPaths {
  return {
    root,
    serversDir: join(root, "servers"),
    rulesDir: join(root, "rules"),
    memoryDir: join(root, ".dagent", "memory"),
    sessionsDir: join(root, ".dagent", "sessions"),
  };
}
```

- [ ] **Step 5: Implement server store**

```ts
// src/server/server-store.ts
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { getDagentPaths } from "../config/paths.js";
import { isSafeServerAlias } from "../orchestrator/prompt-target.js";
import type { ServerConfig } from "../types.js";

const serverSchema = z.object({
  alias: z.string(),
  host: z.string().min(1),
  username: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  auth: z.union([
    z.object({ method: z.literal("certificate"), keyPath: z.string().min(1) }),
    z.object({ method: z.literal("password"), storage: z.literal("prompt-per-session") }),
  ]),
  tags: z.array(z.string()).optional(),
  environment: z.string().optional(),
  region: z.string().optional(),
  knownServices: z.array(z.string()).optional(),
});

export function createServerStore(root = process.cwd()) {
  const paths = getDagentPaths(root);

  return {
    async save(config: ServerConfig): Promise<void> {
      if (!isSafeServerAlias(config.alias)) {
        throw new Error("Invalid server alias");
      }
      const parsed = serverSchema.parse(config);
      await mkdir(paths.serversDir, { recursive: true });
      const path = join(paths.serversDir, `${parsed.alias}.yaml`);
      await writeFile(path, YAML.stringify(parsed), "utf8");
    },

    async load(alias: string): Promise<ServerConfig> {
      if (!isSafeServerAlias(alias)) {
        throw new Error("Invalid server alias");
      }
      const yaml = await readFile(join(paths.serversDir, `${alias}.yaml`), "utf8");
      return serverSchema.parse(YAML.parse(yaml));
    },

    async list(): Promise<string[]> {
      try {
        const entries = await readdir(paths.serversDir);
        return entries
          .filter((entry) => entry.endsWith(".yaml"))
          .map((entry) => entry.slice(0, -".yaml".length))
          .filter(isSafeServerAlias)
          .sort();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    },
  };
}
```

- [ ] **Step 6: Implement registration flow**

```ts
// src/server/registration-flow.ts
import type { ServerConfig } from "../types.js";

export interface RegistrationPrompts {
  text(message: string, options?: { default?: string }): Promise<string>;
  select(message: string, choices: string[]): Promise<string>;
  confirm(message: string, options?: { default?: boolean }): Promise<boolean>;
}

export interface RegistrationDeps {
  alias: string;
  prompts: RegistrationPrompts;
  serverStore: { save(config: ServerConfig): Promise<void> };
  connectionTester: { test(alias: string): Promise<void> };
}

export async function runRegistrationFlow(deps: RegistrationDeps): Promise<ServerConfig> {
  const username = await deps.prompts.text("Username:");
  const portValue = await deps.prompts.text("Port [22]:", { default: "22" });
  const host = await deps.prompts.text("DNS name or IP address:");
  const authMethod = await deps.prompts.select("Authentication method:", ["password", "certificate"]);
  const port = Number.parseInt(portValue || "22", 10);

  const config: ServerConfig = authMethod === "certificate"
    ? {
        alias: deps.alias,
        host,
        username,
        port,
        auth: { method: "certificate", keyPath: await deps.prompts.text("Certificate path:") },
      }
    : {
        alias: deps.alias,
        host,
        username,
        port,
        auth: { method: "password", storage: "prompt-per-session" },
      };

  await deps.serverStore.save(config);
  const shouldTest = await deps.prompts.confirm(`Server ${deps.alias} registered. Run a connection test now?`, {
    default: true,
  });
  if (shouldTest) {
    await deps.connectionTester.test(deps.alias);
  }
  return config;
}
```

- [ ] **Step 7: Run verification**

Run: `npm test -- tests/server/server-store.test.ts tests/server/registration-flow.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/config/paths.ts src/server/server-store.ts src/server/registration-flow.ts tests/server/server-store.test.ts tests/server/registration-flow.test.ts
git commit -m "feat: add server registration storage"
```

## Task 4: Policy Engine and Tool Registry

**Files:**
- Create: `src/tools/tool-registry.ts`
- Create: `src/policy/policy-engine.ts`
- Create: `rules/global.md`
- Create: `rules/tools.yaml`
- Create: `rules/servers/.gitkeep`
- Create: `tests/tools/tool-registry.test.ts`
- Create: `tests/policy/policy-engine.test.ts`

- [ ] **Step 1: Write tool registry tests**

```ts
// tests/tools/tool-registry.test.ts
import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../../src/tools/tool-registry";

describe("tool registry", () => {
  it("validates systemd logs arguments", () => {
    const registry = createToolRegistry([]);
    const tool = registry.get("systemd.logs");
    const args = tool.validateArgs({
      server: "prod-api",
      unit: "nginx.service",
      since: "10 minutes ago",
      lines: 300,
    });
    expect(args.lines).toBe(300);
  });

  it("rejects unknown tools", () => {
    const registry = createToolRegistry([]);
    expect(() => registry.get("shell.raw")).toThrow("Unknown tool");
  });
});
```

- [ ] **Step 2: Write policy tests**

```ts
// tests/policy/policy-engine.test.ts
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPolicyEngine } from "../../src/policy/policy-engine";

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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/tools/tool-registry.test.ts tests/policy/policy-engine.test.ts`

Expected: FAIL with import errors.

- [ ] **Step 4: Implement tool registry**

```ts
// src/tools/tool-registry.ts
import { z } from "zod";
import type { ToolResult, ToolSafety } from "../types.js";

export interface ToolContext {
  targetAlias: string;
}

export interface RegisteredTool<TArgs> {
  name: string;
  description: string;
  safety: ToolSafety;
  validateArgs(input: unknown): TArgs;
  execute(args: TArgs, context: ToolContext): Promise<ToolResult>;
}

export type AnyRegisteredTool = RegisteredTool<unknown>;

const systemdLogsSchema = z.object({
  server: z.string().min(1),
  unit: z.string().regex(/^[a-zA-Z0-9_.@-]+\.service$/).optional(),
  since: z.string().min(1).default("10 minutes ago"),
  lines: z.number().int().min(1).max(1000).default(300),
});

const systemdStatusSchema = z.object({
  server: z.string().min(1),
  unit: z.string().regex(/^[a-zA-Z0-9_.@-]+\.service$/),
});

const diskUsageSchema = z.object({
  server: z.string().min(1),
  path: z.string().regex(/^\/[a-zA-Z0-9/._-]*$/).default("/"),
});

const processListSchema = z.object({
  server: z.string().min(1),
  filter: z.string().regex(/^[a-zA-Z0-9_.@:-]+$/).optional(),
});

function unavailableTool<TArgs>(
  name: string,
  description: string,
  safety: ToolSafety,
  schema: z.ZodType<TArgs>,
): RegisteredTool<TArgs> {
  return {
    name,
    description,
    safety,
    validateArgs: (input) => schema.parse(input),
    async execute(): Promise<ToolResult> {
      throw new Error(`Tool ${name} has no executor bound`);
    },
  };
}

export function createToolRegistry(overrides: AnyRegisteredTool[]) {
  const tools = new Map<string, AnyRegisteredTool>();
  for (const tool of [
    unavailableTool("systemd.logs", "Read journal logs for a service or system", "read-only", systemdLogsSchema),
    unavailableTool("systemd.status", "Read systemd service status", "read-only", systemdStatusSchema),
    unavailableTool("disk.usage", "Inspect disk usage", "read-only", diskUsageSchema),
    unavailableTool("process.list", "List processes", "read-only", processListSchema),
    ...overrides,
  ]) {
    tools.set(tool.name, tool as AnyRegisteredTool);
  }

  return {
    list(): AnyRegisteredTool[] {
      return [...tools.values()];
    },
    get(name: string): AnyRegisteredTool {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return tool;
    },
  };
}
```

- [ ] **Step 5: Implement policy engine**

```ts
// src/policy/policy-engine.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import type { PolicyDecision, ToolSafety } from "../types.js";

export interface PolicyRequest {
  toolName: string;
  safety: ToolSafety;
  targetAlias: string;
}

export interface PolicyEngine {
  decide(request: PolicyRequest): PolicyDecision;
  modelContext(targetAlias?: string): string;
}

interface ToolRules {
  deniedTools?: string[];
  approvalRequiredTools?: string[];
}

export async function createPolicyEngine(root = process.cwd()): Promise<PolicyEngine> {
  let toolRules: ToolRules = {};
  let globalRules = "";
  const serverRules = new Map<string, string>();

  try {
    const text = await readFile(join(root, "rules", "tools.yaml"), "utf8");
    toolRules = YAML.parse(text) ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  try {
    globalRules = await readFile(join(root, "rules", "global.md"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(join(root, "rules", "servers"));
    for (const entry of entries.filter((name) => name.endsWith(".md"))) {
      serverRules.set(entry.slice(0, -".md".length), await readFile(join(root, "rules", "servers", entry), "utf8"));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return {
    decide(request): PolicyDecision {
      if (toolRules.deniedTools?.includes(request.toolName)) {
        return { allowed: false, requiresApproval: false, reason: `Tool ${request.toolName} is denied by local policy` };
      }
      if (request.safety === "destructive") {
        return { allowed: false, requiresApproval: false, reason: "Destructive tools are blocked in version 1" };
      }
      if (request.safety === "state-changing" || toolRules.approvalRequiredTools?.includes(request.toolName)) {
        return { allowed: true, requiresApproval: true, reason: "State-changing tool requires approval" };
      }
      return { allowed: true, requiresApproval: false, reason: "Read-only tool allowed by default" };
    },
    modelContext(targetAlias?: string): string {
      return [globalRules, targetAlias ? serverRules.get(targetAlias) : undefined].filter(Boolean).join("\n");
    },
  };
}
```

- [ ] **Step 6: Add initial rules files**

```md
<!-- rules/global.md -->
# dagent Global Rules

- Prefer read-only tools.
- Require approval for state-changing tools.
- Block destructive tools in version 1.
- Raw shell access is unavailable.
- Never persist SSH passwords, private keys, tokens, or secrets.
```

```yaml
# rules/tools.yaml
deniedTools: []
approvalRequiredTools: []
```

```text
# rules/servers/.gitkeep
```

- [ ] **Step 7: Run verification**

Run: `npm test -- tests/tools/tool-registry.test.ts tests/policy/policy-engine.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tools/tool-registry.ts src/policy/policy-engine.ts rules/global.md rules/tools.yaml rules/servers/.gitkeep tests/tools/tool-registry.test.ts tests/policy/policy-engine.test.ts
git commit -m "feat: add tool registry and policy engine"
```

## Task 5: SSH Executor, Password Cache, and Built-In Tools

**Files:**
- Create: `src/ssh/session-password-cache.ts`
- Create: `src/ssh/ssh-executor.ts`
- Create: `src/tools/shell-args.ts`
- Create: `src/tools/builtins/systemd.ts`
- Create: `src/tools/builtins/disk.ts`
- Create: `src/tools/builtins/process.ts`
- Create: `tests/ssh/session-password-cache.test.ts`
- Create: `tests/tools/builtins.test.ts`

- [ ] **Step 1: Write password cache test**

```ts
// tests/ssh/session-password-cache.test.ts
import { describe, expect, it } from "vitest";
import { createSessionPasswordCache } from "../../src/ssh/session-password-cache";

describe("session password cache", () => {
  it("stores passwords only in process memory by alias", () => {
    const cache = createSessionPasswordCache();
    cache.set("prod-api", "secret-value");
    expect(cache.get("prod-api")).toBe("secret-value");
    cache.clear();
    expect(cache.get("prod-api")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write built-in tool command tests**

```ts
// tests/tools/builtins.test.ts
import { describe, expect, it, vi } from "vitest";
import { createDiskUsageTool } from "../../src/tools/builtins/disk";
import { createProcessListTool } from "../../src/tools/builtins/process";
import { createSystemdLogsTool, createSystemdStatusTool } from "../../src/tools/builtins/systemd";

describe("built-in tools", () => {
  it("runs journalctl logs with validated arguments", async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "" });
    const tool = createSystemdLogsTool({ run });
    await tool.execute({ server: "prod-api", unit: "nginx.service", since: "10 minutes ago", lines: 300 }, { targetAlias: "prod-api" });
    expect(run).toHaveBeenCalledWith("prod-api", ["journalctl", "-u", "nginx.service", "--since", "10 minutes ago", "-n", "300", "--no-pager"]);
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/ssh/session-password-cache.test.ts tests/tools/builtins.test.ts`

Expected: FAIL with import errors.

- [ ] **Step 4: Implement password cache and shell argument helper**

```ts
// src/ssh/session-password-cache.ts
export function createSessionPasswordCache() {
  const passwords = new Map<string, string>();
  return {
    get(alias: string): string | undefined {
      return passwords.get(alias);
    },
    set(alias: string, password: string): void {
      passwords.set(alias, password);
    },
    clear(): void {
      passwords.clear();
    },
  };
}
```

```ts
// src/tools/shell-args.ts
export function assertSafeArg(value: string, pattern: RegExp, label: string): string {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}
```

- [ ] **Step 5: Implement SSH executor**

```ts
// src/ssh/ssh-executor.ts
import { Client } from "ssh2";
import type { ServerConfig } from "../types.js";

export interface RemoteCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SshExecutorDeps {
  loadServer(alias: string): Promise<ServerConfig>;
  getPassword(alias: string): Promise<string>;
}

export function createSshExecutor(deps: SshExecutorDeps) {
  return {
    async run(alias: string, argv: string[]): Promise<RemoteCommandResult> {
      const server = await deps.loadServer(alias);
      const command = argv.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(" ");

      return new Promise((resolve, reject) => {
        const client = new Client();
        let stdout = "";
        let stderr = "";

        client.on("ready", () => {
          client.exec(command, (error, stream) => {
            if (error) {
              client.end();
              reject(error);
              return;
            }
            stream.on("close", (code: number | undefined) => {
              client.end();
              resolve({ exitCode: code ?? 0, stdout, stderr });
            });
            stream.on("data", (data: Buffer) => {
              stdout += data.toString("utf8");
            });
            stream.stderr.on("data", (data: Buffer) => {
              stderr += data.toString("utf8");
            });
          });
        });

        client.on("error", reject);
        const base = { host: server.host, port: server.port, username: server.username };
        if (server.auth.method === "certificate") {
          client.connect({ ...base, privateKey: server.auth.keyPath });
        } else {
          deps.getPassword(alias).then(
            (password) => client.connect({ ...base, password }),
            reject,
          );
        }
      });
    },
  };
}
```

- [ ] **Step 6: Implement built-in tools**

```ts
// src/tools/builtins/systemd.ts
import { z } from "zod";
import type { ToolResult } from "../../types.js";
import type { RegisteredTool, ToolContext } from "../tool-registry.js";

interface Runner {
  run(alias: string, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const logsSchema = z.object({
  server: z.string(),
  unit: z.string().optional(),
  since: z.string(),
  lines: z.number(),
});

const statusSchema = z.object({
  server: z.string(),
  unit: z.string(),
});

function toToolResult(toolName: string, targetAlias: string, result: { exitCode: number; stdout: string; stderr: string }): ToolResult {
  const now = new Date().toISOString();
  return { toolName, targetAlias, startedAt: now, finishedAt: now, ...result };
}

export function createSystemdLogsTool(runner: Runner): RegisteredTool<z.infer<typeof logsSchema>> {
  return {
    name: "systemd.logs",
    description: "Read journal logs for a service or system",
    safety: "read-only",
    validateArgs: (input) => logsSchema.parse(input),
    async execute(args, context: ToolContext) {
      const argv = ["journalctl"];
      if (args.unit) argv.push("-u", args.unit);
      argv.push("--since", args.since, "-n", String(args.lines), "--no-pager");
      return toToolResult("systemd.logs", context.targetAlias, await runner.run(context.targetAlias, argv));
    },
  };
}

export function createSystemdStatusTool(runner: Runner): RegisteredTool<z.infer<typeof statusSchema>> {
  return {
    name: "systemd.status",
    description: "Read systemd service status",
    safety: "read-only",
    validateArgs: (input) => statusSchema.parse(input),
    async execute(args, context) {
      return toToolResult("systemd.status", context.targetAlias, await runner.run(context.targetAlias, ["systemctl", "status", args.unit, "--no-pager"]));
    },
  };
}
```

```ts
// src/tools/builtins/disk.ts
import { z } from "zod";
import type { RegisteredTool } from "../tool-registry.js";

interface Runner {
  run(alias: string, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const schema = z.object({ server: z.string(), path: z.string().default("/") });

export function createDiskUsageTool(runner: Runner): RegisteredTool<z.infer<typeof schema>> {
  return {
    name: "disk.usage",
    description: "Inspect disk usage",
    safety: "read-only",
    validateArgs: (input) => schema.parse(input),
    async execute(args, context) {
      const now = new Date().toISOString();
      const result = await runner.run(context.targetAlias, ["df", "-h", args.path]);
      return { toolName: "disk.usage", targetAlias: context.targetAlias, startedAt: now, finishedAt: now, ...result };
    },
  };
}
```

```ts
// src/tools/builtins/process.ts
import { z } from "zod";
import type { RegisteredTool } from "../tool-registry.js";

interface Runner {
  run(alias: string, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const schema = z.object({ server: z.string(), filter: z.string().optional() });

export function createProcessListTool(runner: Runner): RegisteredTool<z.infer<typeof schema>> {
  return {
    name: "process.list",
    description: "List processes",
    safety: "read-only",
    validateArgs: (input) => schema.parse(input),
    async execute(args, context) {
      const now = new Date().toISOString();
      const argv = args.filter ? ["pgrep", "-a", args.filter] : ["ps", "aux"];
      const result = await runner.run(context.targetAlias, argv);
      return { toolName: "process.list", targetAlias: context.targetAlias, startedAt: now, finishedAt: now, ...result };
    },
  };
}
```

- [ ] **Step 7: Run verification**

Run: `npm test -- tests/ssh/session-password-cache.test.ts tests/tools/builtins.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ssh/session-password-cache.ts src/ssh/ssh-executor.ts src/tools/shell-args.ts src/tools/builtins tests/ssh/session-password-cache.test.ts tests/tools/builtins.test.ts
git commit -m "feat: add ssh executor and read-only tools"
```

## Task 6: Memory Store and Session JSONL Audit Log

**Files:**
- Create: `src/memory/memory-store.ts`
- Create: `src/session/session-log.ts`
- Create: `tests/memory/memory-store.test.ts`
- Create: `tests/session/session-log.test.ts`

- [ ] **Step 1: Write memory redaction tests**

```ts
// tests/memory/memory-store.test.ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../src/memory/memory-store";

describe("memory store", () => {
  it("redacts secrets before writing server memory", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-memory-"));
    const memory = createMemoryStore(root);
    await memory.appendServerNote("prod-api", "password=secret token=abc123 nginx warning");
    const text = await readFile(join(root, ".dagent", "memory", "servers", "prod-api.md"), "utf8");
    expect(text).toContain("[REDACTED]");
    expect(text).toContain("nginx warning");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("abc123");
  });
});
```

- [ ] **Step 2: Write session log tests**

```ts
// tests/session/session-log.test.ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSessionLog } from "../../src/session/session-log";

describe("session log", () => {
  it("writes redacted JSONL events", async () => {
    const root = await mkdtemp(join(tmpdir(), "dagent-session-"));
    const log = await createSessionLog(root, new Date("2026-07-04T14:30:00Z"));
    await log.write({ type: "tool-result", output: "token=abc123\nservice ok" });
    const jsonl = await readFile(join(root, ".dagent", "sessions", "2026-07-04-143000.jsonl"), "utf8");
    expect(jsonl).toContain("\"type\":\"tool-result\"");
    expect(jsonl).toContain("[REDACTED]");
    expect(jsonl).not.toContain("abc123");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/memory/memory-store.test.ts tests/session/session-log.test.ts`

Expected: FAIL with import errors.

- [ ] **Step 4: Implement memory store**

```ts
// src/memory/memory-store.ts
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDagentPaths } from "../config/paths.js";

export function redactSecrets(text: string): string {
  return text
    .replace(/password=\\S+/gi, "password=[REDACTED]")
    .replace(/token=\\S+/gi, "token=[REDACTED]")
    .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\\s\\S]*?-----END [^-]+ PRIVATE KEY-----/g, "[REDACTED]");
}

export function createMemoryStore(root = process.cwd()) {
  const paths = getDagentPaths(root);
  return {
    async loadGlobal(): Promise<string> {
      try {
        return await readFile(join(paths.memoryDir, "global.md"), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
        throw error;
      }
    },
    async loadServer(alias: string): Promise<string> {
      try {
        return await readFile(join(paths.memoryDir, "servers", `${alias}.md`), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
        throw error;
      }
    },
    async appendServerNote(alias: string, note: string): Promise<void> {
      const dir = join(paths.memoryDir, "servers");
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, `${alias}.md`), `${redactSecrets(note)}\n`, "utf8");
    },
  };
}
```

- [ ] **Step 5: Implement session log**

```ts
// src/session/session-log.ts
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getDagentPaths } from "../config/paths.js";
import { redactSecrets } from "../memory/memory-store.js";

export type SessionEvent = Record<string, unknown> & { type: string };

function sessionFileName(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/T/, "-").slice(0, 15) + ".jsonl";
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value).slice(0, 20_000);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]));
  }
  return value;
}

export async function createSessionLog(root = process.cwd(), date = new Date()) {
  const paths = getDagentPaths(root);
  await mkdir(paths.sessionsDir, { recursive: true });
  const path = join(paths.sessionsDir, sessionFileName(date));
  return {
    path,
    async write(event: SessionEvent): Promise<void> {
      await appendFile(path, `${JSON.stringify(redactValue(event))}\n`, "utf8");
    },
  };
}
```

- [ ] **Step 6: Run verification**

Run: `npm test -- tests/memory/memory-store.test.ts tests/session/session-log.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/memory/memory-store.ts src/session/session-log.ts tests/memory/memory-store.test.ts tests/session/session-log.test.ts
git commit -m "feat: add memory and session logs"
```

## Task 7: LM Studio Client and Orchestrator Loop

**Files:**
- Create: `src/model/lm-studio-client.ts`
- Create: `src/model/system-prompt.ts`
- Create: `src/orchestrator/registration-classifier.ts`
- Create: `src/orchestrator/orchestrator.ts`
- Create: `tests/model/system-prompt.test.ts`
- Create: `tests/orchestrator/registration-classifier.test.ts`
- Create: `tests/orchestrator/orchestrator.test.ts`

- [ ] **Step 1: Write system prompt and classifier tests**

```ts
// tests/model/system-prompt.test.ts
import { describe, expect, it } from "vitest";
import { createSystemPrompt } from "../../src/model/system-prompt";

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
```

```ts
// tests/orchestrator/registration-classifier.test.ts
import { describe, expect, it } from "vitest";
import { classifyRegistrationPrompt } from "../../src/orchestrator/registration-classifier";

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
```

- [ ] **Step 2: Write orchestrator test**

```ts
// tests/orchestrator/orchestrator.test.ts
import { describe, expect, it, vi } from "vitest";
import { createOrchestrator } from "../../src/orchestrator/orchestrator";

describe("orchestrator", () => {
  it("runs a read-only tool call and returns a valid final report", async () => {
    const model = {
      complete: vi.fn()
        .mockResolvedValueOnce({
          type: "tool-call",
          toolName: "systemd.logs",
          args: { server: "prod-api", unit: "nginx.service", since: "10 minutes ago", lines: 100 },
        })
        .mockResolvedValueOnce({
          type: "message",
          content: "Summary\nChecked nginx logs.\nEvidence\njournalctl returned ok.\nConclusion\nNo immediate issue.\nNext Actions\nRun another read-only check if symptoms return.",
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
      serverStore: { load: vi.fn().mockResolvedValue({ alias: "prod-api" }) },
      memoryStore: { loadGlobal: vi.fn().mockResolvedValue(""), loadServer: vi.fn().mockResolvedValue("") },
      policy: { decide: vi.fn().mockReturnValue({ allowed: true, requiresApproval: false, reason: "Read-only tool allowed by default" }), modelContext: vi.fn().mockReturnValue("") },
      toolRegistry: { get: vi.fn().mockReturnValue({ name: "systemd.logs", safety: "read-only", validateArgs: (input: unknown) => input, execute }) },
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/model/system-prompt.test.ts tests/orchestrator/registration-classifier.test.ts tests/orchestrator/orchestrator.test.ts`

Expected: FAIL with import errors.

- [ ] **Step 4: Implement model client and system prompt**

```ts
// src/model/system-prompt.ts
export function createSystemPrompt(): string {
  return [
    "You are dagent, a terminal assistant for safe remote server operations.",
    "You cannot execute raw shell commands.",
    "You may only request registered tools provided in the tool schema.",
    "Do not ask for, reveal, persist, or infer SSH passwords, private keys, tokens, or secrets.",
    "Prefer read-only tools. State-changing tools require explicit operator approval.",
    "Destructive actions are blocked in version 1.",
    "Every completed request must end with these exact sections:",
    "Summary",
    "Evidence",
    "Conclusion",
    "Next Actions",
  ].join("\n");
}
```

```ts
// src/model/lm-studio-client.ts
import OpenAI from "openai";

export type ModelResponse =
  | { type: "message"; content: string }
  | { type: "tool-call"; toolName: string; args: unknown };

export interface ModelRequest {
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; name?: string }>;
  tools: Array<{ name: string; description: string; parameters: unknown }>;
}

export function createLmStudioClient(options: { baseURL?: string; apiKey?: string; model?: string }) {
  const client = new OpenAI({
    baseURL: options.baseURL ?? "http://localhost:1234/v1",
    apiKey: options.apiKey ?? "lm-studio",
  });
  const model = options.model ?? "local-model";

  return {
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const completion = await client.chat.completions.create({
        model,
        messages: request.messages,
        tools: request.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as Record<string, unknown>,
          },
        })),
      });
      const message = completion.choices[0]?.message;
      const toolCall = message?.tool_calls?.[0];
      if (toolCall?.type === "function") {
        return { type: "tool-call", toolName: toolCall.function.name, args: JSON.parse(toolCall.function.arguments) };
      }
      return { type: "message", content: message?.content ?? "" };
    },
  };
}
```

- [ ] **Step 5: Implement registration classifier**

```ts
// src/orchestrator/registration-classifier.ts
import { isSafeServerAlias } from "./prompt-target.js";

export type RegistrationClassification =
  | { matched: true; alias: string }
  | { matched: false };

export function classifyRegistrationPrompt(prompt: string): RegistrationClassification {
  const match = prompt.trim().match(/^add\s+remote\s+server\s+name\s+([a-zA-Z0-9._-]+)$/i);
  if (!match) return { matched: false };
  const alias = match[1];
  if (!isSafeServerAlias(alias)) {
    throw new Error("Invalid server alias");
  }
  return { matched: true, alias };
}
```

- [ ] **Step 6: Implement orchestrator**

```ts
// src/orchestrator/orchestrator.ts
import { createSystemPrompt } from "../model/system-prompt.js";
import { validateFinalReport, createFinalReportRepairPrompt } from "./final-report.js";
import { parsePromptTarget } from "./prompt-target.js";
import { classifyRegistrationPrompt } from "./registration-classifier.js";

export interface OrchestratorDeps {
  model: { complete(request: { messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; name?: string }>; tools: unknown[] }): Promise<{ type: "message"; content: string } | { type: "tool-call"; toolName: string; args: unknown }> };
  serverStore: { load(alias: string): Promise<unknown>; list(): Promise<string[]> };
  memoryStore: { loadGlobal(): Promise<string>; loadServer(alias: string): Promise<string> };
  policy: { decide(request: { toolName: string; safety: "read-only" | "state-changing" | "destructive"; targetAlias: string }): { allowed: boolean; requiresApproval: boolean; reason: string }; modelContext(targetAlias?: string): string };
  toolRegistry: { get(name: string): { name: string; safety: "read-only" | "state-changing" | "destructive"; validateArgs(input: unknown): unknown; execute(args: unknown, context: { targetAlias: string }): Promise<unknown> } };
  approvals: { approve(message: string): Promise<boolean> };
  sessionLog: { write(event: Record<string, unknown> & { type: string }): Promise<void> };
  registration: { run(alias: string): Promise<void> };
  render: { status(text: string): void; tool(text: string): void; report(text: string): void; error(text: string): void };
}

export function createOrchestrator(deps: OrchestratorDeps) {
  return {
    async handlePrompt(rawPrompt: string): Promise<void> {
      const registration = classifyRegistrationPrompt(rawPrompt);
      if (registration.matched) {
        await deps.registration.run(registration.alias);
        return;
      }

      const parsed = parsePromptTarget(rawPrompt);
      if (!parsed.targetAlias) {
        deps.render.error("Choose a server with /alias or register one with: add remote server name <alias>");
        return;
      }

      deps.render.status("Thinking: identify the right tool");
      try {
        await deps.serverStore.load(parsed.targetAlias);
      } catch (error) {
        const aliases = await deps.serverStore.list();
        const suffix = aliases.length > 0 ? ` Available aliases: ${aliases.join(", ")}` : " No servers are registered yet.";
        deps.render.error(`Unknown server alias: ${parsed.targetAlias}.${suffix}`);
        await deps.sessionLog.write({ type: "unknown-server", targetAlias: parsed.targetAlias, availableAliases: aliases });
        return;
      }
      const memory = [await deps.memoryStore.loadGlobal(), await deps.memoryStore.loadServer(parsed.targetAlias)].filter(Boolean).join("\n");
      const messages = [
        { role: "system" as const, content: createSystemPrompt() },
        { role: "system" as const, content: deps.policy.modelContext(parsed.targetAlias) },
        { role: "system" as const, content: memory },
        { role: "user" as const, content: parsed.prompt },
      ];

      const first = await deps.model.complete({ messages, tools: [] });
      if (first.type === "message") {
        deps.render.report(first.content);
        return;
      }

      const tool = deps.toolRegistry.get(first.toolName);
      const args = tool.validateArgs(first.args);
      const decision = deps.policy.decide({ toolName: tool.name, safety: tool.safety, targetAlias: parsed.targetAlias });
      if (!decision.allowed) {
        deps.render.error(decision.reason);
        await deps.sessionLog.write({ type: "policy-denial", toolName: tool.name, reason: decision.reason });
        return;
      }
      if (decision.requiresApproval) {
        const approved = await deps.approvals.approve(`Approval required: ${tool.name} on ${parsed.targetAlias}`);
        if (!approved) {
          deps.render.report("Summary\nExecution was skipped.\nEvidence\nThe operator declined approval.\nConclusion\nNo changes were made.\nNext Actions\nUse read-only checks or approve the action when ready.");
          return;
        }
      }

      deps.render.tool(`Tool: ${tool.name}\nTarget: ${parsed.targetAlias}`);
      const result = await tool.execute(args, { targetAlias: parsed.targetAlias });
      await deps.sessionLog.write({ type: "tool-result", toolName: tool.name, result });
      const final = await deps.model.complete({
        messages: [...messages, { role: "tool" as const, name: tool.name, content: JSON.stringify(result) }],
        tools: [],
      });

      if (final.type === "tool-call") {
        deps.render.error("Model requested another tool after result; run a new prompt for additional checks.");
        return;
      }

      const validation = validateFinalReport(final.content);
      if (validation.ok) {
        deps.render.report(final.content);
        return;
      }

      const repaired = await deps.model.complete({
        messages: [...messages, { role: "assistant" as const, content: createFinalReportRepairPrompt(final.content, validation.missingSections) }],
        tools: [],
      });
      deps.render.report(repaired.type === "message" ? repaired.content : final.content);
    },
  };
}
```

- [ ] **Step 7: Run verification**

Run: `npm test -- tests/model/system-prompt.test.ts tests/orchestrator/registration-classifier.test.ts tests/orchestrator/orchestrator.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/model src/orchestrator/registration-classifier.ts src/orchestrator/orchestrator.ts tests/model tests/orchestrator/registration-classifier.test.ts tests/orchestrator/orchestrator.test.ts
git commit -m "feat: add model client and orchestrator loop"
```

## Task 8: Terminal Wiring, Approvals, Hidden Passwords, and End-to-End CLI

**Files:**
- Modify: `src/app/terminal-app.ts`
- Modify: `src/cli.ts`
- Create: `tests/app/terminal-app.test.ts`
- Create: `tests/cli-wiring.test.ts`

- [ ] **Step 1: Write terminal behavior tests**

```ts
// tests/app/terminal-app.test.ts
import { describe, expect, it, vi } from "vitest";
import { createTerminalApp } from "../../src/app/terminal-app";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/terminal-app.test.ts`

Expected: FAIL because `createTerminalApp` does not catch orchestrator errors.

- [ ] **Step 3: Update terminal app rendering**

```ts
// src/app/terminal-app.ts
export interface PromptInput {
  question(prompt: string): Promise<string>;
  close(): void;
}

export interface TerminalOutput {
  write(text: string): void;
}

export interface PromptOrchestrator {
  handlePrompt(prompt: string): Promise<void>;
}

export interface TerminalAppDeps {
  input: PromptInput;
  output: TerminalOutput;
  orchestrator: PromptOrchestrator;
}

export function createTerminalApp(deps: TerminalAppDeps) {
  return {
    async run(): Promise<void> {
      deps.output.write("dagent\n");
      while (true) {
        const prompt = await deps.input.question("> ");
        const trimmed = prompt.trim();
        if (trimmed === "exit" || trimmed === "quit") {
          deps.input.close();
          return;
        }
        if (trimmed.length === 0) continue;
        try {
          await deps.orchestrator.handlePrompt(trimmed);
        } catch (error) {
          deps.output.write(`Error: ${(error as Error).message}\n`);
        }
      }
    },
  };
}
```

- [ ] **Step 4: Wire real CLI dependencies**

```ts
// src/cli.ts
#!/usr/bin/env node
import { confirm, input as askText, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import { stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { stdin as stdinStream } from "node:process";
import { createTerminalApp } from "./app/terminal-app.js";
import { createLmStudioClient } from "./model/lm-studio-client.js";
import { createMemoryStore } from "./memory/memory-store.js";
import { createOrchestrator } from "./orchestrator/orchestrator.js";
import { createPolicyEngine } from "./policy/policy-engine.js";
import { runRegistrationFlow } from "./server/registration-flow.js";
import { createServerStore } from "./server/server-store.js";
import { createSessionLog } from "./session/session-log.js";
import { createSessionPasswordCache } from "./ssh/session-password-cache.js";
import { createSshExecutor } from "./ssh/ssh-executor.js";
import { createDiskUsageTool } from "./tools/builtins/disk.js";
import { createProcessListTool } from "./tools/builtins/process.js";
import { createSystemdLogsTool, createSystemdStatusTool } from "./tools/builtins/systemd.js";
import { createToolRegistry } from "./tools/tool-registry.js";

const program = new Command();

program
  .name("dagent")
  .description("Interactive terminal assistant for safe remote server operations")
  .option("--lm-studio-url <url>", "LM Studio OpenAI-compatible base URL", "http://localhost:1234/v1")
  .option("--model <model>", "LM Studio model name", "local-model")
  .action(async (options: { lmStudioUrl: string; model: string }) => {
    const readline = createInterface({ input: stdinStream, output: stdout });
    const serverStore = createServerStore(process.cwd());
    const memoryStore = createMemoryStore(process.cwd());
    const policy = await createPolicyEngine(process.cwd());
    const sessionLog = await createSessionLog(process.cwd());
    const passwordCache = createSessionPasswordCache();
    const ssh = createSshExecutor({
      loadServer: serverStore.load,
      async getPassword(alias) {
        const cached = passwordCache.get(alias);
        if (cached) return cached;
        const value = await password({ message: `SSH password for ${alias}:` });
        passwordCache.set(alias, value);
        return value;
      },
    });
    const toolRegistry = createToolRegistry([
      createSystemdLogsTool(ssh),
      createSystemdStatusTool(ssh),
      createDiskUsageTool(ssh),
      createProcessListTool(ssh),
    ]);
    const model = createLmStudioClient({ baseURL: options.lmStudioUrl, model: options.model });
    const orchestrator = createOrchestrator({
      model,
      serverStore,
      memoryStore,
      policy,
      toolRegistry,
      approvals: {
        approve: (message) => confirm({ message, default: false }),
      },
      sessionLog,
      registration: {
        run: (alias) => runRegistrationFlow({
          alias,
          prompts: {
            text: (message, promptOptions) => askText({ message, default: promptOptions?.default }),
            select: (message, choices) => select({ message, choices: choices.map((choice) => ({ name: choice, value: choice })) }),
            confirm: (message, promptOptions) => confirm({ message, default: promptOptions?.default }),
          },
          serverStore,
          connectionTester: {
            async test(testAlias) {
              stdout.write(`Running connection test for ${testAlias}...\n`);
              await ssh.run(testAlias, ["true"]);
              stdout.write("Connection test passed.\n");
            },
          },
        }).then(() => undefined),
      },
      render: {
        status: (text) => stdout.write(`${text}\n`),
        tool: (text) => stdout.write(`${text}\n`),
        report: (text) => stdout.write(`${text}\n`),
        error: (text) => stdout.write(`Error: ${text}\n`),
      },
    });

    const app = createTerminalApp({
      input: readline,
      output: { write: (text) => stdout.write(text) },
      orchestrator,
    });
    await app.run();
  });

await program.parseAsync();
```

- [ ] **Step 5: Run verification**

Run: `npm test -- tests/app/terminal-app.test.ts tests/cli-smoke.test.ts`

Expected: PASS.

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS and `dist/cli.js` exists.

- [ ] **Step 6: Commit**

```bash
git add src/app/terminal-app.ts src/cli.ts tests/app/terminal-app.test.ts tests/cli-wiring.test.ts
git commit -m "feat: wire interactive dagent cli"
```

## Task 9: Error Handling Coverage and Milestone Documentation

**Files:**
- Create: `tests/orchestrator/error-handling.test.ts`
- Create: `README.md`
- Modify: `src/orchestrator/orchestrator.ts`

- [ ] **Step 1: Write error handling tests**

```ts
// tests/orchestrator/error-handling.test.ts
import { describe, expect, it, vi } from "vitest";
import { createOrchestrator } from "../../src/orchestrator/orchestrator";

function baseDeps(overrides: Record<string, unknown> = {}) {
  const render = { status: vi.fn(), tool: vi.fn(), report: vi.fn(), error: vi.fn() };
  return {
    model: { complete: vi.fn() },
    serverStore: { load: vi.fn() },
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
      model: { complete: vi.fn().mockResolvedValue({ type: "tool-call", toolName: "systemd.restart", args: { server: "prod-api" } }) },
      serverStore: { load: vi.fn().mockResolvedValue({ alias: "prod-api" }) },
      policy: { decide: vi.fn().mockReturnValue({ allowed: true, requiresApproval: true, reason: "State-changing tool requires approval" }), modelContext: vi.fn().mockReturnValue("") },
      toolRegistry: { get: vi.fn().mockReturnValue({ name: "systemd.restart", safety: "state-changing", validateArgs: (input: unknown) => input, execute: vi.fn() }) },
      approvals: { approve: vi.fn().mockResolvedValue(false) },
    });
    const orchestrator = createOrchestrator(deps);
    await orchestrator.handlePrompt("/prod-api restart nginx");
    expect(deps.render.report).toHaveBeenCalledWith(expect.stringContaining("operator declined approval"));
  });
});
```

- [ ] **Step 2: Run tests to verify behavior**

Run: `npm test -- tests/orchestrator/error-handling.test.ts`

Expected: PASS. If it fails because an error path is missing, update `src/orchestrator/orchestrator.ts` to make the tested behavior pass.

- [ ] **Step 3: Add README milestone instructions**

```md
<!-- README.md -->
# dagent

`dagent` is an interactive terminal assistant for operating remote servers through safe, typed tools.

## Requirements

- Node.js 22 or newer
- LM Studio running an OpenAI-compatible API at `http://localhost:1234/v1`
- SSH access to registered servers

## Start

```bash
npm install
npm run build
npm run dev
```

## Register a Server

```text
> add remote server name dytruong-remote
```

Certificate authentication stores only the key path. Password authentication stores `prompt-per-session` and prompts with hidden input the first time SSH is needed.

## Run a Read-Only Check

```text
> /prod-api get systemd logs 10 minutes ago
```

## Safety Model

- The model never receives raw shell access.
- Tools are typed and locally validated.
- Read-only tools are allowed by default.
- State-changing tools require approval.
- Destructive tools are blocked in version 1.
- Passwords, SSH private keys, tokens, and secrets are not persisted.

## Final Report Format

Every completed request is rendered with:

- Summary
- Evidence
- Conclusion
- Next Actions
```

- [ ] **Step 4: Run final verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md src/orchestrator/orchestrator.ts tests/orchestrator/error-handling.test.ts
git commit -m "docs: document dagent milestone"
```

## Self-Review

Spec coverage:
- Interactive terminal app: Task 1 and Task 8.
- LM Studio connection: Task 7 and Task 8.
- Guided server registration: Task 3 and Task 8.
- Server config loading and secret-free writing: Task 3.
- SSH execution layer: Task 5.
- Visible tool traces and status rendering: Task 7 and Task 8.
- Approval flow: Task 7, Task 8, and Task 9.
- Built-in tools `systemd.logs`, `systemd.status`, `disk.usage`, `process.list`: Task 4 and Task 5.
- Local file-backed memory and redaction: Task 6.
- `rules/` loading and authoritative policy: Task 4.
- Session JSONL event writing: Task 6.
- Final response validation and repair: Task 2 and Task 7.
- Error handling for unknown targets, approvals, model/report failures, policy denial, and registration validation: Tasks 2, 3, 4, 7, and 9.

Placeholder scan:
- No task uses undefined path names.
- No task relies on arbitrary raw shell execution.
- No task stores passwords, private keys, tokens, or full raw logs.
- No task defers required milestone behavior outside this plan.

Type consistency:
- `ServerConfig`, `ToolResult`, `ToolSafety`, and `PolicyDecision` are introduced in Task 2 and reused consistently.
- `createToolRegistry`, `RegisteredTool`, and built-in tool factories share the same executor shape.
- The orchestrator dependency interface names match the CLI wiring in Task 8.
