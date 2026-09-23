import { redirect } from "next/navigation";

// The race ratings page was replaced by the forecast desk, which carries the
// same ratings plus county and district detail. Existing links redirect rather
// than 404: the old ForecastRatingsV1/V2 files stay on disk but nothing routes
// to them any more.
export default function ForecastRatingsPage() {
  redirect("/forecast");
}
