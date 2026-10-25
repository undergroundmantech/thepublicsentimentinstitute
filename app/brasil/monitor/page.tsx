// /brasil/monitor: the control room is now the live results page itself.
import { permanentRedirect } from "next/navigation";
export default function Page() { permanentRedirect("/brasil/resultados"); }
