import { Command } from "commander";
import { type JsonObject, applySets, coerce, readBodyInput, toFlag, toOptKey, validateBody } from "../body.ts";
import type { Endpoint } from "../catalog-types.ts";
import { bodyFields, getEndpoint, pathParams, queryParams } from "../catalog.ts";
import { JorttError } from "../errors.ts";
import type { QueryValue } from "../http.ts";
import { type CommandSpec, type GroupSpec, groups } from "../registry.ts";
import { type Runtime, fillPath, runRead, runWrite } from "../runtime.ts";
import { RESERVED_FLAGS, action, collect, fieldTree, firstSentence, valueHint } from "./common.ts";

interface FieldOption {
  flag: string;
  key: string;
  field: string;
  type: string;
  where: "query" | "body";
}

/** Maps catalog endpoint id -> friendly command ("invoices list"). */
export const friendlyCommands = new Map<string, string>();
for (const g of groups) for (const c of g.commands) friendlyCommands.set(c.endpoint, `jortt ${g.name} ${c.name}`);

function subcommand(parent: Command, name: string): Command {
  return parent.commands.find((c) => c.name() === name) ?? parent.command(name).description(`${name} commands`);
}

export function commandHelp(e: Endpoint, spec?: CommandSpec): string {
  const lines = ["", `Calls: ${e.method} ${e.path}   (endpoint id: ${e.id})`];
  if (e.method !== "GET") {
    lines.push("This changes data: it makes a plan and exits with code 2. Run `jortt apply <plan-id>` to do it.");
  }
  if (e.description) lines.push("", firstSentence(e.description, 400));
  const fields = bodyFields(e);
  if (fields?.length) {
    lines.push(
      "",
      "Body fields (* = required). Pass top-level fields as --flags, everything with --data '<json>',",
      "--data-file <file>, or --set key.path=value:",
      ...fieldTree(fields),
    );
  }
  if (spec?.examples?.length) lines.push("", "Examples:", ...spec.examples.map((x) => `  ${x}`));
  return lines.join("\n");
}

export function buildCommand(parent: Command, spec: CommandSpec): Command {
  const e = getEndpoint(spec.endpoint);
  const parts = spec.name.split(" ");
  let host = parent;
  for (const p of parts.slice(0, -1)) host = subcommand(host, p);
  const cmd = host.command(parts[parts.length - 1]!).description(spec.summary ?? e.summary);
  if (spec.aliases) cmd.aliases(spec.aliases);

  const pathNames = pathParams(e);
  const argNames = pathNames.map((p, i) => spec.args?.[i] ?? toFlag(p));
  for (const a of argNames) cmd.argument(`<${a}>`);
  for (const a of spec.extraArgs ?? []) cmd.argument(a);

  const fieldOpts: FieldOption[] = [];
  const used = new Set<string>(RESERVED_FLAGS);
  const addOpt = (flag: string, field: string, type: string, where: "query" | "body", desc: string, required: boolean, options?: string[]) => {
    if (used.has(flag)) return;
    used.add(flag);
    fieldOpts.push({ flag, key: toOptKey(flag), field, type, where });
    cmd.option(`--${flag} ${valueHint(type, options)}`, `${firstSentence(desc) || field}${required ? " (required)" : ""}`);
  };

  const query = queryParams(e);
  const paged = query.some((q) => q.name === "page");
  for (const q of query) if (q.name !== "page") addOpt(toFlag(q.name), q.name, q.type, "query", q.description, q.required, q.enum);
  const fields = bodyFields(e);
  for (const f of fields ?? []) addOpt(toFlag(f.name), f.name, f.type, "body", f.description, f.required, f.enum);
  for (const [alias, target] of Object.entries(spec.optionAliases ?? {})) {
    const q = query.find((x) => x.name === target);
    const f = fields?.find((x) => x.name === target);
    const src = q ?? f;
    if (src) addOpt(alias, target, src.type, q ? "query" : "body", `Same as --${toFlag(target)}`, false, src.enum);
  }

  if (paged) {
    cmd.option("--page <number>", "Page to fetch (100 per page)");
    cmd.option("--all", "Fetch every page (stops at --limit)");
  }
  if (fields) {
    cmd.option("-d, --data <json>", "Request body as JSON (merged under the --flags)");
    cmd.option("--data-file <path>", "Read the JSON body from a file (- for stdin)");
    cmd.option("--set <key=value>", "Set a body field by dotted path, e.g. line_items.0.quantity=2 (repeatable)", collect, []);
    cmd.option("--no-validate", "Don't check required fields before making the plan");
  }
  if (spec.download) cmd.option("--out <file>", "Save the file behind the download link here");

  cmd.addHelpText("after", commandHelp(e, spec));

  cmd.action(
    action(async (rt: Runtime, c: Command, ...args: unknown[]) => {
      const opts = c.opts() as Record<string, unknown>;
      const pathValues: Record<string, string> = {};
      pathNames.forEach((p, i) => (pathValues[p] = String(args[i])));
      const extra = args.slice(pathNames.length);
      const path = fillPath(e.path, pathValues);

      const q: Record<string, QueryValue> = {};
      const body: JsonObject = { ...(spec.defaults ?? {}) };
      if (spec.buildBody) Object.assign(body, await spec.buildBody(extra));
      const input = fields ? readBodyInput(opts.data as string | undefined, opts.dataFile as string | undefined) : undefined;
      if (input) Object.assign(body, input);

      for (const o of fieldOpts) {
        const raw = opts[o.key];
        if (raw === undefined) continue;
        const value = coerce(String(raw), o.type, `--${o.flag}`);
        if (o.where === "query") q[o.field] = value as QueryValue;
        else body[o.field] = value;
      }
      if (paged && opts.page !== undefined) q.page = coerce(String(opts.page), "integer", "--page") as number;

      const missingQuery = query.filter((p) => p.required && (q[p.name] === undefined || q[p.name] === ""));
      if (missingQuery.length) {
        throw new JorttError(`Missing required option: ${missingQuery.map((p) => `--${toFlag(p.name)}`).join(", ")}`);
      }

      if (e.method === "GET") {
        return runRead(rt, { endpoint: e, path, query: q, paged, all: !!opts.all, out: opts.out as string | undefined });
      }

      let finalBody: JsonObject | undefined;
      const warnings: string[] = [];
      if (fields) {
        finalBody = applySets(body, (opts.set as string[]) ?? [], fields);
        const v = validateBody(finalBody, fields);
        if (v.missing.length && opts.validate !== false) {
          throw new JorttError(`Missing required body fields: ${v.missing.join(", ")}`, 1, {
            key: "body.missing_fields",
            hint: `See \`jortt ${c.parent?.name()} ${c.name()} --help\` for the fields. Use --no-validate if the docs are wrong.`,
          });
        }
        if (v.unknown.length) warnings.push(`Fields the Jortt docs don't list (sent anyway): ${v.unknown.join(", ")}`);
        if (v.invalid.length) warnings.push(`Values outside the documented options: ${v.invalid.join("; ")}`);
      }
      return runWrite(rt, {
        endpoint: e,
        method: e.method,
        path,
        query: q,
        body: finalBody,
        command: commandLine(),
        warnings,
      });
    }),
  );
  return cmd;
}

export function commandLine(): string {
  const s = ["jortt", ...process.argv.slice(2)].map((a) => (/[\s'"]/.test(a) ? JSON.stringify(a) : a)).join(" ");
  return s.length > 600 ? s.slice(0, 600) + "…" : s;
}

export function buildGroup(program: Command, g: GroupSpec): Command {
  const group = program.command(g.name).description(g.summary);
  if (g.aliases) group.aliases(g.aliases);
  for (const spec of g.commands) buildCommand(group, spec);
  return group;
}

export function registerResources(program: Command) {
  for (const g of groups) buildGroup(program, g);
}
