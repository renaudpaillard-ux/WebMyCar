ALTER TABLE fuel_entries ADD COLUMN price_per_liter_millis INTEGER;

UPDATE fuel_entries
SET price_per_liter_millis = price_per_liter_cents * 10
WHERE price_per_liter_cents IS NOT NULL
  AND price_per_liter_millis IS NULL;
