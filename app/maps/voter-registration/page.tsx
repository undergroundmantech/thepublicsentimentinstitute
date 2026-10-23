import { notFound } from "next/navigation";
import { SITE_V2 } from "@/app/lib/flags";
import RegConsole from "../_reg/RegConsole";

// Voter registration: the shared registration console opened on the size of each state's rolls.
export default function VoterRegistrationPage() {
  if (!SITE_V2) notFound();
  return <div className="opp fc-page fc-xl fx-dark"><RegConsole page="voter" initial="size" /></div>;
}
