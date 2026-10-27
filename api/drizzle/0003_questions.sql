CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"path" text,
	"preset" text,
	"text" text,
	"state" text NOT NULL,
	"answer" text,
	"error" text,
	"error_detail" text,
	"model" text,
	"duration_ms" integer,
	"run_session_id" text NOT NULL,
	"asked_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone
);
