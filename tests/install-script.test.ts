import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const installScriptPath = join(process.cwd(), "scripts", "install.sh");

function readInstallScript() {
  return readFileSync(installScriptPath, "utf8");
}

describe("curl installer script", () => {
  it("is an executable bash script with strict failure handling", () => {
    const script = readInstallScript();
    const mode = statSync(installScriptPath).mode;

    expect(script.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(script).toContain("set -euo pipefail");
    expect(mode & 0o111).not.toBe(0);
  });

  it("supports clone-based installation paths and repository overrides", () => {
    const script = readInstallScript();

    expect(script).toContain("DAGENT_REPO_URL");
    expect(script).toContain("github.com");
    expect(script).toContain("DAGENT_INSTALL_DIR");
    expect(script).toContain(".dagent/dagent");
    expect(script).toContain("DAGENT_BIN_DIR");
    expect(script).toContain(".local/bin");
    expect(script).toContain("git clone");
    expect(script).toContain("pull --ff-only");
    expect(script).toContain('npm --prefix "$DAGENT_INSTALL_DIR" install');
    expect(script).toContain('npm --prefix "$DAGENT_INSTALL_DIR" run build');
  });

  it("defaults to LM Studio and supports Ollama provider selection", () => {
    const script = readInstallScript();

    expect(script).toContain("DAGENT_PROVIDER");
    expect(script).toContain("/dev/tty");
    expect(script).toContain("lm-studio");
    expect(script).toContain("ollama");
    expect(script).toContain("http://localhost:1234/v1");
    expect(script).toContain("http://localhost:11434/v1");
    expect(script).toContain("local-model");
    expect(script).toContain("llama3.1");
    expect(script).toContain("DAGENT_BASE_URL");
    expect(script).toContain("DAGENT_MODEL");
  });

  it("writes a dagent launcher that passes configured model endpoint flags", () => {
    const script = readInstallScript();

    expect(script).toContain('cat > "$launcher_path"');
    expect(script).toContain("dist/cli.js");
    expect(script).toContain("--lm-studio-url");
    expect(script).toContain("--model");
    expect(script).toContain('"\\$@"');
    expect(script).toContain('chmod +x "$launcher_path"');
  });

  it("does not persist provider API keys or secrets", () => {
    const script = readInstallScript();

    expect(script).not.toMatch(/DAGENT_API_KEY/);
    expect(script).not.toMatch(/OPENAI_API_KEY/);
    expect(script).not.toMatch(/apiKey=/);
  });
});
