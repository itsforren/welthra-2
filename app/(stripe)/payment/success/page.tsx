"use client";

import { useRouter } from "next/navigation";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuccessPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900 text-white">
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <AiOutlineCheckCircle className="text-green-500" size={60} />
          <CardTitle className="font-semibold text-3xl">
            Payment Successful
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-neutral-400">
            Your subscription has been activated. Welcome to Welthra AI, enjoy
            unlimited insights.
          </p>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/")}
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
