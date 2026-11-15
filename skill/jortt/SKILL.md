---
name: jortt
description: Use for anything in Jortt, the Dutch bookkeeping/accounting app (boekhouding) - invoices (facturen) and credit invoices, sending or downloading invoices, unpaid or late invoices, estimates/quotes (offertes), customers (klanten/debiteuren), expenses and receipts (uitgaven, kosten, bonnetjes, inbox), ledger accounts (grootboek), labels, projects and hour registrations, payments (betalingen) and bank transactions, payroll journal entries (loonjournaalposten), and reports - profit and loss (winst- en verliesrekening), balance (balans), VAT/BTW summaries, cash and bank. Runs the `jortt` command-line tool against the Jortt API.
---

# jortt - Jortt bookkeeping

`jortt` talks to the Jortt API as the company's own Jortt app (client credentials, one administration).
Every command and its options: [reference.md](reference.md), or `jortt <group> <command> --help`
(the help lists every body field, with `*` for required ones).

## Calling it

- Add `--json`. Output is `{"ok":true,"data":…,"meta":…}` or `{"ok":false,"error":{"message","key","hint","exitCode"}}`.
- Keep answers small with `--fields a,b.c` and `--limit n`. Lists return 100 per page; `meta.next_page`
  says if there is more. Add `--all` to fetch every page (combine with `--limit`).
- Ids are UUIDs. Find them with a read first (`customers list --query acme`, `invoices list --query …`).
  Never guess or invent an id.
- Dates are `YYYY-MM-DD`. Money is an object with a string amount: `{"amount":"95.00","currency":"EUR"}`.
  Quantities are strings (`"8"`). VAT is a decimal: `{"value":0.21}` (21%), `0.09`, `0`.
  `net_amounts: true` means the line amounts already include VAT.
- Top-level body fields are flags (`--customer-name "Acme BV"`, `--is-private false`). For nested data
  (line items, amounts) pass JSON with `--data '{…}'` or `--data-file body.json`; `--set line_items.0.quantity=2`
  tweaks one field.

## Reads run; changes come back as a plan

Reads run straight away. Any command that changes something sends nothing: it exits with code 2 and
returns `planMade: true`, a `summary`, `dangerous` reasons, the `target` it changes (read from Jortt),
what it `wouldSend`, and `toApply` (`jortt apply <plan-id>`).

1. Tell the user the summary in plain words, the `dangerous` reasons and any `warnings`, and ask.
2. Only after a clear yes **in this conversation**, run `toApply` exactly as given, as its own command.
   One apply per yes; never apply a plan the user hasn't seen. Claude Code will also ask them.
3. Plans expire after 15 minutes and can be applied once. If one expired, run the command again.

Never put `apply` anywhere but first (`jortt apply <plan>`), and never chain it with other commands.
Take extra care when `dangerous` is not empty:
- **Sending** (`invoices send`, `estimates send`, or `create` with `send_method`) emails the customer
  (or delivers via Peppol). A sent invoice gets its number and is final; it can't be unsent, only credited.
  Prefer creating a draft first, show it, then send in a separate step.
- **Deleting** can't be undone. Sent (finalized) invoices can't be edited; to cancel one, use
  `invoices credit <id>` (creates a draft credit invoice unless `send_method` is given).
- Payments and payroll change the books.

## When something goes wrong

| Exit | Meaning | What to do |
|---|---|---|
| 1 | Bad input or Jortt said no (422) | Read `error.details`; fix the fields. `--help` lists them |
| 2 | Plan made, nothing sent | Ask the user, then `jortt apply <id>` |
| 3 | Not set up / credentials rejected | Ask the user to run `jortt setup` in their own terminal (it asks for the Client ID and Secret, checks them and saves them). Don't run it for them, and never ask for the secret in chat |
| 4 | Missing scope or permission | Tell the user which (`error.hint`); don't work around it |
| 5 | Jortt down, throttled or timed out | For a change: it may or may not have happened. Don't repeat it; check with a read first |
| 6 | Not found | Re-check the id with a list/search |

`jortt auth test` checks the whole setup (token + administration). `jortt auth status` shows which
credentials file and scopes are used without calling Jortt. If a command fails with exit 4 because the Jortt app lacks a
scope, the user adds it to the app in Jortt and runs `jortt setup` again.

## Which command for what

| The user wants to… | Use |
|---|---|
| Check the connection / which administration | `auth test`, `whoami` |
| Find a customer | `customers list --query <text>` (min. 3 characters), then `customers show <id>` |
| Add / change a customer | `customers create …`, `customers update <id> …` (full customer), `customers archive <id>` |
| Unpaid / late / draft invoices | `invoices list --status unpaid` (`late`, `draft`, `sent`, `paid`) `--all` |
| Look up one invoice | `invoices list --query <number or name>`, then `invoices show <id>` |
| Make an invoice | `invoices create --data '{…}'` (draft), then `invoices send <id>` |
| Send / resend an invoice | `invoices send-settings <id>` for defaults, then `invoices send <id> --send-method email --to … --subject … --body …` |
| Cancel a sent invoice | `invoices credit <id>` |
| Invoice PDF | `invoices download <id> --out invoice.pdf` |
| Mark an invoice paid | `payments register --sink-id <invoice-id> --data '{"amount":{"amount":"121.00","currency":"EUR"}}'` |
| Payments on an invoice | `payments list <invoice-id>` |
| Quotes | `estimates list/show/create/send`, `estimates accept/reject <id>`, `estimates to-invoice <id>` |
| Book an expense | `ledger-accounts cost` (pick the account), then `expenses create --data '{…}'` |
| Expenses in a period | `expenses list --vat-date-from 2026-07-01 --vat-date-till 2026-09-30 --all` |
| Upload a receipt | `inbox upload <image files>`; inbox receipts: `receipts list` |
| Profit & loss | `reports pnl --year 2026 [--quarter 3 | --month 9]` |
| Balance sheet | `reports balance --year 2026` |
| Dashboard numbers (VAT periods, cash, invoices) | `reports summary btw`, `summary cash-and-bank`, `summary invoices`, `summary balance`, `summary pnl` |
| Bank transactions | `bank accounts`, then `bank transactions <bank-account-id> --all` |
| Projects and hours | `projects list`, `projects line-items list <project-id>`, `projects invoice <project-id>` |
| Labels, trade names | `labels list/create`, `tradenames list` |
| Payroll entries | `payroll list --year 2026` |
| Anything else in the API | `jortt endpoints <words>` → `jortt describe <endpoint-id>` → `jortt api <METHOD> <path>` |

## Recipes

Create a draft invoice (amounts excl. VAT; ask the user for anything missing rather than guessing):

```bash
jortt customers list --query acme --json --fields id,customer_name,email
jortt invoices create --json --data '{
  "customer_id": "<customer uuid>",
  "invoice_date": "2026-11-14",
  "line_items": [
    {"description": "Consulting november", "quantity": "8",
     "amount": {"amount": "95.00", "currency": "EUR"}, "vat": {"value": 0.21}}
  ]
}'
# exit 2 -> show the summary, ask, then: jortt apply <plan-id>
```

Then send it only after a separate yes: `jortt invoices send <invoice-id> --send-method email --to <address>
--subject "…" --body "…"` (see `invoices send-settings <id>` for the customer's address and template).

Overview of what's outstanding:

```bash
jortt invoices list --status unpaid --all --json \
  --fields invoice_number,customer_company_name,invoice_date,invoice_due_date,invoice_due_amount
```

Book a cost: get the ledger account id from `jortt ledger-accounts cost --json`, then
`jortt expenses create --help` for the fields (`description`, `ledger_account_id`, `expense_type: cost`,
`vat_date`, `delivery_period`, `vat_type`, `raw_total_amount`, optional `vat_line_items`).

## Notes

- The endpoint catalog comes from the Jortt docs; `jortt endpoints` lists every v3 endpoint with the
  friendly command for it. If Jortt rejects a field the docs call optional (or the other way round),
  `--no-validate` skips the local required-field check; Jortt still validates.
- `jortt plans list` shows plans waiting to be applied; `jortt plans discard <id>` drops one.
