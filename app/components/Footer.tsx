// app/components/Footer.tsx
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-14 border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2 md:items-start">
          <div>
            <div className="text-sm font-semibold text-white/85">
              The Public Sentiment Institute
            </div>
            <div className="mt-1 text-sm text-white/55">
              Polling • Research • Insights
            </div>
            <div className="mt-4 psi-mono text-xs text-white/45">
              © {year} Public Sentiment Institute. All rights reserved.
            </div>
          </div>

          <div className="md:text-right">
            <div className="text-sm font-semibold text-white/75">Standards</div>
            <div className="mt-2 text-sm text-white/55">
              Transparent research • Clear reporting • Respect for respondents
            </div>
            <div className="mt-4 psi-mono text-xs text-white/45">
              Disclosure-first methodology and standardized reporting formats.
            </div>
          </div>
        </div>

        <div className="mt-8 psi-divider" />

        <div className="mt-4 flex flex-col gap-2 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span className="psi-mono">Built for polling averages & election results.</span>
        </div>
      </div>
    </footer>
  );
}
