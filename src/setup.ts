import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { requestToken } from "./auth.ts";
import {
  type Config,
  DEFAULT_API_URL,
  DEFAULT_SCOPES,
  DEFAULT_TOKEN_URL,
  configDir,
  normalizeScopes,
  parseEnvFile,
} from "./config.ts";
import { Exit, JorttError } from "./errors.ts";
import { JorttClient } from "./http.ts";
import type { Prompter } from "./prompt.ts";
import { type SkillInstall, defaultSkillDir, installSkill } from "./skill.ts";

export interface SetupOptions {
  clientId?: string;
  /** Already read from stdin by the command (never from argv, where it would end up in shell history). */
  clientSecret?: string;
  scopes?: string;
  organizationId?: string;
  /** undefined: ask (or yes when not interactive). */
  skill?: boolean;
  skillDir?: string;
  /** false: save without contacting Jortt. */
  check?: boolean;
}

export interface SetupDeps {
  /** reference.md for the skill, generated from the running CLI. */
  reference: () => string;
  env?: Record<string, string | undefined>;
  cwd?: string;
}

export interface SetupResult {
  envFile: string;
  clientId: string;
  scopes: string[];
  /** Scopes the CLI would like but the Jortt app doesn't have. */
  missingScopes: string[];
  organizationId: string | null;
  organization: { id: unknown; company_name: unknown } | null;
  checked: boolean;
  skill: SkillInstall | null;
  warnings: string[];
}

export function mask(s: string): string {
  return s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function quoteEnv(v: string): string {
  return /^[A-Za-z0-9_.:\/+=@-]*$/.test(v) ? v : `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Writes the credentials file (mode 600), keeping any other JORTT_* settings that were in it. */
export function writeEnvFile(file: string, values: Record<string, string | undefined>): void {
  const previous = existsSync(file) ? parseEnvFile(readFileSync(file, "utf8")) : {};
  const keep = Object.entries(previous).filter(([k, v]) => k.startsWith("JORTT_") && !(k in values) && v !== "");
  const lines = [
    "# Jortt CLI credentials, written by `jortt setup`. Only you can read this file.",
    "# Run `jortt setup` again to change them.",
    ...Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${quoteEnv(v!)}`),
    ...keep.map(([k, v]) => `${k}=${quoteEnv(v)}`),
    "",
  ];
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, lines.join("\n"), { mode: 0o600 });
  chmodSync(file, 0o600);
}

/**
 * Asks for each scope on its own, to find out which ones the Jortt app was registered with.
 * Used when Jortt refuses the full list with invalid_scope.
 */
export async function probeScopes(config: Config, scopes: string[]): Promise<{ granted: string[]; denied: string[] }> {
  const granted: string[] = [];
  const denied: string[] = [];
  for (const scope of scopes) {
    try {
      await requestToken({ ...config, scopes: scope }, { cache: false });
      granted.push(scope);
    } catch (e) {
      if (e instanceof JorttError && e.extra.key === "token.invalid_scope") denied.push(scope);
      else throw e;
    }
  }
  return { granted, denied };
}

function isBadCredentials(e: JorttError): boolean {
  return e.extra.key === "token.invalid_client" || (e.extra.status === 401 && e.extra.key !== "token.invalid_scope");
}

/** The guided setup behind `jortt setup`. Interactive when the prompter is; otherwise flags, env and the existing file. */
export async function runSetup(o: SetupOptions, io: Prompter, deps: SetupDeps): Promise<SetupResult> {
  const env = deps.env ?? process.env;
  const cwd = deps.cwd ?? process.cwd();
  const file = join(configDir(env), ".env");
  const saved = existsSync(file) ? parseEnvFile(readFileSync(file, "utf8")) : {};
  const known = (k: string): string | undefined => env[k] || saved[k] || undefined;
  const warnings: string[] = [];

  if (io.interactive) {
    io.say("");
    io.say("Jortt CLI setup");
    io.say("");
    io.say("This connects the `jortt` command to your Jortt administration. You need the Client ID and");
    io.say("Client Secret of the API app registered for it in Jortt (see https://developer.jortt.nl).");
    io.say("They are stored on this computer only, in a file only you can read.");
    io.say("");
  }

  let clientId = o.clientId;
  let secret = o.clientSecret;
  const savedId = known("JORTT_CLIENT_ID");
  const savedSecret = known("JORTT_CLIENT_SECRET");
  if (!clientId && !secret && savedId && savedSecret) {
    if (!io.interactive || (await io.confirm(`Use the saved credentials (Client ID ${mask(savedId)})?`, true))) {
      clientId = savedId;
      secret = savedSecret;
    }
  }
  if (!io.interactive) {
    clientId ??= savedId;
    secret ??= savedSecret;
    if (!clientId || !secret) {
      throw new JorttError(`Setup needs a ${!clientId ? "Client ID" : "Client Secret"}.`, Exit.AUTH, {
        key: "setup.needs_input",
        hint: "Run `jortt setup` in a terminal, or pass --client-id and pipe the secret into --client-secret-stdin.",
      });
    }
  }
  clientId ??= await io.ask("Client ID", { required: true });
  secret ??= await io.ask("Client Secret (hidden)", { secret: true, required: true });

  let scopes = normalizeScopes(o.scopes ?? known("JORTT_SCOPES"));
  let organizationId = o.organizationId ?? known("JORTT_ORGANIZATION_ID");
  const config = (): Config => ({
    clientId: clientId!,
    clientSecret: secret!,
    scopes,
    organizationId,
    apiUrl: (known("JORTT_API_URL") ?? DEFAULT_API_URL).replace(/\/+$/, ""),
    tokenUrl: known("JORTT_TOKEN_URL") ?? DEFAULT_TOKEN_URL,
    configDir: configDir(env),
    envFiles: [file],
  });

  // 1. Can we get a token? Fix what can be fixed here: wrong credentials, or scopes the app lacks.
  let checked = o.check !== false;
  let missingScopes: string[] = [];
  let organization: SetupResult["organization"] = null;
  if (checked) {
    if (io.interactive) io.say("Checking with Jortt…");
    let probed = false;
    for (let attempt = 1; ; attempt++) {
      try {
        const token = await requestToken(config());
        const granted = token.scope.split(/\s+/).filter(Boolean);
        const notGranted = scopes.split(" ").filter((s) => granted.length && !granted.includes(s));
        if (notGranted.length) {
          missingScopes = [...new Set([...missingScopes, ...notGranted])];
          scopes = granted.join(" ");
        }
        break;
      } catch (e) {
        if (!(e instanceof JorttError)) throw e;
        if (isBadCredentials(e)) {
          if (!io.interactive || attempt >= 3) throw e;
          io.say("Jortt did not accept that Client ID and Secret. Check them and try again.");
          clientId = await io.ask("Client ID", { default: clientId, required: true });
          secret = await io.ask("Client Secret (hidden)", { secret: true, required: true });
          continue;
        }
        if (e.extra.key === "token.invalid_scope" && !probed) {
          probed = true;
          io.say("Your Jortt app doesn't have every scope jortt asks for. Checking which ones it has…");
          const wanted = scopes.split(" ");
          const { granted, denied } = await probeScopes(config(), wanted);
          if (!granted.length) {
            throw new JorttError("Jortt accepted none of the scopes jortt asks for.", Exit.AUTH, {
              key: "setup.no_scopes",
              hint: `Add scopes to the app in Jortt (jortt can use: ${DEFAULT_SCOPES}), then run \`jortt setup\` again.`,
            });
          }
          missingScopes = denied;
          scopes = granted.join(" ");
          continue;
        }
        if (io.interactive && (await io.confirm(`${e.message}\nSave the credentials without checking them?`, false))) {
          checked = false;
          break;
        }
        throw e;
      }
    }
  }

  // 2. Which administration is this? Needs organizations:read; ask for the Organization ID if Jortt wants one.
  if (checked && scopes.split(" ").includes("organizations:read")) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await new JorttClient(config()).request({ method: "GET", path: "/v3/organizations/me" });
        const org = (res.body as { data?: Record<string, unknown> })?.data ?? {};
        organization = { id: org.id, company_name: org.company_name ?? org.name };
        break;
      } catch (e) {
        if (e instanceof JorttError && e.extra.key === "organization.header_required" && io.interactive && attempt < 3) {
          io.say("These credentials can reach more than one administration, so jortt needs to know which one.");
          organizationId = await io.ask("Organization ID", { default: organizationId, required: true });
          continue;
        }
        throw e;
      }
    }
  }

  // 3. Save. Every question is asked before this point, so cancelling a prompt leaves nothing behind.
  const wantSkill =
    o.skill ?? (io.interactive ? await io.confirm("Install the Claude skill, so Claude Code knows how to use jortt?", true) : true);
  writeEnvFile(file, {
    JORTT_CLIENT_ID: clientId,
    JORTT_CLIENT_SECRET: secret,
    JORTT_SCOPES: scopes,
    JORTT_ORGANIZATION_ID: organizationId,
  });

  for (const k of ["JORTT_CLIENT_ID", "JORTT_CLIENT_SECRET", "JORTT_SCOPES", "JORTT_ORGANIZATION_ID"]) {
    if (env[k]) warnings.push(`${k} is set in your environment and wins over ${file}.`);
  }
  for (const other of [env.JORTT_ENV_FILE, join(cwd, ".env")]) {
    if (!other || !existsSync(other) || realpathSync(other) === realpathSync(file)) continue;
    if (Object.keys(parseEnvFile(readFileSync(other, "utf8"))).some((k) => k.startsWith("JORTT_"))) {
      warnings.push(`${resolve(other)} also has JORTT_ settings and wins over ${file} when jortt runs from there.`);
    }
  }

  // 4. The Claude skill.
  const skill: SkillInstall | null = wantSkill
    ? installSkill(deps.reference(), { dir: o.skillDir ?? defaultSkillDir(env) })
    : null;

  return {
    envFile: file,
    clientId: mask(clientId),
    scopes: scopes.split(" "),
    missingScopes,
    organizationId: organizationId ?? null,
    organization,
    checked,
    skill,
    warnings,
  };
}

/** The folder of the running jortt binary, if it isn't on PATH (null when it is, or when running from source). */
export function binDirMissingFromPath(env: Record<string, string | undefined> = process.env): string | null {
  const exe = process.execPath;
  if (!basename(exe).startsWith("jortt")) return null;
  const real = (p: string) => {
    try {
      return realpathSync(resolve(p.replace(/^~(?=\/|$)/, homedir())));
    } catch {
      return undefined;
    }
  };
  const dir = dirname(exe);
  const target = real(dir) ?? dir;
  const onPath = (env.PATH ?? "").split(":").some((p) => p && real(p) === target);
  return onPath ? null : dir;
}

/** The closing text of an interactive setup. */
export function setupSummary(r: SetupResult): string[] {
  const lines: string[] = [""];
  if (r.organization) lines.push(`✓ Connected to ${String(r.organization.company_name ?? r.organization.id)}.`);
  else if (r.checked) lines.push("✓ Jortt accepted the credentials.");
  else lines.push("! Saved without checking. Run `jortt auth test` once Jortt is reachable.");
  lines.push(`✓ Saved to ${r.envFile} (only you can read it).`);
  if (r.missingScopes.length) {
    lines.push(`! Your Jortt app lacks these scopes, so the matching commands won't work: ${r.missingScopes.join(", ")}.`);
    lines.push("  Add them to the app in Jortt and run `jortt setup` again to use them.");
  }
  if (r.skill?.action === "linked") lines.push(`✓ Claude skill: ${r.skill.dir} is a development link; left as is.`);
  else if (r.skill) lines.push(`✓ Claude skill ${r.skill.action} in ${r.skill.dir}.`);
  for (const w of r.warnings) lines.push(`! ${w}`);
  const bin = binDirMissingFromPath();
  if (bin) lines.push(`! ${bin} is not on your PATH. Add it:  export PATH="${bin}:$PATH"`);
  lines.push("", "You're set. Try:", "  jortt invoices list --status unpaid");
  if (r.skill) lines.push("", 'Or ask Claude Code: "Which of my Jortt invoices are still unpaid?"');
  lines.push("");
  return lines;
}
