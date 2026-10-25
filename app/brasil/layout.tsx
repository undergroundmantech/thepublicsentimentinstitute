// Every Brasil 2026 page: English by default, with a hand written Brazilian Portuguese version one click away.
import type { Metadata } from "next";
import BrBar from "./BrBar";
import { LangProvider } from "./i18n";
import "./brasil.css";

export const metadata: Metadata = {
  openGraph: { locale: "en_US", alternateLocale: ["pt_BR"] },
};

export default function BrasilLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="br">
      <LangProvider>
        <BrBar />
        {children}
      </LangProvider>
    </div>
  );
}
