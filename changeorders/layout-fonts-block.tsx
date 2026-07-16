// ============================================================================
// REPLACEMENT BLOCK for app/layout.tsx  — FONTS SECTION ONLY
// ----------------------------------------------------------------------------
// Replace the existing import line AND the entire `/* FONTS */` block
// (from `import { Quantico, Geist_Mono, Fraunces, JetBrains_Mono } ...`
//  through the end of the `const numeric = JetBrains_Mono({ ... });` block)
// with everything between the two >>> markers below.
//
// Variant A type system:
//   --font-display : JetBrains Mono 700/800   (headers, hero, scoreboard labels)
//   --font-body    : Geist                    (UI, body, tables)
//   --font-numeric : JetBrains Mono 500/700/800 (vote totals, %, margins)
//   Space Grotesk  : NOT loaded on web (corporate-doc face only)
//   Fraunces/Quantico: RETIRED
// ============================================================================

// >>> BEGIN REPLACEMENT >>>
import { Geist, JetBrains_Mono } from "next/font/google";

/* -----------------------------
   FONTS — Variant A system
------------------------------ */

// Display / headers — JetBrains Mono, heavy weights only.
// Mono width-tax rule: use --font-display for SHORT strings (race labels,
// section headers, hero, kickers). For long-form titles (editorial blurb
// headings, multi-line prose titles) use --font-body at 600 instead.
const display = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
});

// UI / body / tables — Geist (variable).
const body = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Data numerals — JetBrains Mono. Shares the face with display by design
// (the brand "speaks in the typography of its own data").
const numeric = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-numeric",
  display: "swap",
});
// >>> END REPLACEMENT >>>


// ============================================================================
// ALSO UPDATE — the <html> className and <body> className further down:
//
//   <html
//     ...
//     className={`${display.variable} ${body.variable} ${numeric.variable}`}
//   >
//
//   <body
//     className={[
//       body.className,                       // was: mono.className
//       "min-h-screen antialiased overflow-x-hidden",
//     ].join(" ")}
//   >
//
// Notes:
//   • The old `serif` variable is removed entirely — delete `${serif.variable}`.
//   • `mono` is renamed to `body`; update both the const and its usages.
// ============================================================================
