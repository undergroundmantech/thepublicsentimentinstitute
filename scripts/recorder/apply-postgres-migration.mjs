// Applies ONLY the additive recorder-object migration to oop.
// Handles the temporary unescaped-percent Codespaces credential without printing it.
// Does not alter any other database or project.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const raw = process.env.ONPOINT_DATABASE_URL ?? "";
const scheme = raw.match(/^postgres(?:ql)?:\/\//)?.[0];
const at = raw.lastIndexOf("@");
const colon = raw.indexOf(":", scheme?.length ?? 0);
if (!scheme || colon < scheme.length || at <= colon) {
  console.error("FAIL: ONPOINT_DATABASE_URL structure not recognized");
  process.exit(1);
}
let password = raw.slice(colon + 1, at);
try { password = decodeURIComponent(password); } catch { /* raw password contains unescaped percent */ }
const safeUri = raw.slice(0, colon) + "@" + raw.slice(at + 1);
let target;
try { target = new URL(safeUri); } catch { console.error("FAIL: Target URL invalid"); process.exit(1); }
if (decodeURIComponent(target.pathname) !== "/oop") {
  console.error("FAIL: Refusing migration outside database oop");
  process.exit(1);
}
const migration = resolve("db/migrations/20261031_recorder_objects.sql");
const result = spawnSync("psql",
  ["-X", "-w", "-v", "ON_ERROR_STOP=1", "-d", safeUri, "-f", migration],
  { env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: "10" },
    encoding: "utf8", timeout: 45_000 });
if (result.status !== 0) {
  const e = result.stderr || "";
  const category = /permission denied/i.test(e) ? "permission denied" :
    /password authentication failed/i.test(e) ? "authentication" :
    /timed out|timeout/i.test(e) ? "timeout" :
    /does not exist/i.test(e) ? "database/table absent" :
    /syntax error/i.test(e) ? "SQL syntax" : "check server/logs";
  console.error(`FAIL: migration (${category}, exit ${result.status}, error ${result.error?.code ?? "none"})`);
  process.exit(1);
}
console.log("SUCCESS: Migration applied to oop.");
console.log(result.stdout);
