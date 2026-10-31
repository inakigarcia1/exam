ALTER TABLE "candidate_profiles" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "former_name" text;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN IF NOT EXISTS "former_username" text;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_deleted_identity_check" CHECK ("user_id" IS NOT NULL OR ("former_name" IS NOT NULL AND "former_username" IS NOT NULL));
