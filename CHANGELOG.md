# Changelog

## 0.2.0

**Windows support.** jortt now runs natively on Windows 10 (1809 or newer) and Windows 11, on x64 and ARM64.

- **New Windows installer.** One line in PowerShell:

  ```powershell
  powershell -ExecutionPolicy Bypass -c "iex ((New-Object Net.WebClient).DownloadString('https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.ps1'))"
  ```

  It verifies the download against `SHA256SUMS`, installs to `%LOCALAPPDATA%\Programs\jortt` without administrator
  rights, adds that folder to your user PATH, and starts `jortt setup`. Running it again updates jortt.
- **Windows paths.** Credentials are stored in `%APPDATA%\jortt\credentials`; the Claude skill goes to
  `%USERPROFILE%\.claude\skills\jortt`.
- **New release files:** `jortt-windows-x64.exe`, `jortt-windows-arm64.exe` and `install.ps1`.
- **Easier setup when the hidden prompt can't work.** If a terminal can't read hidden input, `jortt setup` now explains
  how to pipe the secret in instead, e.g. `Get-Clipboard | jortt setup --client-id <id> --client-secret-stdin`.
- **Better PATH check.** It understands Windows PATH syntax and shows Windows instructions when the install folder
  isn't on your PATH.
- On Git Bash, `install.sh` now points to the PowerShell installer.
- The Claude skill tells agents on Windows PowerShell to pass JSON bodies with `--data-file`, because Windows
  PowerShell 5.1 strips the quotes inside `--data '{…}'`.

Also new:

- CI runs the tests on Linux, macOS and Windows, and installs a local build with `install.sh` and `install.ps1`, the
  way users do.
- The setup guide and README cover Windows: install, manual download with a hash check, uninstall, troubleshooting,
  and installing through an AI agent.
- `scripts/serve-release.ts` serves a local build, to try the installers without publishing anything.

## 0.1.0

First release.

- A command for every endpoint of the Jortt v3 API, generated from Jortt's API documentation.
- Plan and apply: every change is shown as a plan first and sent only with `jortt apply <plan-id>`.
- `jortt setup`: a wizard that asks for your Client ID and Secret, checks them with Jortt, works out which scopes your
  app has, and saves them to a private credentials file.
- A Claude skill (`jortt skill install`) that teaches Claude Code and other agents to use jortt safely.
- A one-line installer for macOS and Linux that verifies every download.
