-- Kapli 3D 2.7.5: «Хардкор» got its bar moved to 250 000 (the drop splits at 100 000, the win is both halves at 125 000) and was
-- made harder, so the old records cannot be compared with the new ones — the hardcore rating starts again.
-- Run ONCE in SQL Editor when 2.7.5 goes out (running it again removes the new records too).
-- The players' hardcore rewards are taken back by the game itself (one time, on the first start of 2.7.5).
begin;
delete from public.kapli_records where mode = 'hardcore';
do $$ begin
  if to_regclass('public.kapli_record_reports') is not null then delete from public.kapli_record_reports where mode = 'hardcore'; end if;
  if to_regclass('public.kapli_records_rejected') is not null then delete from public.kapli_records_rejected where mode = 'hardcore'; end if;
end $$;
commit;
