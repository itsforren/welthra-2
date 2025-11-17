CREATE TABLE IF NOT EXISTS "Subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"stripeCustomerId" varchar(255) NOT NULL,
	"stripeSubscriptionId" varchar(255) NOT NULL,
	"stripePriceId" varchar(255),
	"planName" text,
	"status" varchar(32) NOT NULL,
	"currentPeriodEnd" timestamp NOT NULL,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"canceledAt" timestamp,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
