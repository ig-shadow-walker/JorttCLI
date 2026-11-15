#!/bin/sh
# Installs the jortt CLI and starts its setup.
#
#   curl -fsSL https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.sh | sh
#
# Options (after `sh -s --`), or the matching environment variables:
#   --version <tag>     a specific release, e.g. v0.2.0          (JORTT_VERSION, default: latest)
#   --dir <path>        where the binary goes                    (JORTT_INSTALL_DIR, default: ~/.local/bin)
#   --no-setup          don't start `jortt setup` afterwards     (JORTT_NO_SETUP=1)
#   --no-modify-path    don't add the folder to your shell's PATH (JORTT_NO_MODIFY_PATH=1)
# JORTT_DOWNLOAD_URL replaces the GitHub release URL, for hosting the files elsewhere.
#
# Running it again updates jortt to the latest release and keeps your credentials.

set -eu

REPO="ig-shadow-walker/JorttCLI"

say() { printf '%s\n' "$*"; }
fail() { printf 'jortt install: %s\n' "$*" >&2; exit 1; }

# Everything runs inside main, so a download cut off halfway can't run half a script.
main() {
  version="${JORTT_VERSION:-latest}"
  dir="${JORTT_INSTALL_DIR:-$HOME/.local/bin}"
  setup=1
  [ -n "${JORTT_NO_SETUP:-}" ] && setup=0
  modify_path=1
  [ -n "${JORTT_NO_MODIFY_PATH:-}" ] && modify_path=0

  while [ $# -gt 0 ]; do
    case "$1" in
      --version) [ $# -ge 2 ] || fail "--version needs a value"; version="$2"; shift 2 ;;
      --dir) [ $# -ge 2 ] || fail "--dir needs a value"; dir="$2"; shift 2 ;;
      --no-setup) setup=0; shift ;;
      --no-modify-path) modify_path=0; shift ;;
      -h|--help) say "Options: --version <tag>  --dir <path>  --no-setup  --no-modify-path"; exit 0 ;;
      *) fail "unknown option: $1" ;;
    esac
  done

  asset="jortt-$(detect_platform)"

  if [ -n "${JORTT_DOWNLOAD_URL:-}" ]; then
    base="${JORTT_DOWNLOAD_URL%/}"
  elif [ "$version" = "latest" ]; then
    base="https://github.com/$REPO/releases/latest/download"
  else
    base="https://github.com/$REPO/releases/download/$version"
  fi

  tmp=$(mktemp -d 2>/dev/null || mktemp -d -t jortt)
  trap 'rm -rf "$tmp"' EXIT INT TERM

  say "Downloading $asset ($version)…"
  download "$base/$asset" "$tmp/jortt" || fail "could not download $base/$asset"
  download "$base/SHA256SUMS" "$tmp/SHA256SUMS" || fail "could not download $base/SHA256SUMS"

  expected=$(awk -v f="$asset" '$2 == f || $2 == "*"f { print $1 }' "$tmp/SHA256SUMS")
  [ -n "$expected" ] || fail "$asset is not listed in SHA256SUMS"
  actual=$(sha256 "$tmp/jortt")
  [ "$expected" = "$actual" ] || fail "checksum mismatch for $asset (expected $expected, got $actual); not installing"

  mkdir -p "$dir"
  chmod 755 "$tmp/jortt"
  # Move into place in one step, so a jortt that is running keeps working.
  mv -f "$tmp/jortt" "$dir/jortt.new"
  mv -f "$dir/jortt.new" "$dir/jortt"
  if [ "$(uname -s)" = "Darwin" ]; then
    xattr -d com.apple.quarantine "$dir/jortt" 2>/dev/null || true
  fi

  installed=$("$dir/jortt" --version 2>/dev/null) || fail "$dir/jortt was installed but does not run on this machine"
  say "Installed jortt $installed in $dir/jortt"

  case ":$PATH:" in
    *":$dir:"*) ;;
    *)
      if [ "$modify_path" = 1 ]; then add_to_path "$dir"; else say "Note: $dir is not on your PATH."; fi
      ;;
  esac

  if [ "$setup" = 1 ]; then
    # `curl | sh` gives this script the download as stdin, so the wizard reads the keyboard from /dev/tty.
    if [ -r /dev/tty ] && (exec </dev/tty) 2>/dev/null; then
      say ""
      PATH="$dir:$PATH" "$dir/jortt" setup </dev/tty || say "Setup didn't finish. Run \`jortt setup\` any time to try again."
    else
      say "Next: run \`jortt setup\` in a terminal to connect your Jortt administration."
    fi
  else
    say "Next: run \`jortt setup\` to connect your Jortt administration."
  fi
}

detect_platform() {
  os=$(uname -s)
  arch=$(uname -m)
  case "$os" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    MINGW*|MSYS*|CYGWIN*) fail "on Windows, use the PowerShell installer: powershell -ExecutionPolicy Bypass -c \"iex ((New-Object Net.WebClient).DownloadString('https://github.com/$REPO/releases/latest/download/install.ps1'))\"" ;;
    *) fail "unsupported system: $os" ;;
  esac
  case "$arch" in
    arm64|aarch64) arch=arm64 ;;
    x86_64|amd64) arch=x64 ;;
    *) fail "unsupported processor: $arch" ;;
  esac
  # An Intel shell on Apple silicon (Rosetta) still gets the native build.
  if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
    arch=arm64
  fi
  if [ "$os" = linux ] && { [ -f /etc/alpine-release ] || ldd --version 2>&1 | grep -qi musl; }; then
    arch="$arch-musl"
  fi
  printf '%s-%s' "$os" "$arch"
}

download() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$2" "$1"
  else
    fail "needs curl or wget"
  fi
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{ print $1 }'
  else
    fail "needs sha256sum or shasum to check the download"
  fi
}

add_to_path() {
  line="export PATH=\"$1:\$PATH\""
  case "$(basename "${SHELL:-sh}")" in
    zsh) rc="${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) if [ "$(uname -s)" = Darwin ]; then rc="$HOME/.bash_profile"; else rc="$HOME/.bashrc"; fi ;;
    fish)
      rc="$HOME/.config/fish/conf.d/jortt.fish"
      line="fish_add_path \"$1\""
      mkdir -p "$(dirname "$rc")"
      ;;
    *) rc="$HOME/.profile" ;;
  esac
  if [ -f "$rc" ] && grep -qF "$line" "$rc"; then
    :
  else
    printf '\n# Added by the jortt installer\n%s\n' "$line" >>"$rc"
    say "Added $1 to your PATH in $rc"
  fi
  say "Open a new terminal (or run: $line) so the jortt command is found."
}

main "$@"
