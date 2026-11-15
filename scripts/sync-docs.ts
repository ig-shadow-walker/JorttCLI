/**
 * Regenerates catalog/endpoints.json from the Jortt developer docs (https://developer.jortt.nl/).
 *
 * The docs page is more complete than the published swagger file, so it is the source of truth.
 * Only the current (v3) section is kept; v2/v1 duplicates are deprecated.
 *
 *   bun run sync-docs                 # fetch the live docs
 *   bun run sync-docs path/to/page    # parse a saved copy
 */
import type { Catalog, Endpoint, Field, Param, ParamIn } from "../src/catalog-types.ts";

const DOCS_URL = "https://developer.jortt.nl/";
const SWAGGER_URL = "https://api.jortt.nl/swagger_doc";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

export function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<li>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (ENTITIES[e] !== undefined) return ENTITIES[e]!;
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface Row extends Field {
  depth: number;
  in?: ParamIn;
}

function parseRows(table: string): Row[] {
  const rows: Row[] = [];
  for (const m of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const row = m[1]!;
    const name = row.match(/class="param-name[^"]*">([^<]+)/)?.[1];
    if (!name) continue; // header row
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]!);
    const pad = row.match(/padding-left:(\d+)px/);
    const nested = row.includes("param-nested");
    const depth = !nested ? 0 : pad ? 1 + Math.round((Number(pad[1]) - 14) / 16) : 1;
    const where = row.match(/class="param-in">([^<]+)/)?.[1] as ParamIn | undefined;
    rows.push({
      depth,
      name: htmlToText(name),
      type: htmlToText(row.match(/class="param-type">([^<]+)/)?.[1] ?? ""),
      required: row.includes('class="required"'),
      description: htmlToText(cells[cells.length - 1] ?? ""),
      ...(where ? { in: where } : {}),
    });
  }
  return rows;
}

/** Turns flat rows with depths into a tree. */
function nest(rows: Row[]): Row[] {
  const roots: Row[] = [];
  const stack: Row[] = [];
  for (const r of rows) {
    while (stack.length && stack[stack.length - 1]!.depth >= r.depth) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) (parent.fields ??= []).push(r);
    else roots.push(r);
    stack.push(r);
  }
  return roots;
}

function clean<T extends Field>(f: Row): T {
  const { depth: _d, fields, ...rest } = f;
  const out = { ...rest } as Field;
  if (fields?.length) out.fields = fields.map((c) => {
    const { in: _in, ...child } = clean<Field & { in?: ParamIn }>(c as Row);
    return child;
  });
  return out as T;
}

function section(body: string, label: string): string | undefined {
  const start = body.indexOf(`class="section-label">${label}<`);
  if (start < 0) return undefined;
  const end = body.indexOf("</table>", start);
  return body.slice(start, end);
}

export function parseDocs(html: string): Endpoint[] {
  // Section headings (<h2>) tell us which group an endpoint belongs to and where v3 ends.
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({
    at: m.index!,
    title: htmlToText(m[1]!),
  }));
  const blocks = html.split(/(?=<div class="endpoint" id=")/).slice(1);
  let offset = html.indexOf('<div class="endpoint" id="');
  const endpoints: Endpoint[] = [];
  for (const block of blocks) {
    const at = offset;
    offset += block.length;
    const anchor = block.match(/^<div class="endpoint" id="([^"]+)"/)?.[1];
    if (!anchor?.startsWith("v3-")) continue;
    const header = block.slice(0, block.indexOf('<div class="endpoint-body">'));
    const group = headings.filter((h) => h.at < at).pop()?.title ?? "Other";
    const method = htmlToText(header.match(/class="badge [a-z]+">([^<]+)/)?.[1] ?? "").toUpperCase();
    const path = htmlToText(header.match(/class="endpoint-path">([^<]+)/)?.[1] ?? "");
    const paramsTable = section(block, "Parameters");
    const responseTable = section(block, "Response body");
    const params = paramsTable ? nest(parseRows(paramsTable)).map((r) => clean<Param>(r)) : [];
    endpoints.push({
      id: anchor.slice(3),
      group,
      method: method as Endpoint["method"],
      path,
      summary: htmlToText(header.match(/class="endpoint-summary">([\s\S]*?)<\/span>/)?.[1] ?? ""),
      description: htmlToText(block.match(/class="endpoint-desc md-content">([\s\S]*?)<\/div>/)?.[1] ?? ""),
      deprecated: header.includes("deprecated-badge"),
      params,
      response: responseTable
        ? nest(parseRows(responseTable)).map((r) => {
            const { in: _in, ...f } = clean<Field & { in?: ParamIn }>(r);
            return f;
          })
        : [],
    });
  }
  return endpoints;
}

/** Collects enum values per field name from the (older, but enum-rich) swagger spec. */
export function swaggerEnums(spec: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (name: string, values: unknown) => {
    if (!Array.isArray(values) || !values.length) return;
    const merged = new Set([...(out.get(name) ?? []), ...values.map(String)]);
    out.set(name, [...merged]);
  };
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o.properties && typeof o.properties === "object") {
      for (const [name, prop] of Object.entries(o.properties as Record<string, { enum?: unknown }>)) add(name, prop?.enum);
    }
    if (typeof o.name === "string" && o.in && Array.isArray(o.enum)) add(o.name, o.enum);
    for (const v of Object.values(o)) walk(v);
  };
  walk(spec);
  // invoice_status in the spec is the entity's (draft/sent); the list filter accepts more, per the docs text.
  out.delete("invoice_status");
  return out;
}

function addEnums(fields: Field[] | undefined, enums: Map<string, string[]>) {
  for (const f of fields ?? []) {
    const e = enums.get(f.name);
    if (e && !f.enum && /^string$/i.test(f.type)) f.enum = e;
    addEnums(f.fields, enums);
  }
}

if (import.meta.main) {
  const src = process.argv[2];
  const html = src ? await Bun.file(src).text() : await (await fetch(DOCS_URL)).text();
  const endpoints = parseDocs(html);
  let swaggerSummaries = new Map<string, string>();
  try {
    const spec = (await (await fetch(SWAGGER_URL)).json()) as { paths?: Record<string, Record<string, { summary?: string }>> };
    const enums = swaggerEnums(spec);
    for (const e of endpoints) addEnums(e.params, enums);
    console.log(`Merged enum values for ${enums.size} field names from the swagger spec`);
    swaggerSummaries = new Map(
      Object.entries(spec.paths ?? {}).flatMap(([path, ops]) =>
        Object.entries(ops).map(([m, op]) => [`${m.toUpperCase()} ${path}`, op?.summary ?? ""] as [string, string]),
      ),
    );
  } catch (err) {
    console.warn(`Could not read the swagger spec for enum values: ${(err as Error).message}`);
  }
  // Some endpoints have no summary on the docs page; fall back to the swagger summary, then the description.
  for (const e of endpoints) {
    if (e.summary) continue;
    const alt = [e.path, e.path.replace(/^\/v3\//, "/v2/"), e.path.replace(/^\/v3\//, "/v1/"), e.path.replace(/^\/v3/, "")]
      .map((p) => swaggerSummaries.get(`${e.method} ${p}`))
      .find(Boolean);
    e.summary = (alt ?? e.description.split(/(?<=[.!?])\s/)[0] ?? "").replace(/\s+v\d$/i, "").trim() || `${e.method} ${e.path}`;
  }
  if (endpoints.length < 50) throw new Error(`Only found ${endpoints.length} endpoints; the docs layout may have changed.`);
  const catalog: Catalog = { source: DOCS_URL, syncedAt: new Date().toISOString(), endpoints };
  const out = new URL("../catalog/endpoints.json", import.meta.url);
  await Bun.write(out, JSON.stringify(catalog, null, 1) + "\n");
  const groups = new Map<string, number>();
  for (const e of endpoints) groups.set(e.group, (groups.get(e.group) ?? 0) + 1);
  console.log(`Wrote ${endpoints.length} endpoints to catalog/endpoints.json`);
  for (const [g, n] of groups) console.log(`  ${String(n).padStart(3)}  ${g}`);
}
