# dagent

`dagent` is an interactive terminal assistant for operating remote servers through safe, typed tools.

## Requirements

- Node.js 22 or newer
- LM Studio running an OpenAI-compatible API at `http://localhost:1234/v1`
- SSH access to registered servers

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
