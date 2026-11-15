import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Exit } from "../src/errors.ts";
import { FakeJortt, json, runCli, testEnv } from "./helpers.ts";

let env: ReturnType<typeof testEnv>;
let fake: FakeJortt;

beforeEach(() => {
  env = testEnv();
  fake = new FakeJortt().install();
});
afterEach(() => {
  fake.restore();
  env.cleanup();
});

describe("reads", () => {
  test("list returns the JSON envelope with paging meta and field picking", async () => {
    fake.on("GET", "/v3/invoices", {
      data: [
        { id: "i1", invoice_number: "2026-001", customer_name: "Acme", invoice_status: "unpaid" },
        { id: "i2", invoice_number: "2026-002", customer_name: "Beta", invoice_status: "unpaid" },
      ],
      _links: { next: { href: "https://api.jortt.nl/v3/invoices?page=2" } },
    });
    const r = await runCli("--json", "--fields", "id,invoice_number", "invoices", "list", "--status", "unpaid");
    expect(r.code).toBe(Exit.OK);
    expect(r.json).toEqual({
      ok: true,
      data: [
        { id: "i1", invoice_number: "2026-001" },
        { id: "i2", invoice_number: "2026-002" },
      ],
      meta: { count: 2, page: 1, next_page: 2 },
    });
    expect(fake.apiCalls()[0]!.url.searchParams.get("invoice_status")).toBe("unpaid");
  });

  test("human output is a table", async () => {
    fake.on("GET", "/v3/labels", { data: [{ id: "l1", description: "Q4" }] });
    const r = await runCli("labels", "list");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("description");
    expect(r.stdout).toContain("Q4");
  });

  test("required query options are enforced before calling Jortt", async () => {
    const r = await runCli("--json", "reports", "pnl");
    expect(r.code).toBe(Exit.ERROR);
    expect(r.json.error.message).toContain("--year");
    expect(fake.apiCalls().length).toBe(0);
  });

  test("API errors come back as {ok:false} with the right exit code", async () => {
    fake.on("GET", /\/v3\/invoices\/.+/, () => json(403, { error: { code: 403, key: "scopes.insufficient", message: "Missing scope" } }));
    const r = await runCli("--json", "invoices", "show", "abc");
    expect(r.code).toBe(Exit.FORBIDDEN);
    expect(r.json.ok).toBe(false);
    expect(r.json.error.key).toBe("scopes.insufficient");
    expect(r.json.error.hint).toContain("JORTT_SCOPES");
  });

  test("download --out saves the file behind the link without sending the token", async () => {
    fake.on("GET", "/v3/invoices/i1/download", { data: { download_location: "https://files.jortt.nl/x.pdf?sig=1" } });
    const original = globalThis.fetch;
    const seen: Headers[] = [];
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
      if (String(input).startsWith("https://files.jortt.nl/")) {
        seen.push(new Headers(init?.headers));
        return new Response(new Uint8Array([37, 80, 68, 70]));
      }
      return original(input, init);
    }) as typeof fetch;
    const out = join(env.dir, "inv.pdf");
    const r = await runCli("--json", "invoices", "download", "i1", "--out", out);
    expect(r.code).toBe(0);
    expect(r.json.data.bytes).toBe(4);
    expect(readFileSync(out).toString()).toBe("%PDF");
    expect(seen[0]!.get("authorization")).toBeNull();
  });
});

describe("writes make a plan, apply sends it once", () => {
  test("create customer: plan (exit 2, nothing sent), then apply", async () => {
    let posted: unknown;
    fake.on("POST", "/v3/customers", (c) => ((posted = c.body), json(201, { data: { id: "cust-1" } })));

    const plan = await runCli("--json", "customers", "create", "--is-private", "true", "--customer-name", "Jan Jansen", "--email", "jan@example.nl");
    expect(plan.code).toBe(Exit.PLAN);
    expect(fake.apiCalls().length).toBe(0);
    const p = plan.json.data;
    expect(p.planMade).toBe(true);
    expect(p.dangerous).toEqual([]);
    expect(p.wouldSend).toEqual({
      method: "POST",
      url: "https://api.jortt.nl/v3/customers",
      body: { is_private: true, customer_name: "Jan Jansen", email: "jan@example.nl" },
    });
    expect(p.toApply).toBe(`jortt apply ${p.planId}`);

    const applied = await runCli("--json", "apply", p.planId);
    expect(applied.code).toBe(Exit.OK);
    expect(applied.json.data).toEqual({ id: "cust-1" });
    expect(posted).toEqual({ is_private: true, customer_name: "Jan Jansen", email: "jan@example.nl" });

    const again = await runCli("--json", "apply", p.planId);
    expect(again.code).toBe(Exit.NOT_FOUND);
    expect(fake.apiCalls().filter((c) => c.method === "POST").length).toBe(1);
  });

  test("missing required body fields fail before any plan is made", async () => {
    const r = await runCli("--json", "customers", "create", "--customer-name", "X");
    expect(r.code).toBe(Exit.ERROR);
    expect(r.json.error.message).toContain("is_private");
    expect(readdirSync(env.dir).includes("plans")).toBe(false);
  });

  test("sending an invoice is flagged dangerous and names the invoice it targets", async () => {
    fake.on("GET", "/v3/invoices/inv-9", { data: { id: "inv-9", invoice_number: "2026-009", customer_name: "Acme BV", invoice_status: "draft" } });
    const r = await runCli("--json", "invoices", "send", "inv-9", "--send-method", "email", "--to", "ap@acme.nl", "--subject", "Factuur", "--body", "Zie bijlage");
    expect(r.code).toBe(Exit.PLAN);
    const p = r.json.data;
    expect(p.dangerous[0]).toContain("Sends the invoice");
    expect(p.target).toMatchObject({ invoice_number: "2026-009", customer_name: "Acme BV" });
    expect(p.summary).toContain("2026-009, Acme BV");
    expect(p.wouldSend.body).toEqual({ send_method: "email", email_address_customer: "ap@acme.nl", mail_subject: "Factuur", mail_body: "Zie bijlage" });
    expect(fake.apiCalls().every((c) => c.method === "GET")).toBe(true);
  });

  test("a write on something that doesn't exist fails with not found", async () => {
    const r = await runCli("--json", "customers", "delete", "nope");
    expect(r.code).toBe(Exit.NOT_FOUND);
  });

  test("--data, flags and --set merge in that order", async () => {
    const r = await runCli(
      "--json",
      "invoices",
      "create",
      "--data",
      JSON.stringify({ customer_id: "c1", remarks: "from data", line_items: [{ description: "A", quantity: "1", amount: { amount: "10.00", currency: "EUR" }, vat: { value: 0.21 } }] }),
      "--remarks",
      "from flag",
      "--set",
      "line_items.0.quantity=3",
    );
    expect(r.code).toBe(Exit.PLAN);
    expect(r.json.data.wouldSend.body.remarks).toBe("from flag");
    expect(r.json.data.wouldSend.body.line_items[0].quantity).toBe("3");
    expect(r.json.data.summary).toContain("1 line item totalling 30.00 EUR excl. VAT");
  });

  test("expired plans can't be applied", async () => {
    const r = await runCli("--json", "labels", "create", "--description", "Q4");
    const id = r.json.data.planId;
    const file = join(env.dir, "plans", `${id}.json`);
    const plan = JSON.parse(readFileSync(file, "utf8"));
    plan.expiresAt = new Date(Date.now() - 1000).toISOString();
    writeFileSync(file, JSON.stringify(plan));
    const a = await runCli("--json", "apply", id);
    expect(a.code).toBe(Exit.ERROR);
    expect(a.json.error.key).toBe("plan.expired");
    expect(fake.apiCalls().length).toBe(0);
  });

  test("upload commands read files into base64 bodies", async () => {
    const img = join(env.dir, "bon.png");
    writeFileSync(img, Buffer.from([1, 2, 3]));
    const r = await runCli("--json", "inbox", "upload", img);
    expect(r.code).toBe(Exit.PLAN);
    const plan = JSON.parse(readFileSync(join(env.dir, "plans", `${r.json.data.planId}.json`), "utf8"));
    expect(plan.body).toEqual({ images: ["AQID"] });
  });
});

describe("api escape hatch and catalog", () => {
  test("api GET runs; api POST makes a plan and warns about unknown paths", async () => {
    fake.on("GET", "/v3/tradenames", { data: [{ id: "t1" }] });
    const g = await runCli("--json", "api", "GET", "/v3/tradenames");
    expect(g.json.data).toEqual([{ id: "t1" }]);

    const p = await runCli("--json", "api", "POST", "/v3/something-new", "-d", '{"a":1}');
    expect(p.code).toBe(Exit.PLAN);
    expect(p.json.data.warnings[0]).toContain("not in the Jortt docs catalog");
  });

  test("endpoints search and describe", async () => {
    const e = await runCli("--json", "endpoints", "send", "invoice");
    expect(e.json.data.map((x: any) => x.id)).toContain("send-invoice-v3");
    expect(e.json.data.find((x: any) => x.id === "send-invoice-v3").command).toBe("jortt invoices send");
    const d = await runCli("--json", "describe", "send-invoice-v3");
    expect(d.json.data.path).toBe("/v3/invoices/{id}/send");
  });

  test("auth status works without network and masks the client id", async () => {
    const r = await runCli("--json", "auth", "status");
    expect(r.code).toBe(0);
    expect(r.json.data.clientId).toBe("test…ient");
    expect(JSON.stringify(r.json)).not.toContain("test-secret");
    expect(fake.calls.length).toBe(0);
  });
});
