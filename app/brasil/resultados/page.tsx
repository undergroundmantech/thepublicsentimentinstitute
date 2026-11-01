// /brasil/resultados: the results desk for Brazil's 2026 runoff, now an archive: the provider's last count (civicAPI),
// saved with its dates, with the On Point projection and every state one click away.
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd, getBr } from "../data";
import BrMonitor from "../monitor/BrMonitor";

const DESC = "Archived results of Brazil's October 25, 2026 presidential runoff between Flávio Bolsonaro and Lula: every municipality on one map from the provider's last count, a desk for every state, and the On Point projection. Not the TSE's certified result. Resultado arquivado do 2º turno.";
export const metadata = brSeo({ title: "Brazil 2026 Runoff Results (Archive): Lula vs Flávio Bolsonaro", pt: "Resultado do 2º turno (arquivo)", description: DESC, path: "/brasil/resultados",
  keywords: ["Brazil election results 2026", "Brazil runoff results", "who won Brazil election", "resultado do segundo turno", "quem ganhou a eleição", "apuração TSE", "resultado eleição presidente 2026"] });

export default function Page() {
  const n = getBr().national;
  return (
    <>
      <JsonLd data={brPageLd({ name: "Brazil 2026 runoff results (archive)", description: DESC, path: "/brasil/resultados", crumbs: [["Home", "/"], ["Brazil 2026", "/brasil"], ["Results", "/brasil/resultados"]],
        faq: [["Who won Brazil's 2026 runoff?", "In the provider's last count of the October 25, 2026 runoff, saved by On Point Politics with 99.9% of sections counted, Lula had 51.8% of the valid vote and Flávio Bolsonaro 48.2%. The official result is the one certified by the TSE."],
          ["How does the On Point projection work?", "With each update, every counted municipality was compared with the forecast for it, and that gap was used to estimate the votes still to be counted in each state. A winner was projected only once the gap was too large to be overturned."]] })} />
      <BrMonitor states={brStates()} nat={{ flavio: n.flavio, p_flavio: n.p_flavio, valid: n.valid, p10: n.p10, p90: n.p90 }} />
    </>
  );
}
