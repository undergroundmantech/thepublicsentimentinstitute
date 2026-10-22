import { permanentRedirect } from "next/navigation";
// What If moved to its own page at /what-if on Oct 22, 2026; next.redirects.ts also sends this address there.
export default function Page() { permanentRedirect("/what-if"); }
