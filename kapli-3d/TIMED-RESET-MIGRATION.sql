-- Kapli 3D 2.7: «На время» lasts 5 minutes instead of 3, so the old records are not comparable — they start again.
-- Run once in SQL Editor when 2.7 goes out (running it again removes the new records too, so only once).
delete from public.kapli_records where mode = 'timed';
