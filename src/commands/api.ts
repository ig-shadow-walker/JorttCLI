import type { Command } from "commander";
import { type JsonObject, applySets, readBodyInput, validateBody } from "../body.ts";
import { bodyFields, catalog, matchEndpoint, queryParams, resolveId, searchEndpoints } from "../catalog.ts";
import { Exit, JorttError } from "../errors.ts";
import type { QueryValue } from "../http.ts";
import { type Runtime, runRead, runWrite } from "../runtime.ts";
import { action, collect, fieldTree } from "./common.ts";
import { commandLine, friendlyCommands } from "./resources.ts";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

function parseQueryPairs(pairs: string[]): Record<string, QueryValue> {
  const out: Record<string, QueryValue> = {};
  for (const p of pairs) {
    const eq = p.indexOf("=");
    if (eq <= 0) throw new JorttError(`--query needs key=value, got "${p}".`);
    const k = p.slice(0, eq).replace(/\[\]$/, "");
    const v = p.slice(eq + 1);
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [String(prev), v];
  }
  return out;
}

export function registerApi(program: Command) {
  program
    .command("api")
    .description("Call any Jortt endpoint directly (escape hatch for anything without a friendly command)")
    .argument("<method>", "GET, POST, PUT, DELETE or PATCH")
    .argument("<path>", "Path such as /v3/invoices or /v3/customers/<id>")
    .option("-q, --query <key=value>", "Query parameter (repeatable)", collect, [])
    .option("-d, --data <json>", "Request body as JSON")
    .option("--data-file <path>", "Read the JSON body from a file (- for stdin)")
    .option("--set <key=value>", "Set a body field by dotted path (repeatable)", collect, [])
    .option("--all", "For list endpoints: fetch every page")
    .option("--out <file>", "For download endpoints: save the file behind the link")
    .addHelpText(
      "after",
      [
        "",
        "GET runs straight away. Any other method makes a plan (exit code 2); run `jortt apply <plan-id>` to send it.",
        "Find paths with `jortt endpoints <words>` and their fields with `jortt describe <endpoint-id>`.",
        "",
        "Examples:",
        "  jortt api GET /v3/invoices -q invoice_status=late --all --json",
        `  jortt api POST /v3/labels -d '{"description":"Q4 campaign"}'`,
      ].join("\n"),
    )
    .action(
      action(async (rt: Runtime, c: Command, method: unknown, path: unknown) => {
        const opts = c.opts() as { query: string[]; data?: string; dataFile?: string; set: string[]; all?: boolean; out?: string };
        const m = String(method).toUpperCase();
        if (!METHODS.includes(m)) throw new JorttError(`Unknown method ${method}. Use one of ${METHODS.join(", ")}.`);
        let p = String(path);
        if (!/^https?:\/\//.test(p) && !p.startsWith("/")) p = `/${p}`;
        const [bare, qs] = p.split("?") as [string, string | undefined];
        const query = { ...Object.fromEntries(new URLSearchParams(qs ?? "")), ...parseQueryPairs(opts.query) };
        const endpoint = matchEndpoint(m, bare.replace(/^https?:\/\/[^/]+/, ""));

        if (m === "GET") {
          const paged = !!opts.all || !!endpoint && queryParams(endpoint).some((x) => x.name === "page");
          return runRead(rt, { endpoint, path: bare, query, paged, all: opts.all, out: opts.out });
        }
        const fields = endpoint ? bodyFields(endpoint) : undefined;
        const input = readBodyInput(opts.data, opts.dataFile);
        let body: JsonObject | undefined = input || opts.set.length ? applySets({ ...(input ?? {}) }, opts.set, fields) : undefined;
        const warnings: string[] = [];
        if (!endpoint) warnings.push(`${m} ${bare} is not in the Jortt docs catalog; it is sent as given.`);
        if (body && fields) {
          const v = validateBody(body, fields);
          if (v.missing.length) warnings.push(`The docs list these as required but they are missing: ${v.missing.join(", ")}`);
          if (v.unknown.length) warnings.push(`Fields the docs don't list: ${v.unknown.join(", ")}`);
          if (v.invalid.length) warnings.push(`Values outside the documented options: ${v.invalid.join("; ")}`);
        }
        if (body && !Object.keys(body).length) body = {};
        return runWrite(rt, { endpoint, method: m, path: bare, query, body, command: commandLine(), warnings });
      }),
    );

  program
    .command("endpoints")
    .description("List or search every Jortt API endpoint (from the bundled docs catalog)")
    .argument("[words...]", "Words to match in the id, path, group or summary")
    .option("--group <name>", "Only this docs group, e.g. Invoices")
    .action(
      action(async (rt: Runtime, c: Command, words: unknown) => {
        const opts = c.opts() as { group?: string };
        const list = searchEndpoints((words as string[] | undefined)?.join(" "), opts.group);
        rt.success(
          list.map((e) => ({
            id: e.id,
            method: e.method,
            path: e.path,
            group: e.group,
            summary: e.summary,
            command: friendlyCommands.get(e.id) ?? `jortt api ${e.method} ${e.path}`,
          })),
          { total: list.length, catalog_synced: catalog.syncedAt },
        );
        return Exit.OK;
      }),
    );

  program
    .command("describe")
    .description("Show an endpoint's parameters and body fields")
    .argument("<endpoint>", 'Endpoint id, "METHOD /path", or words that match one endpoint')
    .action(
      action(async (rt: Runtime, _c: Command, id: unknown) => {
        const e = resolveId(String(id));
        const command = friendlyCommands.get(e.id) ?? `jortt api ${e.method} ${e.path}`;
        if (rt.out.json) {
          rt.success({ ...e, command });
          return Exit.OK;
        }
        const lines = [`${e.method} ${e.path}   (${e.id}, ${e.group})`, e.summary, `Command: ${command}`];
        if (e.description) lines.push("", e.description);
        const groupsIn = ["path", "query"] as const;
        for (const where of groupsIn) {
          const ps = e.params.filter((p) => p.in === where);
          if (ps.length) lines.push("", `${where} parameters (* = required):`, ...fieldTree(ps));
        }
        const fields = bodyFields(e);
        if (fields?.length) lines.push("", "Body fields (* = required):", ...fieldTree(fields));
        if (e.response.length) lines.push("", "Response:", ...fieldTree(e.response));
        process.stdout.write(lines.join("\n") + "\n");
        return Exit.OK;
      }),
    );
}
