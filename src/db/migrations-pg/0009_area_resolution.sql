-- Area resolution: raw floor/usable areas + accessory estimate + review flag
ALTER TABLE "properties" ADD COLUMN "floor_area" real;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "usable_area" real;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "accessory_area" real;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "area_flag" text;
