// Ledger records read the snapshot that scripts/watchdog/ledger/export-onpoint.ts writes to public/watchdog/ledger-data
// (see DATA in ./lib). Until that snapshot is on the site every Ledger page would only say it is not loaded yet, so
// the whole area sends people to Money flow instead, and comes back on its own once the export is deployed.
import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { LedgerNav } from "./lib";
import "./ledger.css";

const DIR = path.join(process.cwd(), "public/watchdog/ledger-data");

function hasSnapshot() {
  try { return fs.existsSync(DIR) && fs.readdirSync(DIR).some((f) => !f.startsWith(".")); } catch { return false; }
}

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  if (!hasSnapshot()) redirect("/watchdog/money");
  return <div className="lg"><LedgerNav />{children}</div>;
}
