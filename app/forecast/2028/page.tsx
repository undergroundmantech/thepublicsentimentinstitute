import { permanentRedirect } from "next/navigation";

// The 2028 model moved to its own home at /2028.
export default function Old2028() { permanentRedirect("/2028"); }
