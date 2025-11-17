import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/app/(auth)/auth";
import { getLatestSubscriptionByUserId } from "@/lib/db/queries";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-10-29.clover",
});

export async function POST(_req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized: missing authenticated user" },
      { status: 401 }
    );
  }

  const subscription = await getLatestSubscriptionByUserId({
    userId: session.user.id,
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 400 }
    );
  }

  try {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Stripe will emit a customer.subscription.updated event and the webhook
    // will update the local subscription record. We don't touch the database here.

    return NextResponse.json(
      { success: true, willCancelAtPeriodEnd: true },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
