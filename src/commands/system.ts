import type { Command } from "commander";
import { clearCachedToken, getToken, readCachedToken, tokenPath } from "../auth.ts";
import { configDir, envFileCandidates } from "../config.ts";
import { Exit } from "../errors.ts";
import { mask } from "../setup.ts";
import { listPlans, loadPlan, consumePlan, plansDir } from "../plans.ts";
import { type Runtime, applyPlan, planView, runRead } from "../runtime.ts";
import { action } from "./common.ts";


export function registerSystem(program: Command) {
  program
    .command("apply")
    .description("Send a change that a write command planned (one plan, one apply)")
    .argument("<plan-id>", "The id from the plan (toApply)")
    .action(action(async (rt: Runtime, _c: Command, id: unknown) => applyPlan(rt, String(id))));

  const plans = program.command("plans").description("Pending plans (writes waiting for `jortt apply`)");
  plans
    .command("list")
    .description("Plans that can still be applied")
    .action(
      action(async (rt: Runtime) => {
        rt.success(
          listPlans().map((p) => ({ id: p.id, summary: p.summary, dangerous: p.dangerous.length > 0, expiresAt: p.expiresAt })),
          { dir: plansDir() },
        );
        return Exit.OK;
      }),
    );
  plans
    .command("show")
    .description("Show what a plan would send")
    .argument("<plan-id>")
    .action(
      action(async (rt: Runtime, _c: Command, id: unknown) => {
        rt.success(planView(loadPlan(String(id)), rt.config.apiUrl));
        return Exit.OK;
      }),
    );
  plans
    .command("discard")
    .description("Throw a plan away without sending it")
    .argument("<plan-id>")
    .action(
      action(async (rt: Runtime, _c: Command, id: unknown) => {
        rt.success({ discarded: consumePlan(String(id)), planId: String(id) });
        return Exit.OK;
      }),
    );

  const auth = program.command("auth").description("Credentials and access token");
  auth
    .command("status")
    .description("Show which credentials and env files are used (no network)")
    .action(
      action(async (rt: Runtime) => {
        const c = rt.config;
        const t = readCachedToken(c);
        rt.success({
          clientId: mask(c.clientId),
          scopes: c.scopes.split(" "),
          organizationId: c.organizationId ?? null,
          apiUrl: c.apiUrl,
          envFilesUsed: c.envFiles,
          envFilesSearched: envFileCandidates(),
          configDir: configDir(),
          token: t
            ? { cached: true, expiresAt: new Date(t.expiresAt).toISOString(), grantedScopes: t.scope.split(" "), file: tokenPath(c) }
            : { cached: false },
        });
        return Exit.OK;
      }),
    );
  auth
    .command("test")
    .description("Get a fresh token and read the administration, to check everything works")
    .action(
      action(async (rt: Runtime) => {
        const t = await getToken(rt.config, { forceRefresh: true });
        const res = await rt.client.request({ method: "GET", path: "/v3/organizations/me" });
        const org = (res.body as { data?: Record<string, unknown> })?.data ?? {};
        rt.success({
          ok: true,
          organization: { id: org.id, company_name: org.company_name ?? org.name },
          grantedScopes: t.scope.split(" "),
          tokenExpiresAt: new Date(t.expiresAt).toISOString(),
        });
        return Exit.OK;
      }),
    );
  auth
    .command("refresh")
    .description("Throw away the cached token and get a new one")
    .action(
      action(async (rt: Runtime) => {
        const t = await getToken(rt.config, { forceRefresh: true });
        rt.success({ refreshed: true, grantedScopes: t.scope.split(" "), expiresAt: new Date(t.expiresAt).toISOString() });
        return Exit.OK;
      }),
    );
  auth
    .command("clear")
    .description("Delete the cached token")
    .action(
      action(async (rt: Runtime) => {
        rt.success({ cleared: clearCachedToken(rt.config) });
        return Exit.OK;
      }),
    );

  program
    .command("whoami")
    .description("The Jortt administration these credentials act on")
    .action(
      action(async (rt: Runtime) =>
        runRead(rt, { path: "/v3/organizations/me", query: {}, paged: false }),
      ),
    );
}
