import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.ts";
import { Exit, JorttError } from "../src/errors.ts";
import { JorttClient } from "../src/http.ts";
import { FakeJortt, json, testEnv } from "./helpers.ts";

let env: ReturnType<typeof testEnv>;
let fake: FakeJortt;
const noSleep = async () => {};

beforeEach(() => {
  env = testEnv();
  fake = new FakeJortt().install();
});
afterEach(() => {
  fake.restore();
  env.cleanup();
});

const client = () => new JorttClient(loadConfig(), { sleep: noSleep });

describe("auth", () => {
  test("uses the client credentials grant with Basic auth and caches the token", async () => {
    fake.on("GET", "/v3/organizations/me", { data: { id: "org" } });
    const c = client();
    await c.request({ method: "GET", path: "/v3/organizations/me" });
    await client().request({ method: "GET", path: "/v3/organizations/me" }); // new process, same cache
    expect(fake.tokensIssued).toBe(1);
    const tokenCall = fake.calls.find((x) => x.url.hostname === "app.jortt.nl")!;
    expect(tokenCall.headers.get("authorization")).toBe(`Basic ${Buffer.from("test-client:test-secret").toString("base64")}`);
    expect(tokenCall.body).toEqual({ grant_type: "client_credentials", scope: "invoices:read invoices:write customers:read customers:write" });
    expect(fake.apiCalls()[0]!.headers.get("authorization")).toBe("Bearer token-1");
  });

  test("a changed scope list gets a new token", async () => {
    fake.on("GET", "/v3/organizations/me", { data: {} });
    await client().request({ method: "GET", path: "/v3/organizations/me" });
    process.env.JORTT_SCOPES = "invoices:read";
    await client().request({ method: "GET", path: "/v3/organizations/me" });
    expect(fake.tokensIssued).toBe(2);
  });

  test("an expired token is replaced and the request retried once, even for writes", async () => {
    let n = 0;
    fake.on("POST", "/v3/labels", () =>
      ++n === 1 ? json(401, { error: { code: 401, key: "access_token.expired", message: "expired" } }) : json(201, { data: { id: "l1" } }),
    );
    const res = await client().request({ method: "POST", path: "/v3/labels", body: { description: "x" } });
    expect(res.status).toBe(201);
    expect(fake.tokensIssued).toBe(2);
    expect(fake.apiCalls().map((c) => c.headers.get("authorization"))).toEqual(["Bearer token-1", "Bearer token-2"]);
  });

  test("sends Organization-Id when configured", async () => {
    process.env.JORTT_ORGANIZATION_ID = "org-42";
    fake.on("GET", "/v3/labels", { data: [] });
    await client().request({ method: "GET", path: "/v3/labels" });
    expect(fake.apiCalls()[0]!.headers.get("organization-id")).toBe("org-42");
  });
});

describe("retries", () => {
  test("GET retries 503 and succeeds", async () => {
    let n = 0;
    fake.on("GET", "/v3/labels", () => (++n < 3 ? json(503, { error: { key: "server.maintenance" } }) : json(200, { data: [1] })));
    const res = await client().request({ method: "GET", path: "/v3/labels" });
    expect(res.body).toEqual({ data: [1] });
    expect(n).toBe(3);
  });

  test("POST retries a 429 (not processed) but never a 503 (may have happened)", async () => {
    let n = 0;
    fake.on("POST", "/v3/labels", () => (++n === 1 ? json(429, { error: { key: "request.throttled" } }) : json(201, { data: { id: "x" } })));
    await client().request({ method: "POST", path: "/v3/labels", body: {} });
    expect(n).toBe(2);

    let m = 0;
    fake.on("PUT", "/v3/labels", () => (++m, json(503, { error: { key: "server.maintenance", message: "down" } })));
    const err = await client()
      .request({ method: "PUT", path: "/v3/labels", body: {} })
      .catch((e) => e as JorttError);
    expect(m).toBe(1);
    expect(err).toBeInstanceOf(JorttError);
    expect((err as JorttError).exitCode).toBe(Exit.UNAVAILABLE);
    expect((err as JorttError).extra.hint).toContain("may or may not");
  });

  test("refuses to send the token to another host", async () => {
    await expect(client().request({ method: "GET", path: "https://evil.example.com/v3/x" })).rejects.toThrow(/Refusing/);
    expect(fake.apiCalls().length).toBe(0);
  });
});

describe("pagination", () => {
  const pages: Record<string, unknown> = {
    "1": { data: [{ id: 1 }, { id: 2 }], _links: { next: { href: "https://api.jortt.nl/v3/customers?page=2" } } },
    "2": { data: [{ id: 3 }, { id: 4 }], _links: { next: { href: "https://api.jortt.nl/v3/customers?page=3" } } },
    "3": { data: [{ id: 5 }], _links: { next: null } },
  };
  beforeEach(() => {
    fake.on("GET", "/v3/customers", (c) => json(200, pages[c.url.searchParams.get("page") ?? "1"]));
  });

  test("one page by default, with the next page number", async () => {
    const r = await client().paginate({ method: "GET", path: "/v3/customers", query: { query: "acme" } });
    expect(r.items.length).toBe(2);
    expect(r.nextPage).toBe(2);
    expect(fake.apiCalls()[0]!.url.searchParams.get("query")).toBe("acme");
  });

  test("--all follows next links; --limit stops early", async () => {
    const all = await client().paginate({ method: "GET", path: "/v3/customers", query: {} }, { all: true });
    expect(all.items.map((x: any) => x.id)).toEqual([1, 2, 3, 4, 5]);
    expect(all.nextPage).toBeNull();
    fake.calls = [];
    const limited = await client().paginate({ method: "GET", path: "/v3/customers", query: {} }, { all: true, limit: 3 });
    expect(limited.items.length).toBe(3);
    expect(fake.apiCalls().length).toBe(2);
  });
});
