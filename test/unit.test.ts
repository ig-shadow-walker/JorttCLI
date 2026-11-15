import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySets, coerce, validateBody } from "../src/body.ts";
import { bodyFields, getEndpoint, matchEndpoint, resolveId } from "../src/catalog.ts";
import { loadConfig, parseCredentials } from "../src/config.ts";
import { Exit, JorttError, fromApiError } from "../src/errors.ts";
import { buildUrl } from "../src/http.ts";
import { pickFields } from "../src/output.ts";
import { riskReasons } from "../src/risk.ts";
import { summarize } from "../src/runtime.ts";

describe("config", () => {
  test("parses the credentials file", () => {
    const env = parseCredentials(`# comment\nexport A=1\nB="two words" \nC='x # y'\nD=plain # trailing\nE=\n`);
    expect(env).toEqual({ A: "1", B: "two words", C: "x # y", D: "plain", E: "" });
  });

  test("environment beats the credentials file; nothing is read from the current folder", () => {
    const cfgDir = mkdtempSync(join(tmpdir(), "jortt-cfg-"));
    writeFileSync(join(cfgDir, "credentials"), "JORTT_CLIENT_ID=from-file\nJORTT_CLIENT_SECRET=file-secret\nJORTT_ORGANIZATION_ID=org-1\nOTHER=x\n");
    const before = process.cwd();
    const cwd = mkdtempSync(join(tmpdir(), "jortt-cwd-"));
    writeFileSync(join(cwd, ".env"), "JORTT_CLIENT_ID=from-cwd\n");
    process.chdir(cwd);
    try {
      const c = loadConfig({ JORTT_CONFIG_DIR: cfgDir, JORTT_SCOPES: "invoices:read, customers:read" });
      expect(c.clientId).toBe("from-file");
      expect(c.clientSecret).toBe("file-secret");
      expect(c.organizationId).toBe("org-1");
      expect(c.scopes).toBe("invoices:read customers:read");
      expect(c.credentialsFile).toBe(join(cfgDir, "credentials"));
      expect(loadConfig({ JORTT_CONFIG_DIR: cfgDir, JORTT_CLIENT_ID: "from-env" }).clientId).toBe("from-env");
    } finally {
      process.chdir(before);
    }
  });

  test("missing credentials is an auth error pointing at jortt setup", () => {
    const empty = mkdtempSync(join(tmpdir(), "jortt-empty-"));
    try {
      loadConfig({ JORTT_CONFIG_DIR: empty });
      throw new Error("should fail");
    } catch (e) {
      expect(e).toBeInstanceOf(JorttError);
      expect((e as JorttError).exitCode).toBe(Exit.AUTH);
      expect((e as JorttError).extra.hint).toContain("jortt setup");
    }
  });
});

describe("errors", () => {
  test("maps Jortt error keys to exit codes", () => {
    expect(fromApiError(401, { error: { key: "access_token.expired" } }).exitCode).toBe(Exit.AUTH);
    expect(fromApiError(403, { error: { key: "scopes.insufficient" } }).exitCode).toBe(Exit.FORBIDDEN);
    expect(fromApiError(404, { error: { key: "resource.not_found" } }).exitCode).toBe(Exit.NOT_FOUND);
    expect(fromApiError(429, {}).exitCode).toBe(Exit.UNAVAILABLE);
    expect(fromApiError(503, { error: { key: "server.maintenance" } }).exitCode).toBe(Exit.UNAVAILABLE);
    const v = fromApiError(422, { error: { key: "params.invalid", message: "bad", details: [{ param: "x", message: "is missing" }] } });
    expect(v.exitCode).toBe(Exit.ERROR);
    expect(v.toJSON().details).toEqual([{ param: "x", message: "is missing" }]);
    expect(fromApiError(401, { error: { key: "organization.header_required" } }).extra.hint).toContain("JORTT_ORGANIZATION_ID");
  });
});

describe("http", () => {
  test("builds URLs with Rails-style array params and skips empty values", () => {
    const u = buildUrl("https://api.jortt.nl", "/v3/reports/profit-and-loss", { year: 2026, label_ids: ["a", "b"], month: undefined, q: "" });
    expect(u).toBe("https://api.jortt.nl/v3/reports/profit-and-loss?year=2026&label_ids%5B%5D=a&label_ids%5B%5D=b");
  });
});

describe("catalog", () => {
  test("has the core v3 endpoints", () => {
    expect(getEndpoint("list-invoices-v3").path).toBe("/v3/invoices");
    expect(getEndpoint("send-invoice-v3").method).toBe("POST");
    expect(bodyFields(getEndpoint("create-customer"))!.find((f) => f.name === "customer_name")!.required).toBe(true);
  });

  test("every endpoint the friendly commands use exists in the catalog", async () => {
    const { groups } = await import("../src/registry.ts");
    const ids = groups.flatMap((g) => g.commands.map((c) => c.endpoint));
    for (const id of ids) expect(() => getEndpoint(id)).not.toThrow();
    // and every v3 endpoint has a friendly command
    const { catalog } = await import("../src/catalog.ts");
    const missing = catalog.endpoints.filter((e) => !ids.includes(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  test("matches concrete paths, preferring literal segments", () => {
    expect(matchEndpoint("GET", "/v3/invoices/peppol-scheme-catalog")!.id).toBe("get-peppol-scheme-catalog");
    expect(matchEndpoint("GET", "/v3/invoices/abc-123")!.id).toBe("get-invoice-by-id-v3");
    expect(matchEndpoint("POST", "/v3/invoices/abc/send")!.id).toBe("send-invoice-v3");
    expect(matchEndpoint("GET", "/v3/nope")).toBeUndefined();
  });

  test("resolves ids, routes and unique words", () => {
    expect(resolveId("send-invoice-v3").id).toBe("send-invoice-v3");
    expect(resolveId("POST /v3/invoices/{id}/send").id).toBe("send-invoice-v3");
    expect(resolveId("cash bank").id).toBe("dashboard-cash-and-bank");
    expect(() => resolveId("balance report")).toThrow(/balance-report, dashboard-balance/);
    expect(() => resolveId("invoice")).toThrow(/matches/);
  });
});

describe("body", () => {
  const fields = bodyFields(getEndpoint("create-and-optionally-send-an-invoice-v3"));

  test("coerces by documented type", () => {
    expect(coerce("true", "boolean", "x")).toBe(true);
    expect(coerce("30", "integer", "x")).toBe(30);
    expect(coerce("a, b", "array[string]", "x")).toEqual(["a", "b"]);
    expect(coerce('{"amount":"1"}', "object", "x")).toEqual({ amount: "1" });
    expect(coerce("null", "string", "x")).toBe(null);
    expect(() => coerce("maybe", "boolean", "--flag")).toThrow(/true or false/);
    expect(() => coerce("1.5", "integer", "--n")).toThrow(/whole number/);
  });

  test("--set builds nested objects and arrays, keeping numeric strings as strings", () => {
    const body = applySets(
      {},
      ["customer_id=c1", "line_items.0.description=Work", "line_items.0.quantity=2", "line_items.0.amount.amount=10.00", "line_items.0.vat.value=0.21", "net_amounts=false"],
      fields,
    );
    expect(body).toEqual({
      customer_id: "c1",
      line_items: [{ description: "Work", quantity: "2", amount: { amount: "10.00" }, vat: { value: 0.21 } }],
      net_amounts: false,
    });
  });

  test("validation finds missing nested fields, unknown fields and bad enum values", () => {
    const v = validateBody(
      { customer_id: "c1", send_method: "fax", bogus: 1, line_items: [{ description: "x", quantity: "1", amount: { amount: "1" } }] },
      fields,
    );
    expect(v.missing).toEqual(["line_items.0.amount.currency", "line_items.0.vat"]);
    expect(v.unknown).toEqual(["bogus"]);
    expect(v.invalid[0]).toContain("send_method: fax");
  });
});

describe("plans", () => {
  test("summaries name the target and total the line items", () => {
    const e = getEndpoint("create-and-optionally-send-an-invoice-v3");
    const s = summarize(e, "POST", "/v3/invoices", {
      invoice_date: "2026-11-14",
      line_items: [
        { quantity: "2", amount: { amount: "50.00", currency: "EUR" } },
        { quantity: "1", amount: { amount: "25.50", currency: "EUR" } },
      ],
    });
    expect(s).toContain("2 line items totalling 125.50 EUR excl. VAT");
    const send = summarize(getEndpoint("send-invoice-v3"), "POST", "/v3/invoices/1/send", { send_method: "email" }, {
      invoice_number: "2026-001",
      customer_name: "Acme",
    });
    expect(send).toContain("on 2026-001, Acme");
  });

  test("risk reasons flag sending and deleting", () => {
    expect(riskReasons(getEndpoint("send-invoice-v3"), "POST", {})[0]).toContain("Sends the invoice");
    expect(riskReasons(getEndpoint("create-and-optionally-send-an-invoice-v3"), "POST", { send_method: "email" })[0]).toContain(
      "Also sends it",
    );
    expect(riskReasons(getEndpoint("create-and-optionally-send-an-invoice-v3"), "POST", {})).toEqual([]);
    expect(riskReasons(getEndpoint("delete-a-customer"), "DELETE", undefined)[0]).toContain("can't be undone");
  });
});

describe("output", () => {
  test("picks dotted fields from objects and arrays", () => {
    const rows = [{ id: 1, customer: { name: "A", city: "X" }, other: true }];
    expect(pickFields(rows, ["id", "customer.name"])).toEqual([{ id: 1, customer: { name: "A" } }]);
  });
});

describe("token cache isolation", () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => (saved = { ...process.env }));
  afterEach(() => (process.env = saved));
  test("token file is private (0600)", async () => {
    const { FakeJortt } = await import("./helpers.ts");
    const dir = mkdtempSync(join(tmpdir(), "jortt-tok-"));
    const fake = new FakeJortt().install();
    try {
      const { getToken, tokenPath } = await import("../src/auth.ts");
      const cfg = loadConfig({ JORTT_CONFIG_DIR: dir, JORTT_CLIENT_ID: "a", JORTT_CLIENT_SECRET: "b" });
      await getToken(cfg);
      const { statSync } = await import("node:fs");
      expect(statSync(tokenPath(cfg)).mode & 0o777).toBe(0o600);
    } finally {
      fake.restore();
    }
  });
});
