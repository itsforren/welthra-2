"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Switch } from "@/components/ui/switch";

export default function SubscribePage() {
  const [welthraPro, setIsWelthraPro] = useState(false);

  const monthlyPrice = 97;
  const yearlyPrice = 970;

  const price = welthraPro ? yearlyPrice : monthlyPrice;
  const label = welthraPro ? "Yearly" : "Monthly";

  const handleSubscribe = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        type: "subscription",
        priceId:
          label === "Yearly"
            ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY
            : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY,
        planName: "Welthra Co-Pilot",
        description: `Welthra Co-Pilot Subscription with ${label}`,
        metadata: {
          type: "subscription",
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
          amount: price,
          label,
          description: "Welthra Co-Pilot Subscription",
          planName: "Welthra Co-Pilot",
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
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900 text-white">
        <CardHeader className="flex flex-col items-center gap-4">
          <CardTitle className="font-semibold text-2xl">
            Welthra Co-Pilot
          </CardTitle>

          <div className="flex items-center gap-3">
            <span className={welthraPro ? "text-neutral-400" : "font-bold"}>
              Monthly
            </span>
            <Switch checked={welthraPro} onCheckedChange={setIsWelthraPro} />
            <span className={welthraPro ? "font-bold" : "text-neutral-400"}>
              Yearly
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="font-bold text-5xl">${price}</p>
            <p className="mt-2 text-neutral-400 text-sm">
              Perfect for agents who want to write high-quality policies in
              minutes, not hours, while eliminating mistakes, improving
              compliance, and delivering a premium client experience.
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
