import LocalBoard from "./LocalBoard";

export const metadata = {
  title: "Local Race Board — The Public Sentiment Institute",
  description:
    "A compact, direct-passthrough scan of local and down-ballot race results — no forecasting, no per-race pages.",
};

export default function LocalPage() {
  return <LocalBoard />;
}
