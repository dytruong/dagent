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

function shellQuote(arg: string): string {
  return `'${arg.replaceAll("'", "'\\''")}'`;
}

export function createSshExecutor(deps: SshExecutorDeps) {
  return {
    async run(alias: string, argv: string[]): Promise<RemoteCommandResult> {
      const server = await deps.loadServer(alias);
      const command = argv.map(shellQuote).join(" ");

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
