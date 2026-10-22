import { permanentRedirect } from "next/navigation";
// The swingometer moved to its own page at /swingometer on Oct 22, 2026; next.redirects.ts also sends this address there.
export default function Page() { permanentRedirect("/swingometer"); }
