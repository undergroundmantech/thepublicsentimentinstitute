// /brasil/monitor: the Sala de situação, a full screen control room for the Brazil runoff count.
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd, getBr } from "../data";
import BrMonitor from "./BrMonitor";

const DESC = "Sala de situação do On Point Politics para o 2º turno de 2026: todos os municípios do Brasil num mapa em tela cheia, coloridos ao vivo conforme a apuração do TSE, com a projeção do resultado final.";
export const metadata = brSeo({ title: "Sala de situação: apuração do 2º turno em tempo real", description: DESC, path: "/brasil/monitor",
  keywords: ["mapa da apuração ao vivo", "apuração em tempo real", "mapa eleitoral ao vivo"] });

export default function Page() {
  const n = getBr().national;
  return (
    <>
      <JsonLd data={brPageLd({ name: "Sala de situação do 2º turno", description: DESC, path: "/brasil/monitor", crumbs: [["Início", "/"], ["Brasil 2026", "/brasil"], ["Sala de situação", "/brasil/monitor"]] })} />
      <BrMonitor states={brStates()} nat={{ flavio: n.flavio, p_flavio: n.p_flavio, valid: n.valid, p10: n.p10, p90: n.p90 }} />
    </>
  );
}
