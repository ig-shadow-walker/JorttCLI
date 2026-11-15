#!/bin/sh
# Installs the built binary and the Claude skill for this user only. Nothing is uploaded anywhere.
#   bun run install:local
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BIN_DIR="${JORTT_BIN_DIR:-$HOME/.local/bin}"
SKILL_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

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

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "note:    $BIN_DIR is not on your PATH" ;;
esac
echo "next:    jortt setup"
