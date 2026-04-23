-- Bokelimonke: scheduled cleanup of abandoned and finished rooms.
-- Everything else (players, sentences, rounds, fakes, votes) cascades
-- from rooms, so deleting the room is enough.

create extension if not exists pg_cron;

-- =====================================================================
-- Cleanup function
-- =====================================================================

-- Finished rooms are dropped quickly; unfinished rooms are kept a bit
-- longer in case players come back. These thresholds can be tuned.
create or replace function public.cleanup_stale_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rooms
  where (phase = 'finished'  and created_at < now() - interval '6 hours')
     or (phase <> 'finished' and created_at < now() - interval '2 days');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_stale_rooms() from public, anon, authenticated;

-- =====================================================================
-- Schedule: run daily at 04:00 UTC
-- =====================================================================

-- Unschedule any previous job with this name so this migration is idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bokelimonke-cleanup-rooms') then
    perform cron.unschedule('bokelimonke-cleanup-rooms');
  end if;
end $$;

select cron.schedule(
  'bokelimonke-cleanup-rooms',
  '0 4 * * *',
  $$ select public.cleanup_stale_rooms(); $$
);
