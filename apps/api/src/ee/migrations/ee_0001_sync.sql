-- Sync between devices (Pro). One row per user and synced item; keep in sync with ../sync.ts.
CREATE TABLE "sync_item" (
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "key")
);
