"use server";

import { auth } from "@/app/(auth)/auth";
import {
  getLatestSubscriptionByUserId,
  isSubscriptionActiveForUser,
} from "@/lib/db/queries";

export async function getCurrentUserSubscription() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return getLatestSubscriptionByUserId({ userId: session.user.id });
}

export async function isCurrentUserSubscriptionActive() {
  const session = await auth();

  if (!session?.user?.id) {
    return false;
  }

  return isSubscriptionActiveForUser({ userId: session.user.id });
}
