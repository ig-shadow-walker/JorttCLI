# Setup guide

This guide takes you from nothing to a working `jortt` connected to your own Jortt administration, in
about five minutes. If you'd rather have an AI agent do the install, skip to
[Install with an AI agent](#install-with-an-ai-agent).

**Contents**

1. [Create an API app in Jortt](#1-create-an-api-app-in-jortt)
2. [Install jortt](#2-install-jortt)
3. [Run the setup wizard](#3-run-the-setup-wizard)
4. [Check that it works](#4-check-that-it-works)
5. [Connect your AI agent](#5-connect-your-ai-agent)
- [Install with an AI agent](#install-with-an-ai-agent)
- [Servers and CI](#servers-and-ci)
- [Updating, changing and removing](#updating-changing-and-removing)
- [Troubleshooting](#troubleshooting)

**What you need**

- A Jortt account with access to the administration you want to connect.
- macOS or Linux. On Windows, install [WSL](https://learn.microsoft.com/windows/wsl/install) and run
  everything inside it.
- A terminal. The setup asks for your Client Secret in a hidden prompt, so it needs a real terminal.

Your credentials are entered in your own terminal and saved on your own computer. They don't go in this
project, in a config file you edit by hand, or in a chat with an AI.

## 1. Create an API app in Jortt

jortt talks to Jortt as an *API app* that you register for your own administration. Jortt calls this the
**client credentials** type ("for your own app").

1. Log in to Jortt.
2. Open the [OAuth applications page](https://app.jortt.nl/new_profile/api/jortt/oauth_applications/list).
3. Register a new application of the **client credentials** type.
4. Tick the scopes jortt may use (see the table below).
5. Save the app and copy its **Client ID** and **Client Secret**. You will paste them into the setup wizard in
   step 3. Treat the secret like a password.

**Which scopes to tick**

Tick only what you'll use. You can add scopes later; run `jortt setup` again afterwards.

| Scope | Needed for |
|---|---|
| `organizations:read` | `jortt whoami`, and for the wizard to show which administration you connected to. Recommended |
| `customers:read`, `customers:write` | Looking up customers; creating and updating them |
| `invoices:read`, `invoices:write` | Listing and downloading invoices; creating, sending and crediting them |
| `estimates:read`, `estimates:write` | Estimates (offertes) |
| `expenses:read`, `expenses:write` | Expenses, receipts, and the ledger accounts to book them on |
| `inbox:write` | Uploading receipts to the Jortt inbox |
| `reports:read` | Profit and loss, balance, VAT (BTW) and cash reports |
| `payroll:read`, `payroll:write` | Payroll journal entries (loonjournaalposten) |
| `financing:read` | Bank accounts and transactions |
| `reconciling:read`, `reconciling:write` | Listing payments; marking invoices and expenses as paid |

Jortt doesn't publish an exact map of which endpoint needs which scope, so this table is a guide. If a command
fails with exit code 4 ("missing scope"), add the matching scope to the app and run `jortt setup` again.

> **Just looking?** Tick only the `:read` scopes. jortt can then read and report but can't change anything in
> Jortt, whatever an agent tries.

## 2. Install jortt

Run this in your terminal:

```sh
curl -fsSL https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.sh | sh
```

The installer:

- picks the build for your system (macOS Apple silicon or Intel, Linux x64 or arm64, glibc or musl);
- checks it against the release's `SHA256SUMS`, and stops if it doesn't match;
- puts it in `~/.local/bin/jortt`, and adds that folder to your PATH in your shell's startup file if needed;
- starts the setup wizard (step 3).

Options go after `sh -s --`:

```sh
curl -fsSL https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.sh | sh -s -- --no-setup
```

| Option | What it does |
|---|---|
| `--version v0.2.0` | Install a specific release instead of the latest |
| `--dir <path>` | Install somewhere else than `~/.local/bin` |
| `--no-setup` | Don't start the wizard; run `jortt setup` yourself later |
| `--no-modify-path` | Don't touch your shell's startup file |

<details>
<summary><b>Prefer to look before you run it?</b></summary>

Download the script, read it, then run it:

```sh
curl -fsSLO https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.sh
less install.sh
sh install.sh
```

Or skip the script: download the binary for your system (`jortt-darwin-arm64`, `jortt-linux-x64`, …) and
`SHA256SUMS` from the [latest release](https://github.com/ig-shadow-walker/JorttCLI/releases/latest), check it
with `shasum -a 256 -c SHA256SUMS --ignore-missing`, make it executable with `chmod +x`, and move it onto your
PATH as `jortt`.

</details>

<details>
<summary><b>Build from source</b></summary>

With [Bun](https://bun.sh) 1.3 or newer:

```sh
git clone https://github.com/ig-shadow-walker/JorttCLI.git
cd JorttCLI
bun install
bun run install:local    # builds dist/jortt, copies it to ~/.local/bin, links the Claude skill
jortt setup
```

</details>

## 3. Run the setup wizard

The installer starts it for you. Otherwise, or to change anything later, run:

```sh
jortt setup
```

It asks two questions, checks your answers with Jortt, and saves them:

```text
Jortt CLI setup

This connects the `jortt` command to your Jortt administration. You need the Client ID and
Client Secret of the API app registered for it in Jortt (see https://developer.jortt.nl).
They are stored on this computer only, in a file only you can read.

Client ID: 3f9c2a…
Client Secret (hidden): ****************************
Checking with Jortt…
Install the Claude skill, so Claude Code knows how to use jortt? [Y/n] y

✓ Connected to Bakkerij de Vries.
✓ Saved to /Users/you/.config/jortt/credentials (only you can read it).
✓ Claude skill installed in /Users/you/.claude/skills/jortt.

You're set. Try:
  jortt invoices list --status unpaid
```

What happens along the way:

- **Wrong Client ID or Secret?** Jortt says so and the wizard asks again. Nothing is saved until it works.
- **Fewer scopes than jortt can use?** The wizard tests each scope, keeps the ones your app has, and tells you
  which commands won't work without the others.
- **Access to more than one administration?** It asks which one, by Organization ID.
- **Ran it before?** It offers to keep the saved credentials, so you can rerun it just to check the
  connection or reinstall the skill.
- **Cancelled with Ctrl-C?** Nothing is saved.

Your answers go to `~/.config/jortt/credentials`, a file only your user can read (mode 600).

## 4. Check that it works

```sh
jortt auth test       # gets a fresh token and reads your administration
jortt whoami          # the administration you're connected to
jortt auth status     # which credentials file and scopes are used (no network)
```

Then try something real:

```sh
jortt invoices list --status unpaid
jortt customers list --query bakkerij
jortt reports summary btw
```

## 5. Connect your AI agent

**Claude Code.** If you said yes to the skill in the wizard, you're done. Open Claude Code anywhere and ask
something like *"What did I invoice last quarter in Jortt?"* To install or refresh the skill later:

```sh
jortt skill install
```

**Other agents.** Any agent that can run shell commands can use jortt. Give it the instructions in the skill:

```sh
jortt skill install --dir <folder your agent reads skills or instructions from>
```

Or point it at [`skill/jortt/SKILL.md`](../skill/jortt/SKILL.md) and the
[command reference](../skill/jortt/reference.md).

---

## Install with an AI agent

You can let an AI coding agent (Claude Code, Codex, Cursor, Gemini CLI, …) install jortt for you. It does
everything **except entering your credentials**. You do that yourself, in your own terminal, so the Client
Secret never passes through the agent or its chat history.

**Give your agent this prompt:**

```text
Install the jortt CLI on this machine by following the "Instructions for AI agents" in
https://github.com/ig-shadow-walker/JorttCLI/blob/main/docs/setup.md
Don't ask me for my Jortt Client Secret. When it's time, tell me to run `jortt setup` in my own terminal.
```

The agent installs jortt and the skill, then asks you to run `jortt setup`. Do that in a terminal window (not
in the agent's chat), answer the two questions, and tell the agent you're done. It checks the connection and
you're ready.

### Instructions for AI agents

Follow these steps in order. Run each command yourself; don't ask the user to run anything except `jortt setup`.

1. **Check the system.** Run `uname -s` and `uname -m`. jortt supports macOS (`Darwin`) and Linux on `x86_64`
   or `arm64`/`aarch64`. On Windows, stop and tell the user to install WSL and run you inside it.

2. **Install the binary, without the wizard.** The wizard needs the user's keyboard, and the Client Secret must
   not pass through you:

   ```sh
   curl -fsSL https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.sh | sh -s -- --no-setup
   ```

   It installs to `~/.local/bin/jortt`. Your current shell may not have that on its PATH yet, so use the full
   path in the next steps.

3. **Check it runs:**

   ```sh
   ~/.local/bin/jortt --version
   ```

4. **Install the skill.** For Claude Code:

   ```sh
   ~/.local/bin/jortt skill install
   ```

   For another agent, install it where that agent reads skills or instructions:
   `~/.local/bin/jortt skill install --dir <folder>`. Then read the installed `SKILL.md`; it explains how to use
   jortt safely.

5. **Hand over to the user for the credentials.** Tell them, in your own words:

   > jortt is installed. To connect it to your Jortt administration, open a terminal window and run
   > `jortt setup` (or `~/.local/bin/jortt setup` if the command isn't found yet). It asks for the Client ID
   > and Client Secret of your Jortt API app. If you don't have one yet, create one at
   > https://app.jortt.nl/new_profile/api/jortt/oauth_applications/list (type: client credentials).
   > Let me know when it's done.

   Then wait for the user.

6. **Verify the connection:**

   ```sh
   ~/.local/bin/jortt auth test --json
   ```

   `"ok": true` with an `organization` means it's ready; tell the user which administration is connected.
   Exit code 3 means setup hasn't been completed; ask the user to run `jortt setup` again. Exit code 4 means the
   Jortt app lacks a scope; tell them which (from `error.hint`).

**Rules while installing:**

- Never ask for the Client Secret, and never run `jortt setup` with credentials on the user's behalf.
- If the user pastes the secret into the chat anyway, don't use it. Suggest they generate a new secret for the
  app in Jortt, because the old one is now in a chat transcript.
- Don't change anything in Jortt during the install. After it, every change jortt makes goes through
  plan-and-apply: show the user the plan and apply it only after a clear yes.

---

## Servers and CI

Where nobody can type into a prompt, give jortt the credentials without the wizard.

**Option 1: setup with the secret on stdin**, for example from a password manager or a secrets store:

```sh
op read "op://Finance/Jortt/client-secret" | jortt setup --client-id "$JORTT_CLIENT_ID" --client-secret-stdin --no-skill --json
```

This checks the credentials and saves them to `~/.config/jortt/credentials`, exactly like the wizard.

**Option 2: environment variables**, which override the saved file and are handy in containers:

```sh
export JORTT_CLIENT_ID=…          # from your CI's secret store
export JORTT_CLIENT_SECRET=…
export JORTT_SCOPES="invoices:read reports:read"   # optional; defaults to every scope jortt uses
jortt auth test --json
```

Don't pass the secret as a command-line argument: it would end up in shell history and process lists.

## Updating, changing and removing

| To… | Run |
|---|---|
| Update jortt | Run the install command again. Your credentials and skill are kept. |
| Change credentials or scopes | `jortt setup` |
| Refresh the Claude skill after an update | `jortt skill install` |
| Connect a second administration | `JORTT_CONFIG_DIR=~/.config/jortt-other jortt setup`, then prefix commands with the same `JORTT_CONFIG_DIR=…` |
| Forget the cached token | `jortt auth clear` |
| Uninstall | `rm ~/.local/bin/jortt && rm -r ~/.config/jortt ~/.claude/skills/jortt`, and remove the PATH line the installer added to your shell's startup file (marked `# Added by the jortt installer`) |

To revoke access completely, also delete the API app in Jortt.

## Troubleshooting

| Problem | What to do |
|---|---|
| `jortt: command not found` | Open a new terminal so the PATH change takes effect, or run `~/.local/bin/jortt`. |
| "Jortt did not accept that Client ID and Secret" | Copy both again from the app in Jortt. Make sure it's a **client credentials** app. |
| "Your Jortt app doesn't have every scope jortt asks for" | Not an error: the wizard continues with the scopes your app has. Add more in Jortt and rerun `jortt setup` to unlock the rest. |
| A command fails with exit code 4 | The app lacks the scope for it. Add it in Jortt, then run `jortt setup`. |
| The wizard asks for an Organization ID | Your credentials reach more than one administration. Use the ID of the one you want; after setup, `jortt organizations list` shows them all. |
| "Setup needs a Client ID" | `jortt setup` ran without a keyboard attached (for example from an agent). Run it in a terminal window, or see [Servers and CI](#servers-and-ci). |
| "checksum mismatch" during install | The download was damaged or tampered with, and nothing was installed. Try again; if it keeps happening, open an issue. |
| Windows | Use [WSL](https://learn.microsoft.com/windows/wsl/install) and install inside it. |

Still stuck? Run the failing command with `-v` to see the HTTP requests (your secret and token are never
printed), and open an issue with the output and the error message.
