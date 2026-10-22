CREATE TABLE "session_archives" (
	"session_id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"archived_at" timestamp with time zone NOT NULL
);
