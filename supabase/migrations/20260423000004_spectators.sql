-- Bokelimonke: spectator/TV mode.
-- Adds is_spectator to players, a join_as_spectator RPC, and patches the
-- existing phase-transition RPCs to exclude spectators from player counts
-- and block spectator callers from writing game data.

alter table public.players
  add column if not exists is_spectator boolean not null default false;

-- =====================================================================
-- join_as_spectator: any authenticated client can watch a room without
-- participating. Works in any room phase, so a TV can drop in mid-game.
-- =====================================================================

create or replace function public.join_as_spectator(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if coalesce(btrim(p_code), '') = '' then
    raise exception 'Room code is required' using errcode = '22023';
  end if;

  select * into v_room from public.rooms where id = upper(btrim(p_code));
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  delete from public.players where id = v_uid and room_id <> v_room.id;

  insert into public.players (id, room_id, nickname, is_host, is_spectator)
  values (v_uid, v_room.id, 'TV', false, true)
  on conflict (id) do update
    set nickname     = 'TV',
        room_id      = excluded.room_id,
        is_host      = false,
        is_spectator = true;

  return v_room.id;
end;
$$;

grant execute on function public.join_as_spectator(text) to authenticated;

-- =====================================================================
-- start_game: require at least 2 non-spectator players.
-- =====================================================================

create or replace function public.start_game(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_player_count int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;
  if v_room.host_id <> v_uid then
    raise exception 'Only the host can start the game' using errcode = '42501';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'Game already started' using errcode = '55000';
  end if;

  select count(*) into v_player_count
  from public.players
  where room_id = p_room_id and is_spectator = false;
  if v_player_count < 2 then
    raise exception 'Need at least 2 players to start' using errcode = '55000';
  end if;

  update public.rooms set phase = 'writing' where id = p_room_id;
end;
$$;

-- =====================================================================
-- submit_sentence: spectators cannot submit; total excludes spectators.
-- =====================================================================

create or replace function public.submit_sentence(
  p_room_id     text,
  p_first_half  text,
  p_second_half text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_submitted int;
  v_total int;
  v_first_sentence uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;
  if v_room.phase <> 'writing' then
    raise exception 'Not in writing phase' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.players
    where id = v_uid and room_id = p_room_id and is_spectator = false
  ) then
    raise exception 'Not a playing member of this room' using errcode = '42501';
  end if;
  if coalesce(btrim(p_first_half), '') = '' or coalesce(btrim(p_second_half), '') = '' then
    raise exception 'Both halves are required' using errcode = '22023';
  end if;

  insert into public.sentences (room_id, player_id, first_half, second_half, submitted)
  values (p_room_id, v_uid, btrim(p_first_half), btrim(p_second_half), true)
  on conflict (room_id, player_id) do update
    set first_half  = excluded.first_half,
        second_half = excluded.second_half,
        submitted   = true;

  select count(*) into v_total
  from public.players
  where room_id = p_room_id and is_spectator = false;
  select count(*) into v_submitted
  from public.sentences
  where room_id = p_room_id and submitted = true;

  if v_submitted >= v_total then
    select id into v_first_sentence
    from public.sentences
    where room_id = p_room_id
    order by random()
    limit 1;

    insert into public.rounds (room_id, round_number, sentence_id, phase)
    values (p_room_id, 1, v_first_sentence, 'faking');

    update public.rooms
    set phase = 'playing', current_round = 1
    where id = p_room_id;
  end if;
end;
$$;

-- =====================================================================
-- submit_fake: spectators cannot submit; non-author count excludes spectators.
-- =====================================================================

create or replace function public.submit_fake(p_round_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_sentence public.sentences;
  v_expected int;
  v_actual int;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then
    raise exception 'Round not found' using errcode = 'P0002';
  end if;
  if v_round.phase <> 'faking' then
    raise exception 'Not in faking phase' using errcode = '55000';
  end if;

  select * into v_sentence from public.sentences where id = v_round.sentence_id;
  if v_sentence.player_id = v_uid then
    raise exception 'Authors cannot submit a fake' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.players
    where id = v_uid and room_id = v_round.room_id and is_spectator = false
  ) then
    raise exception 'Not a playing member of this room' using errcode = '42501';
  end if;
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'Fake text is required' using errcode = '22023';
  end if;

  insert into public.fakes (round_id, player_id, text)
  values (p_round_id, v_uid, btrim(p_text))
  on conflict (round_id, player_id) do update set text = excluded.text;

  select count(*) into v_expected
  from public.players
  where room_id = v_round.room_id
    and is_spectator = false
    and id <> v_sentence.player_id;

  select count(*) into v_actual from public.fakes where round_id = p_round_id;

  if v_actual >= v_expected then
    update public.rounds set phase = 'voting' where id = p_round_id;
  end if;
end;
$$;

-- =====================================================================
-- submit_vote: spectators cannot vote; voter count excludes spectators.
-- =====================================================================

create or replace function public.submit_vote(
  p_round_id  uuid,
  p_option_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_sentence public.sentences;
  v_kind text;
  v_target uuid;
  v_expected int;
  v_actual int;
  v_any_truth boolean;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then
    raise exception 'Round not found' using errcode = 'P0002';
  end if;
  if v_round.phase <> 'voting' then
    raise exception 'Not in voting phase' using errcode = '55000';
  end if;

  select * into v_sentence from public.sentences where id = v_round.sentence_id;
  if v_sentence.player_id = v_uid then
    raise exception 'Authors cannot vote' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.players
    where id = v_uid and room_id = v_round.room_id and is_spectator = false
  ) then
    raise exception 'Not a playing member of this room' using errcode = '42501';
  end if;

  if p_option_id = v_sentence.id then
    v_kind := 'truth';
    v_target := null;
  elsif exists (
    select 1 from public.fakes
    where id = p_option_id and round_id = p_round_id
  ) then
    if exists (
      select 1 from public.fakes
      where id = p_option_id and player_id = v_uid
    ) then
      raise exception 'Cannot vote for your own fake' using errcode = '55000';
    end if;
    v_kind := 'fake';
    v_target := p_option_id;
  else
    raise exception 'Invalid option' using errcode = '22023';
  end if;

  insert into public.votes (round_id, voter_id, target_kind, target_id)
  values (p_round_id, v_uid, v_kind, v_target)
  on conflict (round_id, voter_id) do update
    set target_kind = excluded.target_kind,
        target_id   = excluded.target_id;

  select count(*) into v_expected
  from public.players
  where room_id = v_round.room_id
    and is_spectator = false
    and id <> v_sentence.player_id;

  select count(*) into v_actual from public.votes where round_id = p_round_id;

  if v_actual >= v_expected then
    update public.players p
    set score = p.score + 1
    from public.votes v
    where v.round_id = p_round_id
      and v.target_kind = 'truth'
      and p.id = v.voter_id;

    update public.players p
    set score = p.score + sub.n
    from (
      select f.player_id, count(*)::int as n
      from public.votes v
      join public.fakes f on f.id = v.target_id
      where v.round_id = p_round_id and v.target_kind = 'fake'
      group by f.player_id
    ) sub
    where p.id = sub.player_id;

    select exists (
      select 1 from public.votes
      where round_id = p_round_id and target_kind = 'truth'
    ) into v_any_truth;

    if not v_any_truth then
      update public.players
      set score = score + 1
      where id = v_sentence.player_id;
    end if;

    update public.rounds set phase = 'reveal' where id = p_round_id;
  end if;
end;
$$;

grant execute on function public.submit_vote(uuid, uuid) to authenticated;
