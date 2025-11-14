"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Switch } from "@/components/ui/switch";

export default function SubscribePage() {
  const [isYearly, setIsYearly] = useState(false);

  const monthlyPrice = 19;
  const yearlyPrice = 190;

  const price = isYearly ? yearlyPrice : monthlyPrice;
  const label = isYearly ? "Yearly" : "Monthly";

  const handleSubscribe = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        type: "subscription",
        priceId:
          label === "Yearly"
            ? process.env.STRIPE_PRICE_ID_YEARLY
            : process.env.STRIPE_PRICE_ID_MONTHLY,
        planName: "Welthra Pro",
        description: `Welthra Pro Subscription with ${label}`,
        metadata: {
          type: "subscription",
          priceId: process.env.STRIPE_PRICE_ID,
          amount: price,
          label,
          description: "Welthra Pro Subscription",
          planName: "Welthra Pro",
        },
      }),
    });

    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-sm border-neutral-800 bg-neutral-900 text-white">
        <CardHeader className="flex flex-col items-center gap-4">
          <CardTitle className="font-semibold text-2xl">
            Welthra AI Subscription
          </CardTitle>

          <div className="flex items-center gap-3">
            <span className={isYearly ? "text-neutral-400" : "font-bold"}>
              Monthly
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={isYearly ? "font-bold" : "text-neutral-400"}>
              Yearly
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="font-bold text-5xl">${price}</p>
            <p className="mt-1 text-neutral-400 text-sm">
              {isYearly ? "per year" : "per month"}
            </p>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleSubscribe}
          >
            Subscribe Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
