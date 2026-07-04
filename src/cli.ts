#!/usr/bin/env node
import { confirm, input as askText, password, select } from "@inquirer/prompts";
import { Command } from "commander";
import { stdout } from "node:process";
import { stdin as stdinStream } from "node:process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
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
        run: (alias) =>
          runRegistrationFlow({
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await program.parseAsync();
}
