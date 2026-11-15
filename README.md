# jortt CLI

A command-line tool for the [Jortt API](https://developer.jortt.nl/), built so AI agents (Claude Code)
can do bookkeeping work safely, plus a Claude skill that teaches them how.

- Every v3 endpoint is reachable: friendly commands for the common ones, and `jortt api` for the rest.
- Options, required fields and help text are generated from a catalog parsed from the Jortt docs.
- Reads run straight away. **Writes never send on the first call**: they return a plan (exit code 2)
  that only `jortt apply <plan-id>` sends, once, within 15 minutes.
- `--json` gives a stable `{ok, data, meta}` / `{ok:false, error}` envelope and fixed exit codes.

## Install

On macOS or Linux (Windows: use WSL), one line:

```sh
curl -fsSL https://github.com/ig-shadow-walker/JorttCLI/releases/latest/download/install.sh | sh
```

It downloads the binary for your machine, checks it against `SHA256SUMS`, puts it in `~/.local/bin`
(adding that to your PATH if needed), and starts the setup wizard:

1. Asks for the **Client ID** and **Client Secret** of your Jortt API app (the secret is hidden as you type).
2. Checks them with Jortt. Wrong ones are asked again. If the app lacks some of the scopes jortt uses,
   it finds out which ones it has and continues with those.
3. Shows which administration it connected to, and saves everything to `~/.config/jortt/.env` (mode 600).
4. Offers to install the Claude skill in `~/.claude/skills/jortt`.

Run `jortt setup` again any time to change the credentials. Running the installer again updates jortt.
Installer options go after `sh -s --`: `--version v0.2.0`, `--dir <path>`, `--no-setup`, `--no-modify-path`.

Unattended (CI, password manager):

```sh
op read op://Finance/Jortt/secret | jortt setup --client-id <id> --client-secret-stdin --json
```

To remove jortt: delete `~/.local/bin/jortt`, `~/.config/jortt` and `~/.claude/skills/jortt`.

## Usage

```sh
jortt invoices list --status unpaid --all --json --fields invoice_number,customer_company_name,invoice_due_amount
jortt customers list --query acme
jortt reports pnl --year 2026 --quarter 3
jortt invoices download <id> --out invoice.pdf

jortt labels create --description "Q4 campaign"   # -> plan, exit 2
jortt apply <plan-id>                             # -> sends it

jortt endpoints send invoice                      # search every endpoint
jortt describe send-invoice-v3                    # params and body fields
jortt api GET /v3/invoices -q invoice_status=late
```

`jortt --help`, `jortt <group> --help` and `jortt <group> <command> --help` list everything; the help of
a write command lists all body fields. [skill/jortt/reference.md](skill/jortt/reference.md) has it all
on one page.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | OK |
| 1 | Error (bad input, validation, 422) |
| 2 | Plan made; nothing was sent |
| 3 | Credentials missing or rejected |
| 4 | Missing scope or permission |
| 5 | Jortt unavailable, throttled or timed out (a write may or may not have happened) |
| 6 | Not found |

## Where things live

| What | Where |
|---|---|
| Credentials | env vars, then `$JORTT_ENV_FILE`, then `./.env`, then `~/.config/jortt/.env` (written by `jortt setup`; only `JORTT_*` keys are read) |
| Cached access token | `~/.config/jortt/token.json` (mode 600, refreshed automatically) |
| Pending plans | `~/.config/jortt/plans/` |
| Claude skill | `~/.claude/skills/jortt/` (`jortt skill install` refreshes it) |

## Development

```sh
bun install
bun run dev -- invoices list     # run from source (reads this folder's .env)
bun test                         # tests (fake Jortt, no network)
bun run typecheck
bun run sync-docs                # re-read the Jortt docs into catalog/endpoints.json
bun run reference                # regenerate skill/jortt/reference.md
bun run build                    # single binary for this machine in dist/jortt
bun run install:local            # build, then install it and link the skill for yourself
```

### Releasing

```sh
bun run build:release            # all platforms + install.sh + SHA256SUMS in dist/release/
gh release create v0.1.0 dist/release/* --title v0.1.0
```

Bump `version` in `package.json` first. The installer downloads from the repo's latest GitHub release, so
the release (and therefore the repo) must be public for clients to reach it. To host the files elsewhere,
upload `dist/release/*` to one folder and install with `JORTT_DOWNLOAD_URL=<that folder's URL>`.

Layout: `src/cli.ts` (entry), `src/registry.ts` (friendly command names → endpoint ids),
`src/commands/` (command builders), `src/http.ts` (client: retries, throttling, paging),
`src/auth.ts` (token), `src/runtime.ts` (reads, plans, apply), `src/setup.ts` + `src/prompt.ts` (wizard),
`src/skill.ts` (skill install; SKILL.md is bundled into the binary), `catalog/endpoints.json` (generated),
`skill/jortt/` (the Claude skill), `install.sh` (the one-line installer).

After `sync-docs`, run `bun test`: it checks that every endpoint the registry uses still exists, and
that `skill/jortt/reference.md` matches the CLI.
