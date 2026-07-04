#!/usr/bin/env bash
set -euo pipefail

DAGENT_REPO_URL="${DAGENT_REPO_URL:-https://github.com/dytruong/dagent.git}"
DAGENT_INSTALL_DIR="${DAGENT_INSTALL_DIR:-"$HOME/.dagent/dagent"}"
DAGENT_BIN_DIR="${DAGENT_BIN_DIR:-"$HOME/.local/bin"}"

info() {
  printf 'dagent installer: %s\n' "$1"
}

fail() {
  printf 'dagent installer: %s\n' "$1" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

choose_provider() {
  if [ -n "${DAGENT_PROVIDER:-}" ]; then
    printf '%s\n' "$DAGENT_PROVIDER"
    return
  fi

  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    {
      printf 'Choose local model provider:\n'
      printf '  1) LM Studio (default, http://localhost:1234/v1)\n'
      printf '  2) Ollama (http://localhost:11434/v1)\n'
      printf 'Provider [1]: '
    } > /dev/tty
    IFS= read -r provider_choice < /dev/tty
    case "${provider_choice:-1}" in
      1 | lm-studio | lmstudio | LM\ Studio) printf 'lm-studio\n' ;;
      2 | ollama | Ollama) printf 'ollama\n' ;;
      *) fail "unknown provider choice: $provider_choice" ;;
    esac
    return
  fi

  printf 'lm-studio\n'
}

provider="$(choose_provider)"

case "$provider" in
  lm-studio | lmstudio)
    provider="lm-studio"
    default_base_url="http://localhost:1234/v1"
    default_model="local-model"
    ;;
  ollama)
    default_base_url="http://localhost:11434/v1"
    default_model="llama3.1"
    ;;
  *)
    fail "DAGENT_PROVIDER must be 'lm-studio' or 'ollama'"
    ;;
esac

base_url="${DAGENT_BASE_URL:-$default_base_url}"
model="${DAGENT_MODEL:-$default_model}"
launcher_path="$DAGENT_BIN_DIR/dagent"

need_command git
need_command node
need_command npm

mkdir -p "$DAGENT_INSTALL_DIR" "$DAGENT_BIN_DIR"

if [ -d "$DAGENT_INSTALL_DIR/.git" ]; then
  info "updating existing checkout at $DAGENT_INSTALL_DIR"
  git -C "$DAGENT_INSTALL_DIR" pull --ff-only
else
  if [ -n "$(find "$DAGENT_INSTALL_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
    fail "$DAGENT_INSTALL_DIR exists and is not an empty git checkout"
  fi
  info "cloning $DAGENT_REPO_URL into $DAGENT_INSTALL_DIR"
  git clone "$DAGENT_REPO_URL" "$DAGENT_INSTALL_DIR"
fi

info "installing npm dependencies"
npm --prefix "$DAGENT_INSTALL_DIR" install

info "building dagent"
npm --prefix "$DAGENT_INSTALL_DIR" run build

cat > "$launcher_path" <<EOF
#!/usr/bin/env bash
exec node "$DAGENT_INSTALL_DIR/dist/cli.js" --lm-studio-url "$base_url" --model "$model" "\$@"
EOF
chmod +x "$launcher_path"

info "installed launcher at $launcher_path"
info "provider: $provider"
info "base URL: $base_url"
info "model: $model"

case ":$PATH:" in
  *":$DAGENT_BIN_DIR:"*) ;;
  *) info "add $DAGENT_BIN_DIR to PATH to run 'dagent' from any shell" ;;
esac
