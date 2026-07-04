# dagent

`dagent` is an interactive terminal assistant for operating remote servers through safe, typed tools.

## Requirements

- Node.js 22 or newer
- LM Studio running an OpenAI-compatible API at `http://localhost:1234/v1`
- SSH access to registered servers

## Install

Install from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/dytruong/dagent/main/scripts/install.sh | bash
```

The installer clones `dagent` into `~/.dagent/dagent`, runs `npm install` and `npm run build`, then writes a launcher to `~/.local/bin/dagent`.

LM Studio is the default provider:

```bash
curl -fsSL https://raw.githubusercontent.com/dytruong/dagent/main/scripts/install.sh \
  | DAGENT_PROVIDER=lm-studio DAGENT_MODEL=local-model bash
```

Use Ollama instead:

```bash
curl -fsSL https://raw.githubusercontent.com/dytruong/dagent/main/scripts/install.sh \
  | DAGENT_PROVIDER=ollama DAGENT_MODEL=llama3.1 bash
```

If `dagent` is not found after installation, add `~/.local/bin` to your `PATH`.

Installer settings:

- `DAGENT_PROVIDER`: `lm-studio` or `ollama`
- `DAGENT_BASE_URL`: OpenAI-compatible API base URL
- `DAGENT_MODEL`: model name
- `DAGENT_INSTALL_DIR`: checkout directory, default `~/.dagent/dagent`
- `DAGENT_BIN_DIR`: launcher directory, default `~/.local/bin`
- `DAGENT_REPO_URL`: git repository URL, default `https://github.com/dytruong/dagent.git`

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
