import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const server = createServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  const tall = request.url === "/tall";
  response.end(tall
    ? "<!doctype html><style>html,body{margin:0}.tall{height:30000px;background:linear-gradient(#102030,#dcefff)}</style><title>Tall dev smoke test</title><button style=position:fixed>Ready</button><div class=tall></div>"
    : "<!doctype html><title>Dev smoke test</title><button>Ready</button>");
});
const directory = await mkdtemp(join(tmpdir(), "focuspath-dev-"));
const reportPath = join(directory, "report.html");
const tallReportPath = join(directory, "tall-report.html");

try {
  const versionResult = await run("npm", ["run", "dev", "--", "--version"]);
  const packageMetadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(versionResult.code, 0, `Development CLI version failed:\n${versionResult.stderr}`);
  assert.equal(versionResult.stdout.trim().split("\n").at(-1), packageMetadata.version);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string", "Development smoke server did not bind to a TCP port");

  const result = await run("npm", [
    "run",
    "dev",
    "--",
    `http://127.0.0.1:${address.port}`,
    "--output",
    reportPath,
  ]);
  assert.equal(result.code, 0, `Development CLI failed:\n${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /1 forward focus stops/);
  assert.match(await readFile(reportPath, "utf8"), /FocusPath \/ Report/);

  const tallResult = await run("npm", [
    "run",
    "dev",
    "--",
    `http://127.0.0.1:${address.port}/tall`,
    "--output",
    tallReportPath,
    "--max-screenshot-height",
    "30000",
    "--max-steps",
    "1",
  ]);
  assert.equal(tallResult.code, 0, `Tall development CLI failed:\n${tallResult.stderr}\n${tallResult.stdout}`);
  assert.match(tallResult.stdout, /Screenshot truncated to 1440×27777px from 1440×30000px/);
  assert.match(await readFile(tallReportPath, "utf8"), /FocusPath \/ Report/);
  console.log("Development CLI smoke test passed");
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL("../", import.meta.url),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}
