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
