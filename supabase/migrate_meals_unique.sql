-- Add unique constraint on meals(day_id, name) to support upsert on conflict
ALTER TABLE meals ADD CONSTRAINT meals_day_id_name_key UNIQUE (day_id, name);
