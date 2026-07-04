import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createServerStore } from "../../src/server/server-store.js";

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
