# dagent Terminal Design

## Goal

Build `dagent`, an interactive terminal assistant for operating remote servers through safe, typed tools. The CLI should feel similar to Codex CLI or Claude CLI: the user opens a session, types natural-language prompts, sees the assistant reason through the request, watches tool calls execute, approves risky actions, and receives a structured operational report.

Example prompt:

```text
/prod-api get systemd logs 10 minutes ago
```

The assistant uses LM Studio as its model backend. It must not receive direct shell control. It can only request registered tools, and the local CLI executes those tools over SSH after validating policy.

## Non-Goals

- Do not install a daemon on remote servers in the first version.
- Do not expose arbitrary raw shell execution in the first version.
- Do not store secrets, SSH keys, tokens, or large raw logs in memory.
- Do not build a web dashboard before the terminal workflow is useful.

## User Experience

The user starts the assistant with:

```text
dagent
```

The app opens an interactive chat-style terminal. Prompts can target a server by prefixing a configured server alias:

```text
> /prod-api get systemd logs 10 minutes ago
```

For read-only requests, the CLI runs the necessary tools without confirmation:

```text
Thinking: identify the right log tool
Tool: systemd.logs
Target: prod-api
Args: since="10 minutes ago"

Running over SSH...
```

For state-changing requests, the CLI requires approval before execution:

```text
Tool: systemd.restart
Target: prod-api
Args: unit="nginx"

Approval required: restart service nginx on prod-api
Proceed? [y/N]
```

The terminal should show:

- assistant status text
- selected tool name
- target server
- validated tool arguments
- approval prompts when required
- streamed or progressive tool output
- final structured report

### Server Registration Flow

The user can register a remote server from the same prompt interface:

```text
> add remote server name dytruong-remote
```

The assistant should recognize this as an onboarding action and start a guided registration flow:

```text
Register remote server: dytruong-remote
Username:
Port [22]:
DNS name or IP address:
Authentication method: password or certificate?
```

If the user chooses certificate authentication, the CLI asks for the private key path:

```text
Certificate path:
```

The server config stores the alias, host, username, port, authentication method, and certificate path. It must not copy the private key into `.dagent/` or session logs.

If the user chooses password authentication, the CLI must not save the password as base64. Base64 is reversible encoding, not encryption, and would expose the password to anyone who can read the config or session files. The safer version 1 behavior is:

- prompt for the password using hidden input when an SSH tool first needs it
- keep the password only in process memory for the current app session
- never send the password to LM Studio
- never write the password to memory files, config files, or JSONL session logs

If persistent password reuse is needed later, the CLI should integrate with the operating system credential store, such as macOS Keychain, Windows Credential Manager, or Linux Secret Service. SSH keys plus `ssh-agent` should be the recommended long-term authentication method.

After successful registration, the assistant should offer a read-only connection test:

```text
Server dytruong-remote registered.
Run a connection test now? [Y/n]
```

The test should verify that SSH connects and basic read-only commands can run. It should not run diagnostics beyond connectivity unless the user asks.

## Final Response Contract

Every completed request must end with these sections:

```text
Summary
Short plain-English explanation of what happened.

Evidence
Concrete facts from tool outputs, with timestamps, service names, log snippets, command results, or metrics.

Conclusion
The assistant's best interpretation of the evidence, including confidence when useful.

Next Actions
Recommended follow-up actions, clearly separating safe read-only checks from actions that require approval.
```

The system prompt should require this format. The CLI should also validate the final answer before rendering it. If one or more sections are missing, the orchestrator should ask the model to repair the response using the existing tool results, without re-running tools.

## Architecture

### Terminal UI

The terminal UI owns the interactive REPL and rendering. It should support chat history, streamed assistant messages, tool-call panels, approvals, and concise status updates.

The UI should keep the operator aware of what the assistant is doing without hiding execution behind a single spinner.

### LM Studio Client

The model client connects to LM Studio through its OpenAI-compatible API. It sends:

- the system prompt
- applicable rules
- relevant memory
- server context
- available tool schemas
- the current user prompt
- recent session context

The client receives assistant messages and tool-call requests.

### Agent Orchestrator

The orchestrator owns the loop:

1. Parse the server target from the prompt.
2. Load relevant rules and memory.
3. Send request context and tool schemas to LM Studio.
4. Receive a tool call or assistant message.
5. Validate the tool call against schema and policy.
6. Ask for user approval when required.
7. Execute the approved tool over SSH.
8. Send tool results back to the model.
9. Render the final response using the required report format.

The orchestrator is the safety boundary. The model can request actions, but the orchestrator decides whether they can run.

### Tool Registry

Tools are typed actions with schemas, descriptions, safety metadata, and implementations. The first version should include:

- `systemd.logs`: read journal logs for a unit or the whole system
- `systemd.status`: read service status
- `disk.usage`: inspect disk usage
- `process.list`: list processes

Later tools can include:

- `systemd.restart`
- `systemd.reload`
- `docker.ps`
- `docker.logs`
- `file.tail`
- `nginx.configtest`

Each tool must declare whether it is read-only or state-changing. State-changing tools require approval by default.

### SSH Executor

The SSH executor connects to configured servers using the SSH protocol and runs tool implementation commands. It should not accept arbitrary command strings from the model.

Tool implementations translate validated arguments into safe commands. For example, `systemd.logs` can translate:

```json
{
  "server": "prod-api",
  "unit": "nginx.service",
  "since": "10 minutes ago",
  "lines": 300
}
```

into a safe `journalctl` invocation with validated arguments.

### Policy Engine

The policy engine loads human-editable rules from `rules/` and enforces them locally before tools execute.

Initial layout:

```text
rules/
  global.md
  tools.yaml
  servers/
    prod-api.md
```

Rules can describe allowed actions, denied actions, approval requirements, and server-specific constraints. They should be included in the model context, but the local policy engine must be authoritative.

Initial policy:

- Read-only tools are allowed by default.
- State-changing tools require approval.
- Destructive tools are blocked in version 1. This includes deleting files, wiping disks, changing firewall rules, editing SSH access, rotating secrets, stopping critical services, rebooting servers, and running package upgrades.
- Raw shell is unavailable in version 1.

### Memory Store

The memory store persists useful operational context across sessions. It should be local and file-backed in the first version.

Initial layout:

```text
.dagent/
  memory/
    global.md
    servers/
      prod-api.md
  sessions/
    2026-07-04-143000.jsonl
```

Memory may store:

- server aliases and known services
- operator preferences
- explicit notes the user asks the assistant to remember
- previous diagnostic findings
- summaries of useful past sessions
- recurring command patterns

Memory must not store:

- SSH private keys
- passwords
- tokens
- full raw logs by default
- large command outputs
- secrets discovered in output

Session logs should be structured JSONL audit trails containing prompts, model messages, tool calls, approvals, tool results, and final summaries.

### Server Config

Server configuration maps aliases to SSH connection details:

```text
servers/
  dytruong-remote.yaml
  prod-api.yaml
```

Each server config should include alias, host, SSH username, port, authentication method, optional certificate path, and optional metadata such as environment, region, known services, and tags. Secrets should not be stored in these files.

Example certificate-backed config:

```yaml
alias: dytruong-remote
host: dytruong.example.com
username: deploy
port: 22
auth:
  method: certificate
  keyPath: ~/.ssh/dytruong_remote
tags:
  - personal
```

Example password-backed config:

```yaml
alias: dytruong-remote
host: 203.0.113.10
username: deploy
port: 22
auth:
  method: password
  storage: prompt-per-session
```

The password-backed config records only the authentication strategy. The password itself is entered through hidden input when needed and stays in process memory for the active session.

## Data Flow

For `/prod-api get systemd logs 10 minutes ago`:

1. Terminal UI accepts the prompt.
2. Orchestrator extracts `prod-api` as the target server.
3. Orchestrator loads `prod-api` config, applicable rules, and memory.
4. LM Studio receives the prompt plus tool schemas and context.
5. Model requests `systemd.logs`.
6. Policy engine confirms this is read-only and allowed.
7. SSH executor runs the tool implementation on `prod-api`.
8. Tool output streams back into the terminal and model context.
9. Model returns a final report with Summary, Evidence, Conclusion, and Next Actions.
10. Orchestrator validates the report sections and renders it.

For `add remote server name dytruong-remote`:

1. Terminal UI accepts the prompt.
2. Orchestrator classifies the prompt as server registration.
3. CLI asks for username, port, host, and authentication method.
4. CLI asks for certificate path when certificate authentication is selected.
5. CLI records `prompt-per-session` when password authentication is selected.
6. Server config is written without secrets.
7. CLI offers a read-only SSH connection test.
8. Successful test output is summarized and may be saved as non-secret server memory.

## Error Handling

- Unknown server alias: show available aliases and do not call the model unless useful.
- Duplicate server alias during registration: ask whether to update the existing server config or cancel.
- Invalid server alias: reject names that cannot be used as `/alias` prompt targets or safe filenames.
- Invalid certificate path: explain that the key file was not found or is unreadable and ask for a new path.
- Password authentication selected: use hidden input and never echo, log, send to the model, or persist the password.
- SSH connection failure: return a clear failure report with attempted host, error class, and safe next checks.
- Tool validation failure: reject the tool call and ask the model to repair arguments.
- Policy denial: explain which rule blocked the action and suggest allowed alternatives.
- Approval declined: stop execution and summarize what was skipped.
- Missing final report sections: ask the model to repair the final response using existing evidence.
- LM Studio unavailable: show connection settings and retry guidance.

## Testing Strategy

Initial tests should cover:

- prompt target parsing
- server registration prompt classification
- server registration config writing without secrets
- duplicate and invalid server alias handling
- server config loading
- password hidden-input flow with no persisted secret
- certificate path validation
- rules loading and policy decisions
- tool schema validation
- read-only tool execution path with a mocked SSH executor
- approval-required path for mutating tools
- final report section validation
- memory redaction rules
- session JSONL event writing

Integration tests can use a mocked SSH server or local container once the core flow is stable.

## First Milestone

The first useful version should include:

- interactive terminal app
- LM Studio connection
- guided remote server registration
- server config loading
- SSH execution layer
- visible tool traces
- approval flow
- `systemd.logs`
- `systemd.status`
- `disk.usage`
- `process.list`
- local file-backed memory
- `rules/` loading and local enforcement
- final response validation for Summary, Evidence, Conclusion, and Next Actions

This milestone produces a usable operator assistant while keeping the system small enough to reason about and test.
