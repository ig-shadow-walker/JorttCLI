import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram } from "../src/cli.ts";

export interface Call {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

type Handler = (call: Call) => Response | Promise<Response> | undefined;

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** A fake Jortt: token endpoint plus whatever routes a test adds. Records every call. */
export class FakeJortt {
  calls: Call[] = [];
  tokensIssued = 0;
  /** Answers token requests instead of the default "always issue"; return undefined to fall through. */
  tokenHandler?: (form: Record<string, string>, call: Call) => Response | undefined;
  private routes: Array<{ method: string; path: string | RegExp; handler: Handler }> = [];
  private original = globalThis.fetch;

  on(method: string, path: string | RegExp, handler: Handler | Record<string, unknown>) {
    this.routes.push({
      method,
      path,
      handler: typeof handler === "function" ? (handler as Handler) : () => json(200, handler),
    });
    return this;
  }

  apiCalls(): Call[] {
    return this.calls.filter((c) => c.url.hostname === "api.jortt.nl");
  }

  install() {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const method = (init?.method ?? "GET").toUpperCase();
      let body: unknown = init?.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          /* form body */
        }
      } else if (body instanceof URLSearchParams) {
        body = Object.fromEntries(body);
      }
      const call: Call = { method, url, headers: new Headers(init?.headers), body };
      this.calls.push(call);
      if (url.hostname === "app.jortt.nl" && url.pathname === "/oauth-provider/oauth/token") {
        const custom = this.tokenHandler?.(body as Record<string, string>, call);
        if (custom) return custom;
        this.tokensIssued++;
        return json(200, {
          access_token: `token-${this.tokensIssued}`,
          token_type: "Bearer",
          expires_in: 7200,
          scope: (body as Record<string, string>).scope,
        });
      }
      for (const r of this.routes) {
        const pathOk = typeof r.path === "string" ? r.path === url.pathname : r.path.test(url.pathname);
        if (r.method === method && pathOk) {
          const res = await r.handler(call);
          if (res) return res;
        }
      }
      return json(404, { error: { code: 404, key: "resource.not_found", message: `No fake route for ${method} ${url.pathname}` } });
    }) as typeof fetch;
    return this;
  }

  restore() {
    globalThis.fetch = this.original;
  }
}

/** Isolated config dir and credentials for one test. */
export function testEnv() {
  const dir = mkdtempSync(join(tmpdir(), "jortt-test-"));
  const saved = { ...process.env };
  process.env.JORTT_CONFIG_DIR = dir;
  process.env.JORTT_CLIENT_ID = "test-client";
  process.env.JORTT_CLIENT_SECRET = "test-secret";
  process.env.JORTT_SCOPES = "invoices:read invoices:write customers:read customers:write";
  process.env.CLAUDE_SKILLS_DIR = join(dir, "skills"); // never touch the real ~/.claude
  delete process.env.JORTT_OUTPUT;
  delete process.env.JORTT_ORGANIZATION_ID;
  return {
    dir,
    cleanup() {
      process.env = saved;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Runs the CLI in-process and captures stdout/stderr and the exit code. */
export async function runCli(...args: string[]) {
  let stdout = "";
  let stderr = "";
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((s: string | Uint8Array) => ((stdout += String(s)), true)) as typeof process.stdout.write;
  process.stderr.write = ((s: string | Uint8Array) => ((stderr += String(s)), true)) as typeof process.stderr.write;
  process.exitCode = 0;
  try {
    const program = buildProgram();
    program.exitOverride();
    program.configureOutput({ writeOut: (s) => (stdout += s), writeErr: (s) => (stderr += s) });
    await program.parseAsync(["bun", "jortt", ...args]);
  } catch (e) {
    const code = (e as { exitCode?: number }).exitCode;
    if (code === undefined) throw e;
    process.exitCode = code;
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
  const code = Number(process.exitCode ?? 0);
  process.exitCode = 0;
  let parsed: any;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }
  return { stdout, stderr, code, json: parsed };
}
