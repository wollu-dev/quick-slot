-- Subscriptions (Pro). One row per subscription at the payment provider; keep in sync with ../schema.ts.
CREATE TABLE "subscription" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "status" text NOT NULL,
  "price_id" text,
  "customer_id" text,
  "current_period_end" timestamptz,
  "cancel_at" timestamptz,
  "event_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "subscription_user_id_idx" ON "subscription" ("user_id");

-- Webhook events already handled, so a retried delivery is applied only once
CREATE TABLE "billing_event" (
  "id" text PRIMARY KEY,
  "received_at" timestamptz NOT NULL DEFAULT now()
);
