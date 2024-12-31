CREATE TABLE IF NOT EXISTS "followers" (
	"user_id" text NOT NULL,
	"follower_id" text NOT NULL,
	CONSTRAINT "followers_pkey" PRIMARY KEY("user_id","follower_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"twynt_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "likes" (
	"twynt_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "likes_pkey" PRIMARY KEY("twynt_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "twynts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"content" text NOT NULL,
	"views" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"has_link" boolean DEFAULT false,
	"has_image" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"reposted" boolean DEFAULT false,
	"parent" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"source_user_id" text,
	"twynt_id" text,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"handle" varchar(32) NOT NULL,
	"bio" varchar(256) DEFAULT 'Nothing here yet...',
	"created_at" timestamp DEFAULT now(),
	"banned" boolean DEFAULT false,
	"iq" integer NOT NULL,
	"token" text DEFAULT 'a',
	"email" text NOT NULL,
	"verified" boolean DEFAULT false,
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followers" ADD CONSTRAINT "followers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followers" ADD CONSTRAINT "followers_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "history" ADD CONSTRAINT "history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "history" ADD CONSTRAINT "history_twynt_id_twynts_id_fk" FOREIGN KEY ("twynt_id") REFERENCES "public"."twynts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "likes" ADD CONSTRAINT "likes_twynt_id_twynts_id_fk" FOREIGN KEY ("twynt_id") REFERENCES "public"."twynts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twynts" ADD CONSTRAINT "twynts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "twynts" ADD CONSTRAINT "twynts_parent_twynts_id_fk" FOREIGN KEY ("parent") REFERENCES "public"."twynts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_twynt_id_twynts_id_fk" FOREIGN KEY ("twynt_id") REFERENCES "public"."twynts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_twynt" ON "history" USING btree ("user_id","twynt_id");