import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-10-29.clover",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      type = "one_time", // one_time | subscription
      priceId, // for subscription
      planName,
      amount,
      description,
    } = body;

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    if (!origin) {
      return NextResponse.json(
        { error: "Missing site origin" },
        { status: 400 }
      );
    }

    // Validación para suscripción
    if (type === "subscription" && !priceId) {
      return NextResponse.json(
        { error: "Missing Stripe priceId for subscription" },
        { status: 400 }
      );
    }

    // Validación para pagos únicos
    if (type === "one_time" && (!amount || typeof amount !== "number")) {
      return NextResponse.json(
        { error: "Invalid or missing amount for one-time payment" },
        { status: 400 }
      );
    }

    let session: Stripe.Checkout.Session;

    if (type === "subscription") {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/canceled`,
        metadata: {
          type: "subscription",
          planName,
        },
      });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: planName || "Custom Payment",
                description: description || "One-time custom payment",
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/canceled`,
        metadata: {
          type: "one_time",
          planName,
        },
      });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
