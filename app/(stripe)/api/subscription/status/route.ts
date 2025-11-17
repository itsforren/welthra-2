import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getLatestSubscriptionByUserId,
  isSubscriptionActiveForUser,
} from "@/lib/db/queries";

export async function GET(_req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        active: false,
        subscription: null,
      },
      { status: 200 }
    );
  }

  const [active, subscription] = await Promise.all([
    isSubscriptionActiveForUser({ userId: session.user.id }),
    getLatestSubscriptionByUserId({ userId: session.user.id }),
  ]);

  return NextResponse.json(
    {
      active,
      subscription,
    },
    { status: 200 }
  );
}
