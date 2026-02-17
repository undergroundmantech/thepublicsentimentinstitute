import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";

type Project = {
  id: string;
  title: string;
  currency: "usd";
  minCents: number;
  maxCents: number;
};

// Server-side “source of truth” (do NOT trust client DEMO_PROJECTS)
const PROJECTS: Record<string, Project> = {
  p1: {
    id: "p1",
    title: "National Sentiment Poll - 2026 Midterm Elections",
    currency: "usd",
    minCents: 500,      // $5 minimum
    maxCents: 250000,   // $2,500 maximum
  },
};

export async function POST(req: Request) {
  try {
    const { projectId, amountCents } = await req.json();

    const project = PROJECTS[projectId as keyof typeof PROJECTS];
    if (!project) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    const cents = Number(amountCents);
    if (!Number.isFinite(cents)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (cents < project.minCents || cents > project.maxCents) {
      return NextResponse.json(
        { error: `Amount must be between ${project.minCents} and ${project.maxCents} cents.` },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: project.currency,
            unit_amount: cents,
            product_data: {
              name: project.title,
            },
          },
        },
      ],
      success_url: `${baseUrl}/projects/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/projects`,
      metadata: {
        projectId: project.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
