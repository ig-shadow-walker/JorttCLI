/**
 * Builds the files for a GitHub release into dist/release: one binary per platform, install.sh,
 * install.ps1 and SHA256SUMS. Nothing is uploaded; publish them yourself, e.g.
 *   gh release create v0.1.0 dist/release/* --title v0.1.0
 *
 *   bun run build:release            # all platforms
 *   bun run build:release darwin     # only names containing "darwin"
 */
import { $ } from "bun";
import { mkdirSync, rmSync } from "node:fs";
import pkg from "../package.json" with { type: "json" };

/** Asset name (what install.sh asks for) -> Bun compile target. x64 uses baseline builds so older CPUs work too. */
const TARGETS: Record<string, string> = {
  "jortt-darwin-arm64": "bun-darwin-arm64",
  "jortt-darwin-x64": "bun-darwin-x64-baseline",
  "jortt-linux-arm64": "bun-linux-arm64",
  "jortt-linux-x64": "bun-linux-x64-baseline",
  "jortt-linux-arm64-musl": "bun-linux-arm64-musl",
  "jortt-linux-x64-musl": "bun-linux-x64-musl-baseline",
  "jortt-windows-x64.exe": "bun-windows-x64-baseline",
  "jortt-windows-arm64.exe": "bun-windows-arm64",
};

const INSTALLERS = ["install.sh", "install.ps1"];

const filter = process.argv[2];
const out = new URL("../dist/release/", import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const names = Object.keys(TARGETS).filter((n) => !filter || n.includes(filter));
for (const name of names) {
  console.log(`building ${name} (${TARGETS[name]})`);
  await $`bun build src/cli.ts --compile --minify --no-compile-autoload-dotenv --target=${TARGETS[name]!} --outfile ${out + name}`.quiet();
}
for (const f of INSTALLERS) await $`cp ${f} ${out + f}`;

const sums: string[] = [];
for (const name of [...names, ...INSTALLERS]) {
  const hash = new Bun.CryptoHasher("sha256").update(await Bun.file(out + name).arrayBuffer()).digest("hex");
  sums.push(`${hash}  ${name}`);
}
await Bun.write(out + "SHA256SUMS", sums.join("\n") + "\n");
console.log(`\njortt ${pkg.version}: ${names.length} binaries, installers and SHA256SUMS in dist/release/`);
console.log(`Publish:  gh release create v${pkg.version} dist/release/* --title v${pkg.version}`);
