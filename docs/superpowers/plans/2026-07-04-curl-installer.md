# Curl Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curl-style installer that installs `dagent` from GitHub, defaults to LM Studio, and lets users choose Ollama.

**Architecture:** A POSIX shell installer owns clone/update/build/link behavior and writes a launcher into a user bin directory. Vitest coverage treats the installer as a distributable artifact and verifies provider defaults, non-interactive environment variables, and safety properties. README documents interactive and non-interactive usage.

**Tech Stack:** Bash, Git, Node.js/npm, Vitest, TypeScript.

---

### Task 1: Installer Contract Tests

**Files:**
- Create: `tests/install-script.test.ts`
- Later create: `scripts/install.sh`

- [ ] **Step 1: Write the failing test**

Create `tests/install-script.test.ts` with tests that read `scripts/install.sh` and assert it supports `DAGENT_PROVIDER`, `DAGENT_BASE_URL`, `DAGENT_MODEL`, `DAGENT_INSTALL_DIR`, `DAGENT_BIN_DIR`, `DAGENT_REPO_URL`, defaults to LM Studio, supports Ollama defaults, writes a launcher, and avoids persisting secrets.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/install-script.test.ts`

Expected: FAIL because `scripts/install.sh` does not exist.

### Task 2: Installer Script

**Files:**
- Create: `scripts/install.sh`

- [ ] **Step 1: Implement the minimal installer**

Create an executable Bash script that:
- sets `set -euo pipefail`
- defaults `DAGENT_REPO_URL` to the project GitHub URL
- defaults `DAGENT_INSTALL_DIR` to `$HOME/.dagent/dagent`
- defaults `DAGENT_BIN_DIR` to `$HOME/.local/bin`
- prompts for provider when `DAGENT_PROVIDER` is unset and stdin is interactive
- defaults non-interactive provider to `lm-studio`
- maps `lm-studio` to `http://localhost:1234/v1` and `local-model`
- maps `ollama` to `http://localhost:11434/v1` and `llama3.1`
- honors `DAGENT_BASE_URL` and `DAGENT_MODEL`
- clones or updates the repo
- runs `npm install` and `npm run build`
- writes `$DAGENT_BIN_DIR/dagent` launcher that invokes `node "$DAGENT_INSTALL_DIR/dist/cli.js" --lm-studio-url "$BASE_URL" --model "$MODEL" "$@"`

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/install-script.test.ts`

Expected: PASS.

### Task 3: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document install usage**

Add a curl install section showing:
- interactive install
- LM Studio non-interactive install
- Ollama non-interactive install
- PATH note for `~/.local/bin`
- configurable env vars

- [ ] **Step 2: Run focused tests and build**

Run:
- `npm test -- tests/install-script.test.ts`
- `npm run build`

Expected: both commands exit 0.

### Self-Review

- Spec coverage: clone-based curl installer, LM Studio default, Ollama option, env overrides, launcher, and docs are covered.
- Placeholder scan: no placeholders remain.
- Type consistency: file paths and environment variable names match across tasks.
