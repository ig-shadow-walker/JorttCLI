import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import { Exit, JorttError } from "./errors.ts";

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
  "receipts:read",
  "inbox:write",
  "reports:read",
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
  /** Env files that were read, in priority order. */
  envFiles: string[];
}

/** Minimal .env parser: KEY=value, optional quotes, # comments, `export ` prefix. */
export function parseEnvFile(text: string): Record<string, string> {
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
  return p === "~" || p.startsWith("~/") ? join(homedir(), p.slice(1)) : p;
}

export function configDir(env: Record<string, string | undefined> = process.env): string {
  return resolve(expandHome(env.JORTT_CONFIG_DIR || join(homedir(), ".config", "jortt")));
}

/** Env files to read, highest priority first. */
export function envFileCandidates(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): string[] {
  const list: string[] = [];
  if (env.JORTT_ENV_FILE) list.push(resolve(expandHome(env.JORTT_ENV_FILE)));
  list.push(resolve(cwd, ".env"));
  list.push(join(configDir(env), ".env"));
  return [...new Set(list)];
}

/**
 * Builds the config. Real environment variables win, then the env files in candidate order.
 * Only JORTT_* keys are taken from files, so an unrelated project's .env can't leak in.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): Config {
  const merged: Record<string, string> = {};
  const envFiles: string[] = [];
  for (const file of envFileCandidates(env, cwd).reverse()) {
    if (!existsSync(file)) continue;
    envFiles.unshift(file);
    for (const [k, v] of Object.entries(parseEnvFile(readFileSync(file, "utf8")))) {
      if (k.startsWith("JORTT_") && v !== "") merged[k] = v;
    }
  }
  for (const [k, v] of Object.entries(env)) if (k.startsWith("JORTT_") && v) merged[k] = v;

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
    throw new JorttError(`Jortt credentials are not set up: ${problems.join("; ")}`, Exit.AUTH, {
      key: "config.invalid",
      hint:
        `Run \`jortt setup\` in a terminal (it asks for the Client ID and Secret and saves them), or put ` +
        `JORTT_CLIENT_ID and JORTT_CLIENT_SECRET in ${join(configDir(env), ".env")}. ` +
        `Looked in: ${envFileCandidates(env, cwd).join(", ")}`,
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
    envFiles,
  };
}
