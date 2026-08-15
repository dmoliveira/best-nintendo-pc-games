import { BOX_ART_APPROVAL_ATTESTATION, publishBoxArt } from "../lib/box-art/pipeline";

type FlagValues = Record<string, string | boolean>;

function parseFlags(argv: string[], booleanFlags: readonly string[]): FlagValues {
  const result: FlagValues = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument ${token}`);
    const name = token.slice(2);
    if (name in result) throw new Error(`--${name} was provided more than once`);
    if (booleanFlags.includes(name)) {
      result[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    result[name] = value;
    index += 1;
  }
  return result;
}

function stringFlag(flags: FlagValues, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function usage() {
  console.log(`Usage: npm run art:publish -- --draft artifacts/box-art/<slug>/<draft>/draft.json --reviewed-by <reviewer> --approval-note "${BOX_ART_APPROVAL_ATTESTATION}"
       npm run art:publish -- --recover

Publication verifies the staged PNG checksum and dimensions, then journals image, manifest, and game-record changes. --recover restores the exact pre-publish state from an interrupted transaction.`);
}

async function main() {
  try {
    const flags = parseFlags(process.argv.slice(2), ["recover", "help"]);
    const allowed = new Set(["draft", "reviewed-by", "approval-note", "recover", "help"]);
    for (const name of Object.keys(flags)) if (!allowed.has(name)) throw new Error(`unsupported --${name}`);
    if (flags.help) {
      usage();
      return;
    }
    const result = await publishBoxArt({
      root: process.cwd(),
      draftPath: stringFlag(flags, "draft"),
      reviewedBy: stringFlag(flags, "reviewed-by"),
      approvalNote: stringFlag(flags, "approval-note"),
      recoverOnly: flags.recover === true,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Box-art publication failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

void main();
