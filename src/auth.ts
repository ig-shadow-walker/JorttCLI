import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.ts";
import { Exit, JorttError } from "./errors.ts";

export interface CachedToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  scope: string;
  /** Identifies the credentials + scopes the token was issued for. */
  fingerprint: string;
}

/** Refresh this long before the token actually expires. */
const EXPIRY_MARGIN_MS = 120_000;
const TOKEN_TIMEOUT_MS = 30_000;

export function tokenPath(config: Config): string {
  return join(config.configDir, "token.json");
}

function fingerprint(config: Config): string {
  return new Bun.CryptoHasher("sha256")
    .update(`${config.tokenUrl}\n${config.clientId}\n${config.clientSecret}\n${config.scopes}`)
    .digest("hex")
    .slice(0, 16);
}

export function readCachedToken(config: Config): CachedToken | undefined {
  const file = tokenPath(config);
  if (!existsSync(file)) return undefined;
  try {
    const t = JSON.parse(readFileSync(file, "utf8")) as CachedToken;
    if (t.fingerprint !== fingerprint(config) || typeof t.accessToken !== "string") return undefined;
    return t;
  } catch {
    return undefined;
  }
}

function writeCachedToken(config: Config, token: CachedToken): void {
  mkdirSync(config.configDir, { recursive: true, mode: 0o700 });
  const file = tokenPath(config);
  writeFileSync(file, JSON.stringify(token, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
}

export function clearCachedToken(config: Config): boolean {
  const file = tokenPath(config);
  if (!existsSync(file)) return false;
  rmSync(file);
  return true;
}

/** Requests a new token with the client credentials grant. `cache: false` leaves the token file alone. */
export async function requestToken(config: Config, opts: { cache?: boolean } = {}): Promise<CachedToken> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: config.scopes }),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch (e) {
    throw new JorttError(`Could not reach the Jortt token endpoint: ${(e as Error).message}`, Exit.UNAVAILABLE, {
      key: "token.unreachable",
    });
  }
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok || typeof body.access_token !== "string") {
    const code = String(body.error ?? `http_${res.status}`);
    const desc = String(body.error_description ?? (text.slice(0, 200) || res.statusText));
    const hint =
      code === "invalid_scope"
        ? "JORTT_SCOPES asks for a scope your Jortt app was not registered with. Remove it, or add it to the app in Jortt."
        : code === "invalid_client" || res.status === 401
          ? "JORTT_CLIENT_ID or JORTT_CLIENT_SECRET is wrong."
          : undefined;
    throw new JorttError(`Getting a Jortt access token failed: ${code}: ${desc}`, res.status >= 500 ? Exit.UNAVAILABLE : Exit.AUTH, {
      status: res.status,
      key: `token.${code}`,
      hint,
    });
  }
  const expiresIn = Number(body.expires_in ?? 7200);
  const token: CachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: String(body.scope ?? config.scopes),
    fingerprint: fingerprint(config),
  };
  if (opts.cache !== false) writeCachedToken(config, token);
  return token;
}

/** Returns a valid token, from cache when possible. */
export async function getToken(config: Config, opts: { forceRefresh?: boolean } = {}): Promise<CachedToken> {
  if (!opts.forceRefresh) {
    const cached = readCachedToken(config);
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached;
  }
  return requestToken(config);
}
