"use server";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  getLatestSubscriptionByUserId,
  upsertSubscriptionFromStripe,
} from "@/lib/db/queries";
import { subscription, user } from "@/lib/db/schema";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;
const STRIPE_MONTHLY_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY ?? "";

export type AdminCreateUserInput = {
  email: string;
  role: string;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  role: string;
  subscriptionStatus?: string | null;
};

export type AdminUpdateUserInput = {
  id: string;
  email: string;
  role: string;
};

export async function GetUserByEmail(email: string): Promise<AdminUserRecord> {
  const [userData] = await db

    .select({
      id: user.id,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(eq(user.email, email));

  const latestSubscription = await getLatestSubscriptionByUserId({
    userId: userData.id,
  });

  const subscriptionStatus = latestSubscription?.status ?? null;

  return {
    ...userData,
    subscriptionStatus,
  };
}

export async function adminCreateUser(
  input: AdminCreateUserInput
): Promise<AdminUserRecord> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const role = input.role.trim();

  const [created] = await db
    .insert(user)
    .values({
      email: normalizedEmail,
      // Password is optional for admin-created records; authentication
      // for these accounts can be wired separately if needed.
      password: null,
      role,
    })
    .returning({
      id: user.id,
      email: user.email,
      role: user.role,
    });

  return { ...created, subscriptionStatus: null };
}

export async function adminDeleteUser(id: string): Promise<void> {
  // Remove any subscriptions referencing this user to satisfy FK constraints
  await db.delete(subscription).where(eq(subscription.userId, id));
  await db.delete(user).where(eq(user.id, id));
}

export async function adminListUsers(): Promise<AdminUserRecord[]> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      role: user.role,
    })
    .from(user);

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const latest = await getLatestSubscriptionByUserId({ userId: row.id });
      return {
        ...row,
        subscriptionStatus: latest?.status ?? null,
      };
    })
  );

  return enriched;
}

export async function adminUpdateUser(
  input: AdminUpdateUserInput
): Promise<AdminUserRecord> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const role = input.role.trim();

  const [updated] = await db
    .update(user)
    .set({
      email: normalizedEmail,
      role,
    })
    .where(eq(user.id, input.id))
    .returning({
      id: user.id,
      email: user.email,
      role: user.role,
    });

  const latest = await getLatestSubscriptionByUserId({ userId: updated.id });

  return {
    ...updated,
    subscriptionStatus: latest?.status ?? null,
  };
}

export async function adminActivateUserSubscription(userId: string) {
  const now = new Date();
  const currentPeriodEnd = new Date(now.getTime() + MONTH_IN_MS);

  if (!STRIPE_MONTHLY_ID) {
    throw new Error("Missing NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY");
  }

  await upsertSubscriptionFromStripe({
    userId,
    stripeCustomerId: userId,
    stripeSubscriptionId: STRIPE_MONTHLY_ID,
    stripePriceId: STRIPE_MONTHLY_ID,
    planName: "Monthly",
    status: "active",
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    canceledAt: null,
  });
}

export async function adminDeactivateUserSubscription(userId: string) {
  const existing = await getLatestSubscriptionByUserId({ userId });

  if (!existing) {
    return;
  }

  const now = new Date();

  await upsertSubscriptionFromStripe({
    userId,
    stripeCustomerId: existing.stripeCustomerId,
    stripeSubscriptionId: existing.stripeSubscriptionId,
    stripePriceId: existing.stripePriceId,
    planName: existing.planName,
    status: "canceled",
    currentPeriodEnd: existing.currentPeriodEnd,
    cancelAtPeriodEnd: true,
    canceledAt: now,
  });
}
