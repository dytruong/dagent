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
