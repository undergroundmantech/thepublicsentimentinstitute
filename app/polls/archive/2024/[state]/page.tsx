import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AGGREGATES } from "@/app/_polling/lib/aggregates";
import { STATE_NAME } from "@/app/lib/opp";
import Average from "../../../Average";

export function generateStaticParams() {
  return AGGREGATES.map((d) => d.id.match(/^2024-([a-z]{2})$/)?.[1]).filter(Boolean).map((state) => ({ state: state as string }));
}
export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params;
  return { title: `${STATE_NAME[state.toUpperCase()] ?? state.toUpperCase()} 2024 presidential polling average`, alternates: { canonical: `/polls/archive/2024/${state}` } };
}
export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const id = `2024-${state.toLowerCase()}`;
  if (!AGGREGATES.some((d) => d.id === id)) notFound();
  return <Average id={id} />;
}
