#!/usr/bin/env node
import { Command } from "commander";
import { stdout as output, stdin as input } from "node:process";
import { createInterface } from "node:readline/promises";
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
