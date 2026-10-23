import { notFound } from "next/navigation";
import { SITE_V2 } from "@/app/lib/flags";
import RegConsole from "../_reg/RegConsole";

// Party registration: the shared registration console opened on the largest bloc in each state.
export default function PartyRegistrationPage() {
  if (!SITE_V2) notFound();
  return <div className="opp fc-page fc-xl fx-dark"><RegConsole page="party" initial="bloc" /></div>;
}
