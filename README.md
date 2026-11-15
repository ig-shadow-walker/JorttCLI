<h1 align="center">jortt</h1>

<p align="center">
  <b>The Jortt bookkeeping API on your command line, built so AI agents can do the books without surprises.</b>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="docs/setup.md">Setup guide</a> ·
  <a href="docs/setup.md#install-with-an-ai-agent">Install with an AI agent</a> ·
  <a href="#what-it-can-do">What it can do</a> ·
  <a href="skill/jortt/reference.md">Command reference</a> ·
  <a href="LICENSE">MIT license</a>
</p>

---

`jortt` is an unofficial, open-source command-line tool for [Jortt](https://www.jortt.nl), the Dutch
bookkeeping app. It covers every endpoint of Jortt's current API: invoices, estimates, customers,
expenses, receipts, payments, payroll, projects and reports. It also comes with a
[Claude skill](skill/jortt/SKILL.md) that teaches Claude Code (or any agent that runs shell commands)
how to use it well.

```console
$ jortt invoices list --status unpaid --fields invoice_number,customer_company_name,invoice_due_amount
invoice_number  customer_company_name  invoice_due_amount
--------------  ---------------------  ------------------
2026-041        Bakkerij de Vries      1250.00 EUR
2026-044        Studio Noord           380.00 EUR
(2 rows)
```

> Not affiliated with or endorsed by Jortt. You connect it to your own administration with your own API
> credentials.

## Why

- **Nothing changes by accident.** Reading runs straight away. Anything that would change your books
  comes back as a *plan* first: what it will send, which invoice or customer it touches, and a warning when
  it emails a customer or deletes something. Only `jortt apply <plan-id>` sends it, once, within 15 minutes.
- **The whole API.** Every Jortt v3 endpoint has a command. The options, required fields and help text are
  generated from Jortt's own API documentation, so they follow the API rather than someone's memory of it.
- **Made for agents and scripts.** `--json` returns a stable `{ok, data, meta}` envelope, exit codes have
  fixed meanings, `--fields` and `--limit` keep answers small, and `--all` pages through everything.
- **Your credentials stay yours.** The setup wizard asks for them in your terminal and stores them in one file
  that only you can read. They never go in the project, in a chat or in a command line.
- **One file to install.** A single binary for macOS and Linux, with no runtime to install, set up by a wizard.

## Quick start

**1. Create an API app in Jortt.** Log in to Jortt and open the
[OAuth applications page](https://app.jortt.nl/new_profile/api/jortt/oauth_applications/list). Register an
app of the **client credentials** type, tick the scopes you want, and keep the Client ID and Secret at hand.
The [setup guide](docs/setup.md#1-create-an-api-app-in-jortt) explains each scope.

**2. Install** (macOS or Linux; on Windows, use WSL):

```sh
curl -fsSL https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.sh | sh
```

**3. Answer the setup wizard.** It starts by itself after the install, and you can rerun it any time
with `jortt setup`:

```text
Client ID: 3f9c2a…
Client Secret (hidden): ****************************
Checking with Jortt…
Install the Claude skill, so Claude Code knows how to use jortt? [Y/n]

✓ Connected to Bakkerij de Vries.
✓ Saved to ~/.config/jortt/credentials (only you can read it).
✓ Claude skill installed in ~/.claude/skills/jortt.
```

**4. Use it.**

```sh
jortt whoami
jortt invoices list --status unpaid
jortt reports pnl --year 2026 --quarter 3
```

Or ask Claude Code: *"Which of my Jortt invoices are late?"*

Want an AI agent to do the install for you? See
[Install with an AI agent](docs/setup.md#install-with-an-ai-agent).

## How changes work: plan, then apply

Here is what happens when you (or an agent) ask for a change:

```console
$ jortt labels create --description "Q4 campaign" --json
{
  "ok": true,
  "data": {
    "planMade": true,
    "planId": "21f579c682",
    "summary": "Create a label (description=Q4 campaign)",
    "dangerous": [],
    "wouldSend": { "method": "POST", "url": "https://api.jortt.nl/v3/labels", "body": { "description": "Q4 campaign" } },
    "expiresAt": "2026-11-15T10:26:04.770Z",
    "toApply": "jortt apply 21f579c682"
  }
}
$ echo $?
2
$ jortt apply 21f579c682      # now it is sent
```

- A plan for an existing record also shows a `target`: the invoice, customer or expense it changes, read from
  Jortt, so you can check it's the right one.
- `dangerous` lists what can't be undone, such as sending an invoice to a customer (a sent invoice is final),
  deleting a record, or booking a payment.
- A plan expires after 15 minutes and works once. `jortt plans list` shows the open ones, and
  `jortt plans discard <id>` throws one away.

The Claude skill tells the agent to show you the plan and to apply it only after you say yes in the
conversation.

## What it can do

| Area | Commands | Examples |
|---|---|---|
| Invoices | `invoices` | list, create, send (email or Peppol), credit, copy, download the PDF, labels |
| Estimates | `estimates` | create, send, accept or reject, turn into an invoice, download |
| Customers | `customers` | list and search, create, update, archive, VAT rates, direct debit request |
| Expenses | `expenses` | book costs, income and balance items on a ledger account; attach a receipt |
| Receipts & inbox | `inbox`, `receipts` | upload receipt images to the Jortt inbox; list and download receipts |
| Payments | `payments`, `bank` | mark an invoice or expense as paid; list bank accounts and transactions |
| Ledger | `ledger-accounts`, `labels` | the ledger accounts to book on; labels |
| Projects | `projects` | projects and their hour and cost registrations; invoice a project |
| Payroll | `payroll` | payroll journal entries (loonjournaalposten) |
| Reports | `reports` | profit and loss, balance, VAT (BTW) summary, cash and bank |
| Everything else | `api`, `endpoints`, `describe` | call any endpoint directly; search and explain the full catalog |

`jortt <group> --help` lists a group's commands. `jortt <group> <command> --help` lists every option, and
for changes every field you can send, with `*` marking the required ones. The
[command reference](skill/jortt/reference.md) has all of it on one page.

**What the Jortt API doesn't offer**, so neither does jortt: importing or categorizing bank transactions,
free-form journal entries (memoriaalboekingen), filing the VAT return, closing a year, and changing settings.
You still do those in the Jortt app.

## Using it with AI agents

jortt is designed to be driven by an agent:

- **Claude Code:** `jortt setup` (or `jortt skill install`) puts the skill in `~/.claude/skills/jortt`. Claude
  uses it whenever you mention Jortt, invoices, offertes, BTW and so on, in English or Dutch.
- **Other agents** (Codex, Cursor, Gemini CLI, your own): anything that can run shell commands can use jortt.
  Give it the skill as instructions, with `jortt skill install --dir <folder>` or by pointing it at
  [SKILL.md](skill/jortt/SKILL.md).

What the skill makes the agent do:

- Use `--json` and read the exit code.
- Look up ids instead of guessing them.
- Show you every plan, and apply it only after you say yes in the conversation.
- Never chain an `apply` onto another command.
- Never ask you for the Client Secret.

Jortt also runs an official [MCP server](https://developer.jortt.nl) for AI assistants. If your assistant
speaks MCP and you're happy with it, use that. jortt is for when you want the plan-and-apply step in front
of every change, want to script your bookkeeping, or use an agent that runs commands instead of speaking MCP.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | OK |
| 1 | Error: bad input, or Jortt rejected the request (details in `error.details`) |
| 2 | A plan was made; nothing was sent |
| 3 | Not set up, or the credentials were rejected: run `jortt setup` |
| 4 | Your Jortt app lacks the scope for this, or you lack permission |
| 5 | Jortt is unavailable, throttled or timed out (a change may or may not have happened) |
| 6 | Not found |

## Security and privacy

- **Credentials** live in `~/.config/jortt/credentials`, readable only by you (mode 600). The access token is
  cached next to them in `token.json`, also mode 600, and renewed automatically.
- **Only Jortt is contacted:** `api.jortt.nl` and Jortt's login server at `app.jortt.nl`. jortt refuses to send
  your token anywhere else. There is no telemetry.
- **No secrets in commands.** The Client Secret is typed into a hidden prompt, or piped in with
  `--client-secret-stdin`, so it doesn't end up in your shell history or an agent's transcript.
- **Downloads are verified.** The installer checks every binary against the release's `SHA256SUMS` and refuses
  one that doesn't match.
- **Least privilege:** your Jortt app only needs the scopes for what you use. A read-only app (only `:read`
  scopes) works fine for reporting.

Found a security problem? Please report it privately through GitHub's
[security advisories](https://github.com/ig-shadow-walker/JorttCLI/security/advisories/new) rather than in a
public issue.

## Configuration

Everything is configured by `jortt setup`; you normally don't need anything below.

| Variable | What it does |
|---|---|
| `JORTT_CLIENT_ID`, `JORTT_CLIENT_SECRET`, `JORTT_SCOPES`, `JORTT_ORGANIZATION_ID` | Override the saved credentials, e.g. in CI or a container |
| `JORTT_CONFIG_DIR` | Use another folder than `~/.config/jortt` |
| `JORTT_OUTPUT=json` | Always print JSON, as if `--json` were given |
| `CLAUDE_SKILLS_DIR` | Where `jortt skill install` puts the skill (default `~/.claude/skills`) |

## Development

You need [Bun](https://bun.sh) 1.3 or newer.

```sh
git clone https://github.com/ig-shadow-walker/JorttCLI.git
cd JorttCLI
bun install
bun run dev -- --help            # run from source
bun test                         # tests run against a fake Jortt; no network, no credentials
bun run typecheck
bun run build                    # a single binary for this machine in dist/jortt
bun run install:local            # build it, install it in ~/.local/bin and link the skill
```

How it fits together:

| Path | What |
|---|---|
| `src/cli.ts` | Entry point |
| `catalog/endpoints.json` | Every Jortt v3 endpoint with its parameters, generated by `bun run sync-docs` |
| `src/registry.ts` | Friendly command names for the catalog's endpoints |
| `src/commands/` | Builds the commands, options and help from the catalog |
| `src/runtime.ts` | Reads, plans and apply |
| `src/http.ts`, `src/auth.ts` | API client (throttling, retries, paging) and OAuth token |
| `src/setup.ts`, `src/prompt.ts` | The setup wizard |
| `skill/jortt/` | The Claude skill; `reference.md` is generated by `bun run reference` |
| `install.sh`, `scripts/build-release.ts` | The installer and the release build |

When Jortt changes its API, run `bun run sync-docs`, then `bun test`. The tests check that every command
still points at a real endpoint and that the skill's reference matches the CLI.

### Releasing

```sh
bun run build:release            # binaries for 6 platforms + install.sh + SHA256SUMS in dist/release/
gh release create v0.1.0 dist/release/* --title v0.1.0
```

Bump `version` in `package.json` first. The one-line installer always fetches the latest release.

## Contributing

Issues and pull requests are welcome. Please run `bun test` and `bun run typecheck` before opening a PR, and
never include real credentials or real administration data in issues, tests or fixtures.

## License

[MIT](LICENSE). Jortt is a trademark of its owner; this project is independent and unofficial.
