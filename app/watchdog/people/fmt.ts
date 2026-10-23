// Formatting the people files share with the browser, kept apart from data.ts, which reads files on the server.
export const usd = (n: number | null | undefined) => (n == null ? "n/a" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
export const PARTY_NAME: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent", O: "Other party" };
