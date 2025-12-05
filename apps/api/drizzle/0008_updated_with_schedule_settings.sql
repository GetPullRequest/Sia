CREATE TYPE "public"."gpr_agent_status" AS ENUM('active', 'idle', 'offline');--> statement-breakpoint
CREATE TABLE "gpr_agents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"status" "gpr_agent_status" DEFAULT 'offline' NOT NULL,
	"ip" varchar(50),
	"host" varchar(255),
	"port" integer NOT NULL,
	"last_active" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpr_queue_schedules" (
	"agent_id" varchar(255) NOT NULL,
	"queue_type" "gpr_queue_type" NOT NULL,
	"schedule_id" varchar(255) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gpr_queue_schedules_agent_id_queue_type_pk" PRIMARY KEY("agent_id","queue_type")
);
--> statement-breakpoint
CREATE TABLE "gpr_queue_states" (
	"org_id" varchar(255) NOT NULL,
	"queue_type" "gpr_queue_type" NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gpr_queue_states_org_id_queue_type_pk" PRIMARY KEY("org_id","queue_type")
);
--> statement-breakpoint
CREATE INDEX "agents_org_id_idx" ON "gpr_agents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "gpr_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "queue_schedules_agent_id_idx" ON "gpr_queue_schedules" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "queue_schedules_schedule_id_idx" ON "gpr_queue_schedules" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "queue_states_org_queue_idx" ON "gpr_queue_states" USING btree ("org_id","queue_type");