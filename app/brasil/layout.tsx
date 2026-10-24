// Every Brasil 2026 page: written in Brazilian Portuguese by hand, so the site's page translator is kept off them.
import type { Metadata } from "next";
import BrBar from "./BrBar";
import "./brasil.css";

export const metadata: Metadata = {
  openGraph: { locale: "pt_BR" },
  other: { "content-language": "pt-BR" },
};

export default function BrasilLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="br notranslate" lang="pt-BR" translate="no">
      <BrBar />
      {children}
    </div>
  );
}
