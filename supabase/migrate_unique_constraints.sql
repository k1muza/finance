-- ============================================================
-- MIGRATION: Add missing uniqueness constraints
-- Run this in the Supabase SQL Editor on the live database.
-- ============================================================

ALTER TABLE districts ADD CONSTRAINT districts_name_key    UNIQUE (name);
ALTER TABLE regions   ADD CONSTRAINT regions_district_name UNIQUE (district_id, name);
ALTER TABLE people    ADD CONSTRAINT people_phone_key       UNIQUE (phone);
ALTER TABLE sessions  ADD CONSTRAINT sessions_day_name      UNIQUE (day_id, name);
