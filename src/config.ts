import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import { Exit, JorttError } from "./errors.ts";

/**
 * Every scope a jortt command can use (Jortt's published list, minus organizations:write, which no
 * command needs). `jortt setup` trims this to what the user's Jortt app was registered with.
 */
export const DEFAULT_SCOPES = [
  "organizations:read",
  "customers:read",
  "customers:write",
  "invoices:read",
  "invoices:write",
  "estimates:read",
  "estimates:write",
  "expenses:read",
  "expenses:write",
  "inbox:write",
  "reports:read",
  "payroll:read",
  "payroll:write",
  "financing:read",
  "reconciling:read",
  "reconciling:write",
].join(" ");

export const DEFAULT_API_URL = "https://api.jortt.nl";
export const DEFAULT_TOKEN_URL = "https://app.jortt.nl/oauth-provider/oauth/token";

/** "a, b  c" -> "a b c"; empty -> the default scopes. */
export function normalizeScopes(s: string | undefined): string {
  const list = (s ?? "").split(/[\s,]+/).filter(Boolean);
  return list.length ? [...new Set(list)].join(" ") : DEFAULT_SCOPES;
}

const schema = z.object({
  JORTT_CLIENT_ID: z.string({ error: "is missing" }).trim().min(1, "is empty"),
  JORTT_CLIENT_SECRET: z.string({ error: "is missing" }).trim().min(1, "is empty"),
  JORTT_SCOPES: z.string().optional().transform(normalizeScopes),
  JORTT_ORGANIZATION_ID: z.string().trim().optional().transform((s) => s || undefined),
  JORTT_API_URL: z.url().default(DEFAULT_API_URL).transform((s) => s.replace(/\/+$/, "")),
  JORTT_TOKEN_URL: z.url().default(DEFAULT_TOKEN_URL),
});

export interface Config {
  clientId: string;
  clientSecret: string;
  scopes: string;
  organizationId?: string;
  apiUrl: string;
  tokenUrl: string;
  configDir: string;
  /** The credentials file that was read, if there is one. */
  credentialsFile: string | null;
}

/** Parser for the credentials file: KEY=value lines, optional quotes, # comments. */
export function parseCredentials(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2]!;
    const q = value[0];
    if ((q === '"' || q === "'") && value.lastIndexOf(q) > 0) {
      value = value.slice(1, value.lastIndexOf(q));
      if (q === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    out[m[1]!] = value;
  }
  return out;
}

export function expandHome(p: string): string {
  return p === "~" || p.startsWith("~/") || p.startsWith("~\\") ? join(homedir(), p.slice(1)) : p;
}

/** ~/.config/jortt on macOS and Linux, %APPDATA%\\jortt on Windows; JORTT_CONFIG_DIR overrides both. */
export function configDir(env: Record<string, string | undefined> = process.env): string {
  if (env.JORTT_CONFIG_DIR) return resolve(expandHome(env.JORTT_CONFIG_DIR));
  if (process.platform === "win32") return join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "jortt");
  return join(homedir(), ".config", "jortt");
}

/** Where `jortt setup` saves the credentials: <config dir>/credentials (mode 600; on Windows, your user profile's ACL). */
export function credentialsPath(env: Record<string, string | undefined> = process.env): string {
  return join(configDir(env), "credentials");
}

/**
 * Builds the config from the credentials file that `jortt setup` writes. JORTT_* environment
 * variables win over the file, for CI and containers. Nothing is read from the current folder.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const merged: Record<string, string> = {};
  const file = credentialsPath(env);
  const found = existsSync(file);
  if (found) {
    for (const [k, v] of Object.entries(parseCredentials(readFileSync(file, "utf8")))) {
      if (k.startsWith("JORTT_") && v !== "") merged[k] = v;
    }
  }
  for (const [k, v] of Object.entries(env)) if (k.startsWith("JORTT_") && v) merged[k] = v;

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    throw new JorttError("jortt is not connected to Jortt yet.", Exit.AUTH, {
      key: "config.missing",
      hint: found
        ? `${file} is incomplete. Run \`jortt setup\` in a terminal to fix it.`
        : "Run `jortt setup` in a terminal: it asks for your Jortt Client ID and Secret, checks them and saves them.",
    });
  }
  const c = parsed.data;
  return {
    clientId: c.JORTT_CLIENT_ID,
    clientSecret: c.JORTT_CLIENT_SECRET,
    scopes: c.JORTT_SCOPES,
    organizationId: c.JORTT_ORGANIZATION_ID,
    apiUrl: c.JORTT_API_URL,
    tokenUrl: c.JORTT_TOKEN_URL,
    configDir: configDir(env),
    credentialsFile: found ? file : null,
  };
}
