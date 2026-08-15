import { generateBoxArt, type BoxArtProvider, type BoxArtQuality } from "../lib/box-art/pipeline";

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
  console.log("Usage: npm run art:generate -- --slug <game-slug> --brief <original-art-brief> [--format <format-id>] [--quality low|medium|high] [--provider codex|api] [--allow-api-billing] [--timeout-seconds 1-300] [--dry-run]\n\nCreates a checksum-bound draft under artifacts/box-art only after Codex Image returns one valid PNG. --dry-run uses an OS temporary directory and sends no generation request.");
}

try {
  const flags = parseFlags(process.argv.slice(2), ["dry-run", "allow-api-billing", "help"]);
  const allowed = new Set(["slug", "brief", "format", "quality", "provider", "allow-api-billing", "timeout-seconds", "dry-run", "help"]);
  for (const name of Object.keys(flags)) if (!allowed.has(name)) throw new Error(`unsupported --${name}`);
  if (flags.help) {
    usage();
  } else {
    const slug = stringFlag(flags, "slug");
    const brief = stringFlag(flags, "brief");
    if (!slug || !brief) throw new Error("--slug and --brief are required");
    const timeoutText = stringFlag(flags, "timeout-seconds");
    const timeoutSeconds = timeoutText === undefined ? undefined : Number(timeoutText);
    const result = generateBoxArt({
      root: process.cwd(),
      slug,
      brief,
      formatId: stringFlag(flags, "format"),
      quality: stringFlag(flags, "quality") as BoxArtQuality | undefined,
      provider: stringFlag(flags, "provider") as BoxArtProvider | undefined,
      allowApiBilling: flags["allow-api-billing"] === true,
      dryRun: flags["dry-run"] === true,
      timeoutSeconds,
    });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(`Box-art generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
