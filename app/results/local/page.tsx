import LocalBoard from "./LocalBoard";

export const metadata = {
  title: "Local race board",
  description:
    "A compact scan of reported results for local and down-ballot races from the OnPoint Politics results desk.",
};

export default function LocalPage() {
  return <LocalBoard />;
}
