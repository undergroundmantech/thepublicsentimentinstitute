import { permanentRedirect } from "next/navigation";
// Nov 13 2026: the 2026 senate polling board closed with the election. Each race keeps its final average on its forecast page.
export default function Page() { permanentRedirect("/forecast"); }
