"use client";

import { useRouter } from "next/navigation";
import { AiOutlineCloseCircle } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CanceledPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900 text-white">
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <AiOutlineCloseCircle className="text-red-500" size={60} />
          <CardTitle className="font-semibold text-3xl">
            Payment Canceled
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-6 text-center">
          <p className="text-neutral-400">
            Your payment was not completed. You can try again or return to the
            main dashboard.
          </p>

          <div className="flex w-full flex-col gap-3">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push("/payment")}
            >
              Try Again
            </Button>

            <Button
              className="w-full bg-neutral-700 hover:bg-neutral-600"
              onClick={() => router.push("/")}
            >
              Go Back Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
