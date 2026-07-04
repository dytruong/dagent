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

  const config: ServerConfig =
    authMethod === "certificate"
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
