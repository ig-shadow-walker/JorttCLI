import { basename } from "node:path";
import type { JsonObject } from "./body.ts";
import { JorttError } from "./errors.ts";

/**
 * Friendly commands. Each maps to one endpoint in catalog/endpoints.json; options, required
 * fields and help text are generated from the catalog, so only naming lives here.
 */
export interface CommandSpec {
  /** Command name; a space makes a nested command ("line-items list"). */
  name: string;
  endpoint: string;
  /** One-line description; defaults to the endpoint summary. */
  summary?: string;
  aliases?: string[];
  /** Display names for the path parameters, in path order. */
  args?: string[];
  /** Extra option names: { status: "invoice_status" }. */
  optionAliases?: Record<string, string>;
  /** Body defaults applied before user input. */
  defaults?: JsonObject;
  /** Adds --out to save the file behind a download link. */
  download?: boolean;
  /** Extra positional arguments not in the path (e.g. "<file>", "<files...>"). */
  extraArgs?: string[];
  /** Builds (part of) the body from the extra positional arguments. */
  buildBody?: (extra: unknown[]) => Promise<JsonObject>;
  examples?: string[];
}

export interface GroupSpec {
  name: string;
  summary: string;
  aliases?: string[];
  commands: CommandSpec[];
}

async function fileBase64(path: string): Promise<{ b64: string; type: string; name: string; size: number }> {
  const f = Bun.file(path);
  if (!(await f.exists())) throw new JorttError(`File not found: ${path}`);
  const buf = Buffer.from(await f.arrayBuffer());
  return { b64: buf.toString("base64"), type: f.type.split(";")[0]!, name: basename(path), size: buf.byteLength };
}

export const groups: GroupSpec[] = [
  {
    name: "customers",
    summary: "Customers (companies and private persons)",
    commands: [
      { name: "list", endpoint: "list-customers", examples: ["jortt customers list --query acme --json"] },
      { name: "show", endpoint: "get-customer-by-id", args: ["customer-id"] },
      {
        name: "create",
        endpoint: "create-customer",
        examples: [
          `jortt customers create --is-private false --customer-name "Acme BV" --address-street "Main 1" --address-postal-code 1234AB --address-city Amsterdam --email billing@acme.nl`,
        ],
      },
      { name: "update", endpoint: "update-customer", args: ["customer-id"], summary: "Update a customer (send the full customer: is_private and customer_name are required)" },
      { name: "delete", endpoint: "delete-a-customer", args: ["customer-id"] },
      { name: "archive", endpoint: "set-customer-archived", args: ["customer-id"], defaults: { archived: true }, summary: "Archive a customer (--archived false to unarchive)" },
      { name: "details", endpoint: "get-customer-s-details-by-id", args: ["customer-id"] },
      { name: "vat-percentages", endpoint: "get-vat-percentages-for-a-customer-by-id-v2", args: ["customer-id"] },
      { name: "direct-debit", endpoint: "send-direct-debit-authorization-to-a-customer", args: ["customer-id"] },
    ],
  },
  {
    name: "invoices",
    summary: "Invoices: create, send, credit, download",
    commands: [
      {
        name: "list",
        endpoint: "list-invoices-v3",
        optionAliases: { status: "invoice_status" },
        examples: ["jortt invoices list --status unpaid --all --json --fields id,invoice_number,customer_name,invoice_total_incl_vat"],
      },
      { name: "show", endpoint: "get-invoice-by-id-v3", args: ["invoice-id"] },
      {
        name: "create",
        endpoint: "create-and-optionally-send-an-invoice-v3",
        summary: "Create a draft invoice (or create and send it, with send_method)",
        examples: [
          `jortt invoices create --data '{"customer_id":"<uuid>","invoice_date":"2026-11-14","line_items":[{"description":"Consulting","quantity":"8","amount":{"amount":"95.00","currency":"EUR"},"vat":{"value":0.21}}]}'`,
        ],
      },
      { name: "update", endpoint: "edit-invoice-v2", args: ["invoice-id"], summary: "Edit an invoice that has not been sent yet" },
      { name: "delete", endpoint: "delete-invoice-by-id", args: ["invoice-id"], summary: "Delete an invoice" },
      {
        name: "send",
        endpoint: "send-invoice-v3",
        args: ["invoice-id"],
        optionAliases: { to: "email_address_customer", subject: "mail_subject", body: "mail_body" },
        examples: [
          `jortt invoices send <invoice-id> --send-method email --to billing@acme.nl --subject "Invoice 2026-001" --body "Please find attached..."`,
        ],
      },
      { name: "credit", endpoint: "creates-and-optionally-sends-a-credit-invoice", args: ["invoice-id"], summary: "Create a credit invoice for an invoice" },
      { name: "copy", endpoint: "copy-an-invoice", args: ["invoice-id"], summary: "Copy an invoice into a new draft" },
      { name: "set-labels", endpoint: "set-invoice-labels", args: ["invoice-id"] },
      {
        name: "download",
        endpoint: "download-invoice-pdf",
        args: ["invoice-id"],
        download: true,
        summary: "Get the PDF download link (add --out file.pdf to save it)",
      },
      { name: "next-number", endpoint: "get-next-possible-invoice-number", args: ["invoice-id"] },
      { name: "send-settings", endpoint: "get-send-settings", args: ["invoice-id"] },
      { name: "line-item-suggestions", endpoint: "get-line-item-suggestions", args: ["invoice-id"] },
      { name: "payment-ledger-accounts", endpoint: "list-payment-method-ledger-accounts-of-an-invoice", args: ["invoice-id"] },
      { name: "payment-sources", endpoint: "list-payment-method-sources-of-an-invoice", args: ["invoice-id"] },
      { name: "peppol-schemes", endpoint: "get-peppol-scheme-catalog" },
    ],
  },
  {
    name: "estimates",
    summary: "Estimates (quotes / offertes)",
    commands: [
      { name: "list", endpoint: "list-estimates-v3", optionAliases: { status: "estimate_status" } },
      { name: "show", endpoint: "get-estimate-by-id-v3", args: ["estimate-id"] },
      { name: "create", endpoint: "create-and-optionally-send-an-estimate-v3", summary: "Create an estimate (or create and send it, with send_method)" },
      { name: "update", endpoint: "edit-estimate-v2", args: ["estimate-id"] },
      { name: "delete", endpoint: "delete-estimate-v2", args: ["estimate-id"] },
      { name: "send", endpoint: "send-estimate-v3", args: ["estimate-id"], optionAliases: { to: "email_address_customer" } },
      { name: "accept", endpoint: "accept-estimate-v2", args: ["estimate-id"] },
      { name: "reject", endpoint: "reject-estimate-v2", args: ["estimate-id"] },
      { name: "copy", endpoint: "copy-estimate-v2", args: ["estimate-id"] },
      { name: "to-invoice", endpoint: "create-invoice-from-estimate-v2", args: ["estimate-id"] },
      { name: "download", endpoint: "download-estimate-pdf-v2", args: ["estimate-id"], download: true, summary: "Get the PDF download link (add --out file.pdf to save it)" },
      { name: "send-settings", endpoint: "get-estimate-send-settings-v2", args: ["estimate-id"] },
      { name: "line-item-suggestions", endpoint: "get-estimate-line-item-suggestions", args: ["estimate-id"] },
    ],
  },
  {
    name: "expenses",
    summary: "Expenses (costs, income and balance bookings)",
    commands: [
      { name: "list", endpoint: "list-expenses", optionAliases: { type: "expense_type" } },
      { name: "show", endpoint: "get-expense-by-id", args: ["expense-id"] },
      { name: "create", endpoint: "create-an-expense" },
      { name: "update", endpoint: "update-an-expense", args: ["expense-id"] },
      { name: "delete", endpoint: "delete-an-expense", args: ["expense-id"] },
      { name: "attach-receipt", endpoint: "attach-receipt-to-expense", args: ["expense-id"] },
      { name: "payment-ledger-accounts", endpoint: "list-payment-method-ledger-accounts-of-an-expense", args: ["expense-id"] },
      { name: "payment-sources", endpoint: "list-payment-method-sources-of-an-expense", args: ["expense-id"] },
    ],
  },
  {
    name: "projects",
    summary: "Projects and their hour/cost registrations (line items)",
    commands: [
      { name: "list", endpoint: "list-projects" },
      { name: "show", endpoint: "get-project", args: ["project-id"] },
      { name: "create", endpoint: "create-project" },
      { name: "update", endpoint: "update-project", args: ["project-id"] },
      { name: "delete", endpoint: "delete-project", args: ["project-id"] },
      { name: "invoice", endpoint: "invoice-project", args: ["project-id"], summary: "Create an invoice from project line items" },
      { name: "line-items list", endpoint: "list-project-line-items", args: ["project-id"] },
      { name: "line-items show", endpoint: "get-project-line-item", args: ["project-id", "line-item-id"] },
      { name: "line-items create", endpoint: "create-project-line-item", args: ["project-id"] },
      { name: "line-items update", endpoint: "update-project-line-item", args: ["project-id", "line-item-id"] },
      { name: "line-items delete", endpoint: "delete-project-line-item", args: ["project-id", "line-item-id"] },
      { name: "line-items summary", endpoint: "get-project-line-item-summary", args: ["project-id"] },
    ],
  },
  {
    name: "labels",
    summary: "Labels for invoices and bookings",
    commands: [
      { name: "list", endpoint: "list-labels" },
      { name: "create", endpoint: "create-a-label" },
    ],
  },
  {
    name: "ledger-accounts",
    summary: "Ledger accounts (grootboekrekeningen) to book on",
    aliases: ["ledger"],
    commands: [
      { name: "invoices", endpoint: "list-invoice-ledger-accounts", summary: "Ledger accounts for invoice line items" },
      { name: "invoice-default", endpoint: "the-default-ledger-account-for-invoice-line-items" },
      { name: "cost", endpoint: "list-cost-ledger-accounts", summary: "Ledger accounts for expenses of type cost" },
      { name: "income", endpoint: "list-income-ledger-accounts", summary: "Ledger accounts for expenses of type income" },
      { name: "balance", endpoint: "list-balance-ledger-accounts", summary: "Ledger accounts for expenses of type balance" },
    ],
  },
  {
    name: "payroll",
    summary: "Payroll journal entries (loonjournaalposten)",
    aliases: ["loonjournaalposten"],
    commands: [
      { name: "list", endpoint: "list-loonjournaalposten" },
      { name: "create", endpoint: "create-a-loonjournaalpost" },
      { name: "update", endpoint: "update-a-loonjournaalpost", args: ["entry-id"] },
      { name: "delete", endpoint: "delete-a-loonjournaalpost", args: ["entry-id"] },
    ],
  },
  {
    name: "organizations",
    summary: "The administration(s) these credentials act on",
    aliases: ["org"],
    commands: [
      { name: "me", endpoint: "get-the-organization-associated-with-the-api-credentials", summary: "The administration these credentials act on" },
      { name: "list", endpoint: "list-organizations-v3" },
    ],
  },
  {
    name: "tradenames",
    summary: "Trade names (handelsnamen)",
    commands: [{ name: "list", endpoint: "list-tradenames" }],
  },
  {
    name: "inbox",
    summary: "Upload receipts to the Jortt inbox",
    commands: [
      {
        name: "upload",
        endpoint: "upload-receipt",
        summary: "Upload receipt images to the inbox",
        extraArgs: ["<files...>"],
        buildBody: async ([files]) => ({
          images: await Promise.all((files as string[]).map(async (f) => (await fileBase64(f)).b64)),
        }),
        examples: ["jortt inbox upload bon1.jpg bon2.png"],
      },
    ],
  },
  {
    name: "reports",
    summary: "Profit & loss, balance and dashboard summaries",
    commands: [
      { name: "profit-and-loss", endpoint: "profit-and-loss-report", aliases: ["pnl"], optionAliases: { labels: "label_ids" }, examples: ["jortt reports pnl --year 2026 --quarter 3 --json"] },
      { name: "balance", endpoint: "balance-report" },
      { name: "summary invoices", endpoint: "dashboard-invoices" },
      { name: "summary btw", endpoint: "dashboard-btw", aliases: ["vat"] },
      { name: "summary balance", endpoint: "dashboard-balance" },
      { name: "summary profit-and-loss", endpoint: "dashboard-profit-and-loss", aliases: ["pnl"] },
      { name: "summary cash-and-bank", endpoint: "dashboard-cash-and-bank", aliases: ["cash"] },
    ],
  },
  {
    name: "files",
    summary: "Attachments for invoices and estimates",
    commands: [
      {
        name: "upload",
        endpoint: "upload-attachment",
        summary: "Upload a file as an attachment (id is generated when not given)",
        extraArgs: ["<file>"],
        buildBody: async ([file]) => {
          const f = await fileBase64(file as string);
          return { id: crypto.randomUUID(), name: f.name, mime_type: f.type, contents: f.b64 };
        },
      },
      { name: "download-url", endpoint: "download-url-for-attachments" },
      { name: "upload-url", endpoint: "upload-url-for-attachments" },
    ],
  },
  {
    name: "bank",
    summary: "Bank accounts and transactions",
    commands: [
      { name: "accounts", endpoint: "list-bank-accounts-v3" },
      { name: "transactions", endpoint: "list-bank-transactions-v3", args: ["bank-account-id"] },
      { name: "transaction-sources", endpoint: "list-payment-method-sources-of-a-bank-transaction", args: ["bank-account-id", "transaction-id"] },
    ],
  },
  {
    name: "payments",
    summary: "Register and list payments on invoices and expenses",
    commands: [
      { name: "list", endpoint: "list-payments-v3", args: ["sink-id"], summary: "Payments registered on an invoice or expense (sink)" },
      {
        name: "register",
        endpoint: "register-payment-v3",
        examples: [`jortt payments register --sink-id <invoice-id> --data '{"amount":{"amount":"121.00","currency":"EUR"}}'`],
      },
      { name: "deregister", endpoint: "deregister-payment-v3" },
    ],
  },
  {
    name: "receipts",
    summary: "Receipts in the inbox",
    commands: [
      { name: "list", endpoint: "list-receipts" },
      { name: "show", endpoint: "get-receipt-by-id", args: ["receipt-id"] },
      { name: "download", endpoint: "download-url-for-a-receipt", args: ["receipt-id"], download: true, summary: "Get the download link (add --out file to save it)" },
    ],
  },
];
