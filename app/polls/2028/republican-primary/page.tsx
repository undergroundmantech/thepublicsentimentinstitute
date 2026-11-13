import type { Metadata } from "next";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import PrimaryField from "../PrimaryField";
import { primaryBuilt } from "../build";
import "../p2028.css";

const b = primaryBuilt("republican-primary");
const lead = b.cands.filter((c) => c.now != null).slice(0, 3).map((c) => `${c.key} ${c.now!.toFixed(1)}%`).join(", ");
const DESC = `2028 Republican presidential primary polling average: ${lead}. Every candidate named in ${b.polls.length} national polls, averaged by On Point Politics and weighted by recency, sample size, voter screen and pollster grade.`;

export const metadata: Metadata = seo({ title: "2028 Republican primary polls: polling average and every candidate", description: DESC, path: "/polls/2028/republican-primary", modified: b.updated });

export default function Page() {
  return (
    <>
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Polls", "/polls"], ["2028", "/polls/2028"], ["Republican primary", "/polls/2028/republican-primary"]]),
        pageLd({ name: "2028 Republican presidential primary polling average", description: DESC, path: "/polls/2028/republican-primary", modified: b.updated, about: "dataset" }),
      )} />
      <PrimaryField b={b} other={{ href: "/polls/2028/democratic-primary", label: "Democratic primary" }} />
    </>
  );
}
