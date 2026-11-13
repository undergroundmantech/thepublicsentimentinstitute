import type { Metadata } from "next";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import { PRIMARIES_2028 } from "@/app/_polling/2028/matchups";
import Average from "../../Average";

// The 2028 Democratic primary on the polling averages page, every candidate any national poll has named.
const def = PRIMARIES_2028.find((p) => p.id === "democratic-primary")!;
const updated = def.polls.reduce((m, p) => (p.endDate > m ? p.endDate : m), "");
const DESC = `2028 Democratic presidential primary polling average from On Point Politics: every candidate named in ${def.polls.length} national polls, weighted by recency, sample size, voter screen and pollster grade.`;

export const metadata: Metadata = seo({ title: "2028 Democratic primary polls: polling average and every candidate", description: DESC, path: "/polls/2028/democratic-primary", modified: updated });

export default function Page() {
  return (
    <>
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Polls", "/polls"], ["2028", "/polls/2028"], ["Democratic primary", "/polls/2028/democratic-primary"]]),
        pageLd({ name: "2028 Democratic presidential primary polling average", description: DESC, path: "/polls/2028/democratic-primary", modified: updated, about: "dataset" }),
      )} />
      <Average id="2028-dem-primary" />
    </>
  );
}
