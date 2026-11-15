import { clearCachedToken, getToken } from "./auth.ts";
import type { Config } from "./config.ts";
import { Exit, JorttError, fromApiError } from "./errors.ts";

export type QueryValue = string | number | boolean | Array<string | number> | undefined | null;

export interface RequestOptions {
  method: string;
  /** Path such as /v3/invoices, or an absolute https://api.jortt.nl/... URL. */
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  /** True when Jortt marked the endpoint as deprecated (Deprecation header). */
  deprecated: boolean;
}

export interface PageResult {
  items: unknown[];
  pagesFetched: number;
  firstPage: number;
  /** Next page number to fetch, or null when there are no more. */
  nextPage: number | null;
  deprecated: boolean;
}

export interface ClientOptions {
  verbose?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Jortt allows 10 requests/second; keep a small gap between requests. */
const MIN_GAP_MS = 110;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

export function buildUrl(apiUrl: string, path: string, query: Record<string, QueryValue> = {}): string {
  const url = new URL(/^https?:\/\//.test(path) ? path : `${apiUrl}${path.startsWith("/") ? "" : "/"}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      url.searchParams.delete(`${k}[]`);
      for (const item of v) url.searchParams.append(`${k}[]`, String(item));
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export class JorttClient {
  private lastRequestAt = 0;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    readonly config: Config,
    private readonly opts: ClientOptions = {},
  ) {
    this.sleep = opts.sleep ?? ((ms) => Bun.sleep(ms));
  }

  private log(msg: string) {
    if (this.opts.verbose) process.stderr.write(`[jortt] ${msg}\n`);
  }

  private async throttle() {
    const wait = this.lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = Date.now();
  }

  async request(o: RequestOptions): Promise<ApiResponse> {
    const method = o.method.toUpperCase();
    const idempotent = method === "GET";
    const url = buildUrl(this.config.apiUrl, o.path, o.query);
    if (!url.startsWith(this.config.apiUrl + "/")) {
      throw new JorttError(`Refusing to send credentials to ${new URL(url).origin}; only ${this.config.apiUrl} is allowed.`);
    }
    const maxRetries = this.opts.maxRetries ?? 3;
    let refreshed = false;

    for (let attempt = 0; ; attempt++) {
      const token = await getToken(this.config);
      await this.throttle();
      this.log(`${method} ${url}${attempt ? ` (retry ${attempt})` : ""}`);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
        "User-Agent": "jortt-cli",
      };
      if (this.config.organizationId) headers["Organization-Id"] = this.config.organizationId;
      if (o.body !== undefined) headers["Content-Type"] = "application/json";

      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: o.body === undefined ? undefined : JSON.stringify(o.body),
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 30_000),
        });
      } catch (e) {
        const err = e as Error;
        const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
        if (idempotent && attempt < maxRetries) {
          await this.sleep(backoff(attempt));
          continue;
        }
        throw new JorttError(
          timedOut ? "Jortt did not answer in time." : `Could not reach Jortt: ${err.message}`,
          Exit.UNAVAILABLE,
          {
            key: timedOut ? "request.timeout" : "request.network",
            hint: idempotent
              ? undefined
              : "The change may or may not have been made. Check with a read command before trying again.",
          },
        );
      }

      const text = await res.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { raw: text.slice(0, 2000) };
        }
      }
      const deprecated = res.headers.has("deprecation");

      if (res.ok) return { status: res.status, body, deprecated };

      const key = (body as { error?: { key?: string } } | null)?.error?.key ?? "";
      // An expired/invalid token was rejected before anything happened, so retrying is safe for writes too.
      if (res.status === 401 && !refreshed && (key.startsWith("access_token.") || key === "")) {
        this.log(`token rejected (${key || "401"}), fetching a new one`);
        clearCachedToken(this.config);
        refreshed = true;
        continue;
      }
      // Throttled requests were not processed, so they can be retried for any method.
      const retryable = res.status === 429 || (idempotent && RETRY_STATUSES.has(res.status));
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
        continue;
      }
      const err = fromApiError(res.status, body);
      if (!idempotent && err.exitCode === Exit.UNAVAILABLE && res.status !== 429 && !err.extra.hint) {
        err.extra.hint = "The change may or may not have been made. Check with a read command before trying again.";
      }
      throw err;
    }
  }

  /** Fetches one page, or every page with `all`, of a list endpoint. */
  async paginate(o: RequestOptions, opts: { all?: boolean; limit?: number; maxPages?: number } = {}): Promise<PageResult> {
    const firstPage = Number(o.query?.page ?? 1) || 1;
    const maxPages = opts.maxPages ?? 100;
    const items: unknown[] = [];
    let page = firstPage;
    let pagesFetched = 0;
    let deprecated = false;
    for (;;) {
      const res = await this.request({ ...o, query: { ...o.query, page } });
      pagesFetched++;
      deprecated ||= res.deprecated;
      const body = res.body as { data?: unknown; _links?: { next?: { href?: string } | null } } | null;
      const data = body?.data;
      if (Array.isArray(data)) items.push(...data);
      else if (data !== undefined) items.push(data);
      const next = body?._links?.next?.href ? page + 1 : null;
      const full = opts.limit !== undefined && items.length >= opts.limit;
      if (!opts.all || next === null || full || pagesFetched >= maxPages) {
        return {
          items: opts.limit !== undefined ? items.slice(0, opts.limit) : items,
          pagesFetched,
          firstPage,
          nextPage: next,
          deprecated,
        };
      }
      page = next;
    }
  }
}

function backoff(attempt: number): number {
  return Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 200);
}
