import { parseArgs } from "node:util";

export interface CliOptions {
  url: string;
  output: string;
  maxSteps: number;
  viewport: { width: number; height: number };
  headed: boolean;
  help: boolean;
}

export function parseCliOptions(args: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      output: { type: "string", short: "o", default: "focuspath-report.html" },
      "max-steps": { type: "string", default: "50" },
      viewport: { type: "string", default: "1440x900" },
      headed: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) return { url: "", output: values.output, maxSteps: 50, viewport: { width: 1440, height: 900 }, headed: values.headed, help: true };
  if (positionals.length === 0) throw new Error("Missing URL. Run focuspath --help for usage.");
  if (positionals.length > 1) throw new Error(`Unexpected argument: ${positionals[1]}`);

  const maxSteps = Number(values["max-steps"]);
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 500) throw new Error("--max-steps must be an integer between 1 and 500.");

  return {
    url: normalizeUrl(positionals[0] ?? ""),
    output: values.output,
    maxSteps,
    viewport: parseViewport(values.viewport),
    headed: values.headed,
    help: false,
  };
}

function normalizeUrl(value: string): string {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) throw new Error("Only http and https URLs are supported.");
  const candidate = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http and https URLs are supported.");
  return parsed.toString();
}

function parseViewport(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error("--viewport must use the format 1440x900.");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 320 || height < 320 || width > 4000 || height > 4000) throw new Error("Viewport dimensions must be between 320 and 4000.");
  return { width, height };
}
