ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dailySummaryTimeMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "dailySummaryLastSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dailySummaryPromptedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_dailySummaryEnabled_dailySummaryTimeMinutes_idx"
  ON "User"("dailySummaryEnabled", "dailySummaryTimeMinutes");
