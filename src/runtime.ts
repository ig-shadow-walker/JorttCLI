import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Endpoint } from "./catalog-types.ts";
import { catalog, pathParams } from "./catalog.ts";
import { type Config, loadConfig } from "./config.ts";
import { Exit, JorttError } from "./errors.ts";
import { JorttClient, type QueryValue, buildUrl } from "./http.ts";
import { type OutputOptions, getPath, printSuccess } from "./output.ts";
import { type Plan, consumePlan, loadPlan, savePlan } from "./plans.ts";
import { riskReasons } from "./risk.ts";

export interface GlobalOpts {
  json?: boolean;
  fields?: string;
  limit?: string;
  verbose?: boolean;
}

export class Runtime {
  readonly out: OutputOptions;
  readonly limit?: number;
  readonly verbose: boolean;
  private _config?: Config;
  private _client?: JorttClient;

  constructor(opts: GlobalOpts) {
    this.out = {
      json: !!opts.json || process.env.JORTT_OUTPUT === "json",
      fields: opts.fields ? opts.fields.split(",").map((f) => f.trim()).filter(Boolean) : undefined,
    };
    if (opts.limit !== undefined) {
      const n = Number(opts.limit);
      if (!Number.isInteger(n) || n < 1) throw new JorttError(`--limit must be a positive whole number.`);
      this.limit = n;
    }
    this.verbose = !!opts.verbose;
  }

  get config(): Config {
    return (this._config ??= loadConfig());
  }

  get client(): JorttClient {
    return (this._client ??= new JorttClient(this.config, { verbose: this.verbose }));
  }

  success(data: unknown, meta?: Record<string, unknown>) {
    const limited = Array.isArray(data) && this.limit !== undefined ? data.slice(0, this.limit) : data;
    printSuccess(limited, meta, this.out);
  }
}

/** Fills {placeholders} in a path template. */
export function fillPath(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const v = values[name];
    if (!v) throw new JorttError(`Missing ${name}.`);
    return encodeURIComponent(v);
  });
}

function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && !Array.isArray(body) && "data" in body) return (body as { data: unknown }).data;
  return body;
}

export interface ReadRequest {
  endpoint?: Endpoint;
  path: string;
  query: Record<string, QueryValue>;
  paged: boolean;
  all?: boolean;
  /** Save a download_location to this file. */
  out?: string;
}

export async function runRead(rt: Runtime, r: ReadRequest): Promise<number> {
  if (r.paged) {
    const res = await rt.client.paginate({ method: "GET", path: r.path, query: r.query }, { all: r.all, limit: rt.limit });
    rt.success(res.items, {
      count: res.items.length,
      page: res.firstPage,
      ...(res.pagesFetched > 1 ? { pages_fetched: res.pagesFetched } : {}),
      next_page: res.nextPage,
      ...(res.deprecated ? { deprecated: true } : {}),
    });
    return Exit.OK;
  }
  const res = await rt.client.request({ method: "GET", path: r.path, query: r.query });
  let data = unwrap(res.body);
  if (Array.isArray(data) && rt.limit !== undefined) data = data.slice(0, rt.limit);
  const meta: Record<string, unknown> = res.deprecated ? { deprecated: true } : {};
  if (r.out) {
    const url = findUrl(data);
    if (!url) throw new JorttError("Jortt did not return a download link.");
    const file = await download(url, r.out);
    rt.success({ saved: file.path, bytes: file.bytes, url }, meta);
    return Exit.OK;
  }
  rt.success(data, meta);
  return Exit.OK;
}

function findUrl(data: unknown): string | undefined {
  for (const key of ["download_location", "download_url", "url", "href"]) {
    const v = getPath(data, key);
    if (typeof v === "string" && /^https:\/\//.test(v)) return v;
  }
  if (data && typeof data === "object") {
    for (const v of Object.values(data)) if (typeof v === "string" && /^https:\/\//.test(v)) return v;
  }
  return undefined;
}

async function download(url: string, out: string): Promise<{ path: string; bytes: number }> {
  // Download links are pre-signed; never send the Jortt token along.
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new JorttError(`Downloading the file failed: HTTP ${res.status}`, Exit.UNAVAILABLE);
  const buf = new Uint8Array(await res.arrayBuffer());
  const path = resolve(out);
  writeFileSync(path, buf);
  return { path, bytes: buf.byteLength };
}

// ---------- writes: plan, then apply ----------

export interface WriteRequest {
  endpoint?: Endpoint;
  method: string;
  path: string;
  query: Record<string, QueryValue>;
  body?: unknown;
  command: string;
  warnings?: string[];
}

const TARGET_KEYS = [
  "id",
  "invoice_number",
  "estimate_number",
  "customer_name",
  "customer_company_name",
  "name",
  "description",
  "invoice_status",
  "estimate_status",
  "acceptance_status",
  "invoice_date",
  "vat_date",
  "total_amount",
  "invoice_total_incl_vat",
  "invoice_due_amount",
  "total",
  "archived",
  "email",
];

/** For a write on /x/{id}/..., the GET endpoint that shows the thing being changed. */
function targetEndpoint(e: Endpoint): Endpoint | undefined {
  const segs = e.path.split("/");
  for (let k = segs.length; k > 2; k--) {
    if (!/^\{.+\}$/.test(segs[k - 1]!)) continue;
    const tpl = segs.slice(0, k).join("/");
    const hit = catalog.endpoints.find((x) => x.method === "GET" && x.path === tpl);
    if (hit) return hit;
  }
  return undefined;
}

async function readTarget(rt: Runtime, e: Endpoint | undefined, concretePath: string, warnings: string[]) {
  if (!e || e.method === "GET") return undefined;
  const t = targetEndpoint(e);
  if (!t) return undefined;
  const depth = t.path.split("/").length;
  const path = concretePath.split("?")[0]!.split("/").slice(0, depth).join("/");
  try {
    const res = await rt.client.request({ method: "GET", path });
    const data = unwrap(res.body) as Record<string, unknown> | null;
    if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
    const out: Record<string, unknown> = {};
    for (const k of TARGET_KEYS) if (data[k] !== undefined && data[k] !== null && data[k] !== "") out[k] = data[k];
    return Object.keys(out).length ? out : undefined;
  } catch (err) {
    if (err instanceof JorttError && err.exitCode === Exit.NOT_FOUND) {
      throw new JorttError(`Nothing to change: ${path} does not exist in Jortt.`, Exit.NOT_FOUND, { key: "resource.not_found" });
    }
    if (err instanceof JorttError && (err.exitCode === Exit.AUTH || err.exitCode === Exit.UNAVAILABLE)) throw err;
    warnings.push(`Could not read the current state first: ${(err as Error).message}`);
    return undefined;
  }
}

function money(v: unknown): number | undefined {
  const a = (v as { amount?: unknown; value?: unknown } | undefined)?.amount ?? (v as { value?: unknown } | undefined)?.value ?? v;
  const n = Number(a);
  return Number.isFinite(n) ? n : undefined;
}

export function summarize(e: Endpoint | undefined, method: string, path: string, body: unknown, target?: Record<string, unknown>): string {
  const parts: string[] = [e?.summary || `${method} ${path}`];
  if (target) {
    const label = [target.invoice_number ?? target.estimate_number ?? target.name ?? target.description, target.customer_name ?? target.customer_company_name]
      .filter(Boolean)
      .join(", ");
    parts.push(`on ${label || target.id || path}`);
  } else if (pathParams(e ?? ({ path: "" } as Endpoint)).length) {
    parts.push(`on ${path}`);
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const facts: string[] = [];
  for (const k of ["customer_name", "description", "name", "invoice_date", "vat_date", "send_method", "email_address_customer", "archived", "period_date"]) {
    const v = b[k];
    if (v !== undefined && v !== null && typeof v !== "object") facts.push(`${k}=${String(v).slice(0, 60)}`);
  }
  if (Array.isArray(b.line_items)) {
    let total = 0;
    let known = true;
    let currency = "";
    for (const li of b.line_items as Record<string, unknown>[]) {
      const q = Number(li.quantity ?? 1);
      const a = money(li.amount);
      currency ||= String((li.amount as { currency?: string } | undefined)?.currency ?? "");
      if (a === undefined || !Number.isFinite(q)) known = false;
      else total += q * a;
    }
    facts.push(
      `${b.line_items.length} line item${b.line_items.length === 1 ? "" : "s"}${known ? ` totalling ${total.toFixed(2)} ${currency}`.trimEnd() + (b.net_amounts === true ? " incl. VAT" : " excl. VAT") : ""}`,
    );
  }
  if (b.amount !== undefined && money(b.amount) !== undefined) {
    facts.push(`amount=${money(b.amount)!.toFixed(2)} ${(b.amount as { currency?: string }).currency ?? ""}`.trimEnd());
  }
  if (Array.isArray(b.images)) facts.push(`${b.images.length} image(s)`);
  if (facts.length) parts.push(`(${facts.join(", ")})`);
  return parts.join(" ");
}

/** Shortens big strings (base64 uploads) for display. */
function forDisplay(v: unknown): unknown {
  if (typeof v === "string") return v.length > 300 ? `<${v.length} characters, e.g. base64 file contents>` : v;
  if (Array.isArray(v)) return v.map(forDisplay);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, forDisplay(x)]));
  return v;
}

export function planView(plan: Plan, apiUrl: string) {
  return {
    planMade: true,
    planId: plan.id,
    summary: plan.summary,
    dangerous: plan.dangerous,
    ...(plan.target ? { target: plan.target } : {}),
    wouldSend: {
      method: plan.method,
      url: buildUrl(apiUrl, plan.path, plan.query),
      ...(plan.body !== undefined ? { body: forDisplay(plan.body) } : {}),
    },
    ...(plan.warnings.length ? { warnings: plan.warnings } : {}),
    expiresAt: plan.expiresAt,
    toApply: `jortt apply ${plan.id}`,
  };
}

/** Makes a plan for a write. Nothing is sent to Jortt except a read of the current state. */
export async function runWrite(rt: Runtime, w: WriteRequest): Promise<number> {
  const warnings = [...(w.warnings ?? [])];
  const target = await readTarget(rt, w.endpoint, w.path, warnings);
  const plan = savePlan({
    command: w.command,
    endpointId: w.endpoint?.id,
    method: w.method.toUpperCase(),
    path: w.path,
    query: Object.keys(w.query).length ? w.query : undefined,
    body: w.body,
    summary: summarize(w.endpoint, w.method, w.path, w.body, target),
    dangerous: riskReasons(w.endpoint, w.method, w.body),
    target,
    warnings,
  });
  const view = planView(plan, rt.config.apiUrl);
  if (rt.out.json) {
    process.stdout.write(JSON.stringify({ ok: true, data: view }, null, 2) + "\n");
  } else {
    const lines = [`Plan ${plan.id} (nothing has been sent yet)`, `  ${plan.summary}`];
    for (const d of plan.dangerous) lines.push(`  ! ${d}`);
    for (const wn of plan.warnings) lines.push(`  warning: ${wn}`);
    lines.push(`  ${view.wouldSend.method} ${view.wouldSend.url}`);
    if (plan.body !== undefined) lines.push(JSON.stringify(forDisplay(plan.body), null, 2).replace(/^/gm, "  "));
    lines.push(`To do it: jortt apply ${plan.id}   (expires ${plan.expiresAt})`);
    process.stdout.write(lines.join("\n") + "\n");
  }
  return Exit.PLAN;
}

export async function applyPlan(rt: Runtime, id: string): Promise<number> {
  const plan = loadPlan(id);
  // Consume first so a plan can never be sent twice, even if this process dies mid-request.
  if (!consumePlan(id)) throw new JorttError(`Plan ${id} was already applied.`, Exit.NOT_FOUND, { key: "plan.not_found" });
  const res = await rt.client.request({ method: plan.method, path: plan.path, query: plan.query, body: plan.body });
  rt.success(unwrap(res.body) ?? { done: true }, {
    applied: plan.id,
    summary: plan.summary,
    ...(res.deprecated ? { deprecated: true } : {}),
  });
  return Exit.OK;
}
