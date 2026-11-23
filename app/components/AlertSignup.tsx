"use client";
// A page's own alerts signup: the site list, by email or text, with the page's own heading. It sends the reader the
// same alerts as the footer signup, and offers the Substack newsletter alongside.
import StayConnected from "./StayConnected";

export default function AlertSignup({ title, note, from }: { title: string; note: string; from: string }) {
  return <StayConnected variant="foot" from={from} title={title} note={note} pick={["polls", "forecast", "videos"]} />;
}
