import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildProgram } from "../src/cli.ts";
import { parseEnvFile } from "../src/config.ts";
import { JorttError } from "../src/errors.ts";
import type { AskOptions, Prompter } from "../src/prompt.ts";
import { buildReference } from "../src/reference.ts";
import { runSetup, writeEnvFile } from "../src/setup.ts";
import { installSkill } from "../src/skill.ts";
import { FakeJortt, json, runCli, testEnv } from "./helpers.ts";

/** Answers questions from a script and records what was asked and said. */
class ScriptedPrompter implements Prompter {
  asked: string[] = [];
  said: string[] = [];
  constructor(
    private answers: string[],
    readonly interactive = true,
  ) {}
  say(text = "") {
    this.said.push(text);
  }
  private next(question: string): string {
    this.asked.push(question);
    const a = this.answers.shift();
    if (a === undefined) throw new Error(`unexpected question: ${question}`);
    if (a === "<ctrl-c>") throw new JorttError("Setup cancelled; nothing was saved.");
    return a;
  }
  async ask(question: string, opts: AskOptions = {}) {
    return this.next(question) || opts.default || "";
  }
  async confirm(question: string, defaultYes: boolean) {
    const a = this.next(question);
    return a === "" ? defaultYes : a === "y";
  }
}

const GOOD = "Basic " + Buffer.from("good-client:good-secret").toString("base64");
const reference = () => "# ref\n";

describe("jortt setup", () => {
  let env: ReturnType<typeof testEnv>;
  let fake: FakeJortt;
  let vars: Record<string, string | undefined>;
  beforeEach(() => {
    env = testEnv();
    vars = { JORTT_CONFIG_DIR: env.dir, CLAUDE_SKILLS_DIR: join(env.dir, "skills"), PATH: process.env.PATH };
    fake = new FakeJortt().on("GET", "/v3/organizations/me", { data: { id: "org-1", company_name: "Voorbeeld BV" } }).install();
    fake.tokenHandler = (form, call) => {
      if (call.headers.get("authorization") !== GOOD) return json(401, { error: "invalid_client", error_description: "bad" });
      if (form.scope?.split(" ").some((s) => s.startsWith("reconciling"))) return json(400, { error: "invalid_scope" });
      return undefined;
    };
  });
  afterEach(() => {
    fake.restore();
    env.cleanup();
  });

  test("interactive: re-asks after wrong credentials, trims scopes the app lacks, saves privately", async () => {
    const io = new ScriptedPrompter(["bad-client", "bad-secret", "good-client", "good-secret", "y"]);
    const r = await runSetup({}, io, { reference, env: vars, cwd: env.dir });
    expect(io.asked).toEqual([
      "Client ID",
      "Client Secret (hidden)",
      "Client ID",
      "Client Secret (hidden)",
      "Install the Claude skill, so Claude Code knows how to use jortt?",
    ]);
    expect(io.said.join("\n")).toContain("did not accept");
    expect(r.organization).toEqual({ id: "org-1", company_name: "Voorbeeld BV" });
    expect(r.missingScopes).toEqual(["reconciling:read", "reconciling:write"]);
    expect(r.scopes).not.toContain("reconciling:read");

    const file = join(env.dir, ".env");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const saved = parseEnvFile(readFileSync(file, "utf8"));
    expect(saved.JORTT_CLIENT_ID).toBe("good-client");
    expect(saved.JORTT_CLIENT_SECRET).toBe("good-secret");
    expect(saved.JORTT_SCOPES).toBe(r.scopes.join(" "));
    expect(readFileSync(join(env.dir, "skills", "jortt", "reference.md"), "utf8")).toBe("# ref\n");
    expect(readFileSync(join(env.dir, "skills", "jortt", "SKILL.md"), "utf8")).toContain("name: jortt");
  });

  test("interactive: keeps saved credentials when confirmed, and keeps other JORTT_ settings", async () => {
    writeFileSync(join(env.dir, ".env"), "JORTT_CLIENT_ID=good-client\nJORTT_CLIENT_SECRET=good-secret\nJORTT_FOO=keep me\n");
    const io = new ScriptedPrompter(["", "n"]);
    const r = await runSetup({ scopes: "invoices:read organizations:read" }, io, { reference, env: vars, cwd: env.dir });
    expect(io.asked[0]).toContain("Use the saved credentials (Client ID good…ient)?");
    expect(r.skill).toBeNull();
    const saved = parseEnvFile(readFileSync(join(env.dir, ".env"), "utf8"));
    expect(saved.JORTT_FOO).toBe("keep me");
    expect(saved.JORTT_SCOPES).toBe("invoices:read organizations:read");
  });

  test("cancelling at the last question saves nothing", async () => {
    const io = new ScriptedPrompter(["good-client", "good-secret", "<ctrl-c>"]);
    await expect(runSetup({}, io, { reference, env: vars, cwd: env.dir })).rejects.toThrow(/cancelled/);
    expect(existsSync(join(env.dir, ".env"))).toBe(false);
  });

  test("non-interactive: uses flags, never asks, fails clearly without a secret", async () => {
    const quiet = new ScriptedPrompter([], false);
    const r = await runSetup(
      { clientId: "good-client", clientSecret: "good-secret", scopes: "invoices:read", skill: false },
      quiet,
      { reference, env: vars, cwd: env.dir },
    );
    expect(r.checked).toBe(true);
    expect(r.organization).toBeNull(); // no organizations:read, so not looked up
    expect(quiet.asked).toEqual([]);

    const empty = testEnv();
    try {
      await expect(
        runSetup({ clientId: "x" }, new ScriptedPrompter([], false), { reference, env: { JORTT_CONFIG_DIR: empty.dir }, cwd: empty.dir }),
      ).rejects.toThrow(/needs a Client Secret/);
    } finally {
      empty.cleanup();
    }
  });

  test("asks for the Organization ID when Jortt wants one", async () => {
    fake.restore();
    fake = new FakeJortt()
      .on("GET", "/v3/organizations/me", (call) =>
        call.headers.get("Organization-Id") === "org-2"
          ? json(200, { data: { id: "org-2", company_name: "Tweede BV" } })
          : json(401, { error: { key: "organization.header_required", message: "Organization-Id header required" } }),
      )
      .install();
    const io = new ScriptedPrompter(["good-client", "good-secret", "org-2", "n"]);
    const r = await runSetup({ scopes: "organizations:read" }, io, { reference, env: vars, cwd: env.dir });
    expect(io.asked[2]).toBe("Organization ID");
    expect(r.organization?.company_name).toBe("Tweede BV");
    expect(parseEnvFile(readFileSync(join(env.dir, ".env"), "utf8")).JORTT_ORGANIZATION_ID).toBe("org-2");
  });

  test("env file values with spaces and quotes survive a round trip", () => {
    const file = join(env.dir, "rt.env");
    writeEnvFile(file, { JORTT_CLIENT_SECRET: 'a b"c#d', JORTT_SCOPES: "x y" });
    expect(parseEnvFile(readFileSync(file, "utf8"))).toMatchObject({ JORTT_CLIENT_SECRET: 'a b"c#d', JORTT_SCOPES: "x y" });
  });

  test("CLI: setup without a terminal or credentials explains what to do", async () => {
    delete process.env.JORTT_CLIENT_ID;
    delete process.env.JORTT_CLIENT_SECRET;
    const r = await runCli("setup", "--no-interactive", "--json");
    expect(r.code).toBe(3);
    expect(r.json.error.hint).toContain("jortt setup");
  });
});

describe("skill install", () => {
  let env: ReturnType<typeof testEnv>;
  beforeEach(() => (env = testEnv()));
  afterEach(() => env.cleanup());

  test("installs, updates, and leaves a development symlink alone unless forced", async () => {
    const dir = join(env.dir, "skills", "jortt");
    const r = await runCli("skill", "install", "--dir", dir, "--json");
    expect(r.code).toBe(0);
    expect(r.json.data.action).toBe("installed");
    expect(readFileSync(join(dir, "reference.md"), "utf8")).toContain("# jortt command reference");
    expect(installSkill("x", { dir }).action).toBe("updated");

    const linked = join(env.dir, "linked");
    mkdirSync(join(env.dir, "repo-skill"));
    symlinkSync(join(env.dir, "repo-skill"), linked);
    expect(installSkill("x", { dir: linked }).action).toBe("linked");
    expect(lstatSync(linked).isSymbolicLink()).toBe(true);
    expect(installSkill("x", { dir: linked, force: true }).action).toBe("updated");
    expect(lstatSync(linked).isDirectory()).toBe(true);
  });

  test("the repo's reference.md matches the CLI (run `bun run reference` if this fails)", () => {
    const committed = readFileSync(new URL("../skill/jortt/reference.md", import.meta.url), "utf8");
    expect(buildReference(buildProgram())).toBe(committed);
  });
});
