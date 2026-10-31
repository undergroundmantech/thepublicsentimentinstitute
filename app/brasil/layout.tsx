// Every Brasil 2026 page: English by default, with a hand written Brazilian Portuguese version one click away. The
// runoff was held on October 25, 2026, and every page carries the same archive notice under the section bar.
import type { Metadata } from "next";
import Link from "@/app/components/Link";
import BrBar from "./BrBar";
import { LangProvider, T } from "./i18n";
import "./brasil.css";

export const metadata: Metadata = {
  openGraph: { locale: "en_US", alternateLocale: ["pt_BR"] },
};

export default function BrasilLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="br">
      <LangProvider>
        <BrBar />
        <p className="br-arch" role="note">
          <T en={<><b>Archive</b>Brazil&rsquo;s runoff was held on October 25, 2026. The forecast is shown as published on October 24, before the vote, and the results are the provider&rsquo;s last count. Neither is updated. Official results are those certified by the TSE. <Link href="/brasil/arquivo">About this archive</Link></>}
            pt={<><b>Arquivo</b>O 2º turno foi realizado em 25 de outubro de 2026. A previsão aparece como foi publicada em 24 de outubro, antes da votação, e o resultado é a última apuração do provedor. Nenhum dos dois é mais atualizado. Os resultados oficiais são os certificados pelo TSE. <Link href="/brasil/arquivo">Sobre o arquivo</Link></>} />
        </p>
        {children}
      </LangProvider>
    </div>
  );
}
