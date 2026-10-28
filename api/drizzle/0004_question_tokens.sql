ALTER TABLE "questions" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "cache_read_tokens" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "cache_write_tokens" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "output_tokens" integer;