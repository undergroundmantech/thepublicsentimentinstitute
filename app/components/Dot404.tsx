// "404" set in the site's dot-matrix — numerals lit out of a dim dot field,
// the same halftone grammar as the hero. Server-rendered SVG, no client JS.
const FOUR = [
  "0000100",
  "0001100",
  "0010100",
  "0100100",
  "1000100",
  "1111111",
  "0000100",
  "0000100",
  "0000100",
];
const ZERO = [
  "0011100",
  "0100010",
  "1000001",
  "1000001",
  "1000001",
  "1000001",
  "1000001",
  "0100010",
  "0011100",
];
const DIGITS = [FOUR, ZERO, FOUR];

const COLS = 31; // 3 pad + 7 + 2 + 7 + 2 + 7 + 3 pad
const ROWS = 13; // 2 pad + 9 + 2 pad
const CELL = 20;

export default function Dot404({ fg, dim }: { fg: string; dim: string }) {
  const lit = new Set<string>();
  DIGITS.forEach((map, d) => {
    const ox = 3 + d * 9;
    map.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === "1") lit.add(`${ox + c},${2 + r}`);
      }
    });
  });

  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const on = lit.has(`${c},${r}`);
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + CELL / 2;
      if (on) {
        dots.push(
          <circle
            key={`${c}-${r}`}
            className="d404-lit"
            cx={cx}
            cy={cy}
            r={7}
            fill={fg}
            style={{ animationDelay: `${((c * 37 + r * 17) % 8) * 22}ms` }}
          />,
        );
      } else {
        // feather the field toward its boundary so the halftone dissolves
        // into the page instead of ending in a hard rectangle
        const dx = (c - (COLS - 1) / 2) / ((COLS - 1) / 2);
        const dy = (r - (ROWS - 1) / 2) / ((ROWS - 1) / 2);
        const fade = Math.max(0, Math.min(1, 1.45 - 1.15 * Math.hypot(dx, dy)));
        if (fade <= 0.02) continue;
        dots.push(
          <circle
            key={`${c}-${r}`}
            cx={cx}
            cy={cy}
            r={2.6}
            fill={dim}
            opacity={Math.round(fade * 100) / 100}
          />,
        );
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
      role="img"
      aria-label="404"
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <style>{`
        .d404-lit { animation: d404In 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes d404In { from { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .d404-lit { animation: none; } }
      `}</style>
      {dots}
    </svg>
  );
}
