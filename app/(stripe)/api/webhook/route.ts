import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertSubscriptionFromStripe } from "@/lib/db/queries";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-10-29.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_end: number;
};

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe webhook secret" },
      { status: 500 }
    );
  }

  const headerStore = await headers();
  const signature =
    headerStore.get("stripe-signature") ?? headerStore.get("Stripe-Signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature header" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid Stripe webhook signature",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscriptionObject = event.data
          .object as StripeSubscriptionWithPeriods;
        const userId = subscriptionObject.metadata.userId;

        if (!userId) {
          // If we cannot associate the subscription with a user, we acknowledge the event
          // to avoid retries but do not attempt to write to the database.
          return NextResponse.json(
            { received: true, ignored: true },
            { status: 200 }
          );
        }

        const stripeCustomerId =
          typeof subscriptionObject.customer === "string"
            ? subscriptionObject.customer
            : subscriptionObject.customer.id;

        const stripeSubscriptionId = subscriptionObject.id;

        const firstItem = subscriptionObject.items.data.at(0);
        const stripePriceId = firstItem?.price.id ?? null;

        const status = subscriptionObject.status;

        const currentPeriodEnd = new Date(
          subscriptionObject.current_period_end * 1000
        );

        const cancelAtPeriodEnd = Boolean(
          subscriptionObject.cancel_at_period_end
        );

        const canceledAt = subscriptionObject.canceled_at
          ? new Date(subscriptionObject.canceled_at * 1000)
          : null;

        const planName = subscriptionObject.metadata.planName ?? null;

        await upsertSubscriptionFromStripe({
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId,
          planName,
          status,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          canceledAt,
        });

        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== "subscription") {
          break;
        }

        // For safety, we ensure the subscription event handler will still be the
        // source of truth. Here we only handle the case where the subscription
        // object is expanded on the session.
        if (session.subscription && typeof session.subscription !== "string") {
          const subscriptionObject =
            session.subscription as StripeSubscriptionWithPeriods;
          const userId =
            subscriptionObject.metadata.userId ?? session.metadata?.userId;

          if (!userId) {
            break;
          }

          const stripeCustomerId =
            typeof subscriptionObject.customer === "string"
              ? subscriptionObject.customer
              : subscriptionObject.customer.id;

          const stripeSubscriptionId = subscriptionObject.id;

          const firstItem = subscriptionObject.items.data.at(0);
          const stripePriceId = firstItem?.price.id ?? null;

          const status = subscriptionObject.status;

          const currentPeriodEnd = new Date(
            subscriptionObject.current_period_end * 1000
          );

          const cancelAtPeriodEnd = Boolean(
            subscriptionObject.cancel_at_period_end
          );

          const canceledAt = subscriptionObject.canceled_at
            ? new Date(subscriptionObject.canceled_at * 1000)
            : null;

          const planName =
            subscriptionObject.metadata.planName ?? session.metadata?.planName;

          await upsertSubscriptionFromStripe({
            userId,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId,
            planName,
            status,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
          });
        }

        break;
      }

      default: {
        break;
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process Stripe webhook event" },
      { status: 500 }
    );
  }
}
