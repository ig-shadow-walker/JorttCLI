import type { Command } from "commander";
import { Exit, JorttError } from "../errors.ts";
import { type Prompter, silentPrompter, terminalPrompter } from "../prompt.ts";
import { buildReference } from "../reference.ts";
import type { Runtime } from "../runtime.ts";
import { binDirMissingFromPath, runSetup, setupSummary } from "../setup.ts";
import { installSkill } from "../skill.ts";
import { action } from "./common.ts";

function root(cmd: Command): Command {
  let c = cmd;
  while (c.parent) c = c.parent;
  return c;
}

interface SetupFlags {
  clientId?: string;
  clientSecretStdin?: boolean;
  scopes?: string;
  organizationId?: string;
  skill?: boolean;
  skillDir?: string;
  check?: boolean;
  interactive?: boolean;
}

/** Tests replace this to script the answers. */
export const prompters = {
  make(interactive: boolean): Prompter {
    return interactive ? terminalPrompter() : silentPrompter();
  },
};

export function registerSetup(program: Command) {
  program
    .command("setup")
    .alias("init")
    .description("Connect jortt to Jortt: asks for the Client ID and Secret, checks them, saves them, installs the Claude skill")
    .option("--client-id <id>", "Client ID of the Jortt app (otherwise asked, or the saved one)")
    .option("--client-secret-stdin", "Read the Client Secret from stdin (e.g. from a password manager)")
    .option("--scopes <list>", "Scopes to ask for (default: every scope jortt uses; trimmed to what the app has)")
    .option("--organization-id <id>", "Only when the credentials reach more than one administration")
    .option("--skill", "Install the Claude skill without asking")
    .option("--no-skill", "Don't install the Claude skill")
    .option("--skill-dir <dir>", "Install the skill here instead of ~/.claude/skills/jortt")
    .option("--no-check", "Save without contacting Jortt")
    .option("--no-interactive", "Never ask; use flags, environment and the saved file")
    .addHelpText(
      "after",
      [
        "",
        "Run it in a terminal and answer the questions. Unattended:",
        "  op read op://Finance/Jortt/secret | jortt setup --client-id <id> --client-secret-stdin --json",
        "  Get-Clipboard | jortt setup --client-id <id> --client-secret-stdin     (Windows PowerShell)",
        "",
        "Credentials are saved to ~/.config/jortt/credentials (%APPDATA%\\jortt\\credentials on Windows), readable",
        "only by you. Run it again any time to change them.",
      ].join("\n"),
    )
    .action(
      action(async (rt: Runtime, cmd: Command) => {
        const f = cmd.opts() as SetupFlags;
        let clientSecret: string | undefined;
        if (f.clientSecretStdin) {
          clientSecret = (await Bun.stdin.text()).trim();
          if (!clientSecret) throw new JorttError("--client-secret-stdin was given, but stdin was empty.");
        }
        const interactive = f.interactive !== false && !rt.out.json && !f.clientSecretStdin && !!process.stdin.isTTY;
        const io = prompters.make(interactive);
        const result = await runSetup(
          {
            clientId: f.clientId,
            clientSecret,
            scopes: f.scopes,
            organizationId: f.organizationId,
            skill: f.skill,
            skillDir: f.skillDir,
            check: f.check,
          },
          io,
          { reference: () => buildReference(root(cmd)) },
        );
        if (interactive) for (const line of setupSummary(result)) io.say(line);
        else rt.success(result, { binNotOnPath: binDirMissingFromPath() });
        return Exit.OK;
      }),
    );

  const skill = program.command("skill").description("The Claude skill that teaches Claude Code to use jortt");
  skill
    .command("install")
    .description("Install or update the skill (SKILL.md and a reference generated from this jortt)")
    .option("--dir <dir>", "Install here instead of ~/.claude/skills/jortt")
    .option("--force", "Replace a development symlink with a copy")
    .action(
      action(async (rt: Runtime, cmd: Command) => {
        const o = cmd.opts() as { dir?: string; force?: boolean };
        rt.success(installSkill(buildReference(root(cmd)), o));
        return Exit.OK;
      }),
    );
}
