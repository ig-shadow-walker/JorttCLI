#!/bin/sh
# Installs the built binary and the Claude skill for this user only. Nothing is uploaded anywhere.
#   bun run install:local
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN_DIR="${JORTT_BIN_DIR:-$HOME/.local/bin}"
SKILL_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
CONFIG_DIR="${JORTT_CONFIG_DIR:-$HOME/.config/jortt}"

[ -x "$ROOT/dist/jortt" ] || { echo "dist/jortt is missing; run 'bun run build' first" >&2; exit 1; }

mkdir -p "$BIN_DIR"
cp "$ROOT/dist/jortt" "$BIN_DIR/jortt"
chmod 755 "$BIN_DIR/jortt"
echo "binary:  $BIN_DIR/jortt"

mkdir -p "$SKILL_DIR"
if [ -e "$SKILL_DIR/jortt" ] && [ ! -L "$SKILL_DIR/jortt" ]; then
  echo "skill:   $SKILL_DIR/jortt exists and is not a link; leaving it alone" >&2
else
  ln -sfn "$ROOT/skill/jortt" "$SKILL_DIR/jortt"
  echo "skill:   $SKILL_DIR/jortt -> $ROOT/skill/jortt"
fi

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [ -e "$CONFIG_DIR/.env" ] || [ -L "$CONFIG_DIR/.env" ]; then
  echo "config:  $CONFIG_DIR/.env already exists; left as is"
elif [ -f "$ROOT/.env" ]; then
  ln -s "$ROOT/.env" "$CONFIG_DIR/.env"
  echo "config:  $CONFIG_DIR/.env -> $ROOT/.env"
else
  cp "$ROOT/.env.example" "$CONFIG_DIR/.env"
  chmod 600 "$CONFIG_DIR/.env"
  echo "config:  created $CONFIG_DIR/.env from .env.example; fill in your credentials"
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "note:    $BIN_DIR is not on your PATH" ;;
esac
echo "next:    jortt setup   (asks for the credentials; or fill .env and run: jortt auth test)"
