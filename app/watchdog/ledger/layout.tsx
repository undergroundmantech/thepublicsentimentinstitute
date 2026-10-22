import { LedgerNav } from "./lib";
import "./ledger.css";

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  return <div className="lg"><LedgerNav />{children}</div>;
}
