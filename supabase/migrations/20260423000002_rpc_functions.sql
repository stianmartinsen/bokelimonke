-- Bokelimonke RPC functions: phase transitions + scoring.
-- All functions are security definer and validate auth.uid() themselves.

-- =====================================================================
-- Helpers
-- =====================================================================

-- Generate a random room code. 6 chars, uppercase alphanumeric, no 0/O/1/I.
create or replace function public.gen_room_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- =====================================================================
-- create_room
-- =====================================================================

create or replace function public.create_room(p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
  v_attempts int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if coalesce(btrim(p_nickname), '') = '' then
    raise exception 'Nickname is required' using errcode = '22023';
  end if;

  loop
    v_code := public.gen_room_code();
    begin
      insert into public.rooms (id, host_id) values (v_code, v_uid);
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 8 then
        raise exception 'Could not allocate a unique room code' using errcode = '40001';
      end if;
    end;
  end loop;

  -- Remove previous membership of this user in any other room (single-session).
  delete from public.players where id = v_uid;

  insert into public.players (id, room_id, nickname, is_host)
  values (v_uid, v_code, btrim(p_nickname), true);

  return v_code;
end;
$$;

-- =====================================================================
-- join_room
-- =====================================================================

create or replace function public.join_room(p_code text, p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.rooms;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if coalesce(btrim(p_nickname), '') = '' then
    raise exception 'Nickname is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_code), '') = '' then
    raise exception 'Room code is required' using errcode = '22023';
  end if;

  select * into v_room from public.rooms where id = upper(btrim(p_code));
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;
  if v_room.phase <> 'lobby' then
    raise exception 'Room has already started' using errcode = '55000';
  end if;

  -- Remove stale membership in other rooms; upsert into this one.
  delete from public.players where id = v_uid and room_id <> v_room.id;

  insert into public.players (id, room_id, nickname, is_host)
  values (v_uid, v_room.id, btrim(p_nickname), false)
  on conflict (id) do update
    set nickname = excluded.nickname,
        room_id  = excluded.room_id;

  return v_room.id;
end;
$$;

-- =====================================================================
-- start_game
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

  select count(*) into v_player_count from public.players where room_id = p_room_id;
  if v_player_count < 2 then
    raise exception 'Need at least 2 players to start' using errcode = '55000';
  end if;

  update public.rooms set phase = 'writing' where id = p_room_id;
end;
$$;

-- =====================================================================
-- submit_sentence
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
  if not exists (select 1 from public.players where id = v_uid and room_id = p_room_id) then
    raise exception 'Not a member of this room' using errcode = '42501';
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

  select count(*) into v_total from public.players where room_id = p_room_id;
  select count(*) into v_submitted from public.sentences where room_id = p_room_id and submitted = true;

  if v_submitted >= v_total then
    -- All submitted: transition to playing, create first round.
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
-- submit_fake
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
  if not exists (select 1 from public.players where id = v_uid and room_id = v_round.room_id) then
    raise exception 'Not a member of this room' using errcode = '42501';
  end if;
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'Fake text is required' using errcode = '22023';
  end if;

  insert into public.fakes (round_id, player_id, text)
  values (p_round_id, v_uid, btrim(p_text))
  on conflict (round_id, player_id) do update set text = excluded.text;

  -- Count non-authors in the room.
  select count(*) into v_expected
  from public.players
  where room_id = v_round.room_id
    and id <> v_sentence.player_id;

  select count(*) into v_actual from public.fakes where round_id = p_round_id;

  if v_actual >= v_expected then
    update public.rounds set phase = 'voting' where id = p_round_id;
  end if;
end;
$$;

-- =====================================================================
-- submit_vote (with scoring on completion)
-- =====================================================================

create or replace function public.submit_vote(
  p_round_id    uuid,
  p_target_kind text,
  p_target_id   uuid
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
  v_expected int;
  v_actual int;
  v_any_truth boolean;
begin
  if p_target_kind not in ('fake', 'truth') then
    raise exception 'Invalid target_kind' using errcode = '22023';
  end if;

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
  if not exists (select 1 from public.players where id = v_uid and room_id = v_round.room_id) then
    raise exception 'Not a member of this room' using errcode = '42501';
  end if;

  if p_target_kind = 'fake' then
    if p_target_id is null then
      raise exception 'target_id required for fake' using errcode = '22023';
    end if;
    -- Can't vote for own fake.
    if exists (
      select 1 from public.fakes
      where id = p_target_id and player_id = v_uid
    ) then
      raise exception 'Cannot vote for your own fake' using errcode = '55000';
    end if;
    if not exists (
      select 1 from public.fakes where id = p_target_id and round_id = p_round_id
    ) then
      raise exception 'Fake does not belong to this round' using errcode = '22023';
    end if;
  end if;

  insert into public.votes (round_id, voter_id, target_kind, target_id)
  values (p_round_id, v_uid, p_target_kind, case when p_target_kind = 'fake' then p_target_id else null end)
  on conflict (round_id, voter_id) do update
    set target_kind = excluded.target_kind,
        target_id   = excluded.target_id;

  -- Count non-authors in the room (these are the voters).
  select count(*) into v_expected
  from public.players
  where room_id = v_round.room_id
    and id <> v_sentence.player_id;

  select count(*) into v_actual from public.votes where round_id = p_round_id;

  if v_actual >= v_expected then
    -- Everyone has voted: score + transition to reveal.

    -- +1 for each voter who picked truth.
    update public.players p
    set score = p.score + 1
    from public.votes v
    where v.round_id = p_round_id
      and v.target_kind = 'truth'
      and p.id = v.voter_id;

    -- +1 per vote received for each fake's author.
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

    -- If nobody picked truth, the sentence author gets +1.
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

-- =====================================================================
-- next_round
-- =====================================================================

create or replace function public.next_round(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_used uuid[];
  v_next uuid;
  v_number int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;
  if v_room.host_id <> v_uid then
    raise exception 'Only the host can advance rounds' using errcode = '42501';
  end if;
  if v_room.phase <> 'playing' then
    raise exception 'Not in playing phase' using errcode = '55000';
  end if;

  -- Require the current (latest) round to be in reveal.
  if not exists (
    select 1 from public.rounds
    where room_id = p_room_id
      and round_number = v_room.current_round
      and phase = 'reveal'
  ) then
    raise exception 'Current round not finished' using errcode = '55000';
  end if;

  select coalesce(array_agg(sentence_id), '{}') into v_used
  from public.rounds where room_id = p_room_id;

  select id into v_next
  from public.sentences
  where room_id = p_room_id
    and not (id = any (v_used))
  order by random()
  limit 1;

  if v_next is null then
    update public.rooms set phase = 'finished' where id = p_room_id;
    return;
  end if;

  v_number := v_room.current_round + 1;

  insert into public.rounds (room_id, round_number, sentence_id, phase)
  values (p_room_id, v_number, v_next, 'faking');

  update public.rooms set current_round = v_number where id = p_room_id;
end;
$$;

-- =====================================================================
-- Grants
-- =====================================================================

grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.start_game(text) to authenticated;
grant execute on function public.submit_sentence(text, text, text) to authenticated;
grant execute on function public.submit_fake(uuid, text) to authenticated;
grant execute on function public.submit_vote(uuid, text, uuid) to authenticated;
grant execute on function public.next_round(text) to authenticated;
