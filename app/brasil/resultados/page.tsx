// /brasil/resultados: the live results desk for Brazil's 2026 runoff, built like the US situation monitor, with every
// state one click away. Returns come from civicAPI with the On Point projection.
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd, getBr } from "../data";
import BrMonitor from "../monitor/BrMonitor";

const DESC = "Live results of Brazil's 2026 presidential runoff between Flávio Bolsonaro and Lula: every municipality on one map as the TSE counts, a desk for every state, and the On Point projection of the final result, updated every 30 seconds. Apuração ao vivo.";
export const metadata = brSeo({ title: "Brazil Runoff Live Results 2026: Lula vs Flávio Bolsonaro", pt: "Apuração ao vivo do 2º turno", description: DESC, path: "/brasil/resultados",
  keywords: ["Brazil election results live", "Brazil runoff results", "who won Brazil election", "apuração ao vivo", "resultado do segundo turno", "quem ganhou a eleição", "apuração TSE", "resultado eleição presidente 2026"] });

export default function Page() {
  const n = getBr().national;
  return (
    <>
      <JsonLd data={brPageLd({ name: "Brazil runoff live results 2026", description: DESC, path: "/brasil/resultados", crumbs: [["Home", "/"], ["Brazil 2026", "/brasil"], ["Live results", "/brasil/resultados"]],
        faq: [["When will Brazil's runoff results be known?", "Polls close at 5 PM Brasília time, 4 PM Eastern, everywhere in the country, and the TSE starts releasing the count right after. In recent elections most of the vote was tallied within two hours."],
          ["How does the On Point projection work?", "With each update, every counted municipality is compared with the forecast for it, and that gap is used to estimate the votes still to be counted in each state. A winner is projected only once the gap is too large to be overturned."]] })} />
      <BrMonitor states={brStates()} nat={{ flavio: n.flavio, p_flavio: n.p_flavio, valid: n.valid, p10: n.p10, p90: n.p90 }} />
    </>
  );
}
