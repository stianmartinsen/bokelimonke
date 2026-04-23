-- Bokelimonke: initial schema, RLS, and RPCs.
-- Tables: rooms, players, sentences, rounds, fakes, votes.

create extension if not exists "pgcrypto";

-- =====================================================================
-- Tables
-- =====================================================================

create table if not exists public.rooms (
  id            text primary key,
  host_id       uuid not null,
  phase         text not null default 'lobby'
                check (phase in ('lobby', 'writing', 'playing', 'finished')),
  current_round integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.players (
  id         uuid primary key,
  room_id    text not null references public.rooms(id) on delete cascade,
  nickname   text not null,
  score      integer not null default 0,
  is_host    boolean not null default false,
  joined_at  timestamptz not null default now()
);

create index if not exists players_room_idx on public.players(room_id);

create table if not exists public.sentences (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null references public.rooms(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  first_half  text not null,
  second_half text,
  submitted   boolean not null default false,
  unique (room_id, player_id)
);

create index if not exists sentences_room_idx on public.sentences(room_id);

create table if not exists public.rounds (
  id            uuid primary key default gen_random_uuid(),
  room_id       text not null references public.rooms(id) on delete cascade,
  round_number  integer not null,
  sentence_id   uuid not null references public.sentences(id) on delete cascade,
  phase         text not null default 'faking'
                check (phase in ('faking', 'voting', 'reveal')),
  started_at    timestamptz not null default now(),
  unique (room_id, round_number)
);

create index if not exists rounds_room_idx on public.rounds(room_id);

create table if not exists public.fakes (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.rounds(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  text       text not null,
  unique (round_id, player_id)
);

create index if not exists fakes_round_idx on public.fakes(round_id);

create table if not exists public.votes (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds(id) on delete cascade,
  voter_id     uuid not null references public.players(id) on delete cascade,
  target_kind  text not null check (target_kind in ('fake', 'truth')),
  target_id    uuid, -- fake id when target_kind='fake', null when 'truth'
  unique (round_id, voter_id)
);

create index if not exists votes_round_idx on public.votes(round_id);

-- =====================================================================
-- Realtime
-- =====================================================================

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.sentences;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.fakes;
alter publication supabase_realtime add table public.votes;

-- =====================================================================
-- RLS enable + helpers
-- =====================================================================

alter table public.rooms     enable row level security;
alter table public.players   enable row level security;
alter table public.sentences enable row level security;
alter table public.rounds    enable row level security;
alter table public.fakes     enable row level security;
alter table public.votes     enable row level security;

-- Is the caller a member of this room?
create or replace function public.is_room_member(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players
    where room_id = p_room_id and id = auth.uid()
  );
$$;

-- Current round phase for a given sentence (null if none exists).
create or replace function public.sentence_round_phase(p_sentence_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phase from public.rounds where sentence_id = p_sentence_id
  order by started_at desc limit 1;
$$;

-- =====================================================================
-- RLS policies
-- =====================================================================

-- Rooms: members can read their own room; no direct writes (RPCs only).
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select
  to authenticated
  using (public.is_room_member(id));

-- Players: members can see co-players; no direct writes (RPCs only).
drop policy if exists players_select on public.players;
create policy players_select on public.players for select
  to authenticated
  using (public.is_room_member(room_id));

-- Sentences:
-- - Read own sentence any time.
-- - Read others' first_half once room phase >= writing (lobby hides nothing
--   sensitive), but second_half is hidden by the view below (see notes).
-- Simpler: expose full row to own author, and to co-members only when
-- the sentence's round has phase='reveal'. Clients always fetch
-- first_half via the round -> sentence relationship, so for ongoing
-- rounds we expose first_half through a dedicated view.
drop policy if exists sentences_select_own on public.sentences;
create policy sentences_select_own on public.sentences for select
  to authenticated
  using (player_id = auth.uid());

drop policy if exists sentences_select_reveal on public.sentences;
create policy sentences_select_reveal on public.sentences for select
  to authenticated
  using (
    public.is_room_member(room_id)
    and public.sentence_round_phase(id) = 'reveal'
  );

-- Rounds: visible to room members (contains sentence_id, phase only).
drop policy if exists rounds_select on public.rounds;
create policy rounds_select on public.rounds for select
  to authenticated
  using (public.is_room_member(room_id));

-- Fakes: readable to room members during voting/reveal, plus own row any time.
drop policy if exists fakes_select_own on public.fakes;
create policy fakes_select_own on public.fakes for select
  to authenticated
  using (player_id = auth.uid());

drop policy if exists fakes_select_during_voting on public.fakes;
create policy fakes_select_during_voting on public.fakes for select
  to authenticated
  using (
    exists (
      select 1 from public.rounds r
      where r.id = fakes.round_id
        and public.is_room_member(r.room_id)
        and r.phase in ('voting', 'reveal')
    )
  );

-- Votes: readable to room members only during reveal.
drop policy if exists votes_select_own on public.votes;
create policy votes_select_own on public.votes for select
  to authenticated
  using (voter_id = auth.uid());

drop policy if exists votes_select_reveal on public.votes;
create policy votes_select_reveal on public.votes for select
  to authenticated
  using (
    exists (
      select 1 from public.rounds r
      where r.id = votes.round_id
        and public.is_room_member(r.room_id)
        and r.phase = 'reveal'
    )
  );

-- =====================================================================
-- Exposed view: first_half of a sentence, safe to read during play.
-- =====================================================================

create or replace view public.sentence_prompts
with (security_invoker = true)
as
  select s.id, s.room_id, s.player_id, s.first_half
  from public.sentences s
  where public.is_room_member(s.room_id);

grant select on public.sentence_prompts to authenticated;
