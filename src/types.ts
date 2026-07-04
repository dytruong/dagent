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
