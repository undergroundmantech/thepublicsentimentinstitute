// The Situation Monitor's opening screen: shown the moment the route is entered (loading.tsx) and kept over the
// monitor until its map, races and results are ready (Monitor.tsx), so the page is never seen half-built. Markup and
// CSS only: no data, no mascot, the same in every appearance mode. Motion stops under prefers-reduced-motion.
import "./monitorSplash.css";

export default function MonitorSplash({ out = false, fixed = false, note = "Loading the map, the count and On Point's calls" }: { out?: boolean; fixed?: boolean; note?: string }) {
  return (
    <div className={`mon-splash${out ? " out" : ""}${fixed ? " fixed" : ""}`} role="status" aria-live="polite" aria-label="Loading the Situation Monitor">
      <div className="ms-in">
        <svg className="ms-globe" viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
          <circle className="ms-ring" cx="60" cy="60" r="56" />
          <circle className="ms-sweep" cx="60" cy="60" r="56" pathLength="100" />
          <g className="ms-grid">
            <circle cx="60" cy="60" r="40" />
            <ellipse cx="60" cy="60" rx="40" ry="14" /><ellipse cx="60" cy="60" rx="40" ry="28" />
            <ellipse className="ms-mer m1" cx="60" cy="60" rx="14" ry="40" /><ellipse className="ms-mer m2" cx="60" cy="60" rx="28" ry="40" />
            <line x1="20" y1="60" x2="100" y2="60" /><line x1="60" y1="20" x2="60" y2="100" />
          </g>
          <circle className="ms-dot d1" cx="47" cy="50" r="2.6" /><circle className="ms-dot d2" cx="72" cy="44" r="2.6" /><circle className="ms-dot d3" cx="66" cy="70" r="2.6" />
        </svg>
        <span className="ms-eye">On Point Politics · Election night</span>
        <strong className="ms-title">Situation Monitor</strong>
        <span className="ms-bar" aria-hidden="true"><i /></span>
        <span className="ms-note">{note}</span>
      </div>
    </div>
  );
}
