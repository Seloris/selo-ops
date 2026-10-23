CREATE TABLE "session_notes" (
	"session_id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
