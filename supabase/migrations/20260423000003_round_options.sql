-- round_options: safely return voting options (fakes + truth) without
-- revealing which one is the truth. Client votes by option_id only.

create or replace function public.round_options(p_round_id uuid)
returns table (option_id uuid, option_text text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found then
    raise exception 'Round not found' using errcode = 'P0002';
  end if;
  if v_round.phase not in ('voting', 'reveal') then
    raise exception 'Round is not in voting or reveal phase' using errcode = '55000';
  end if;
  if auth.uid() is null or not public.is_room_member(v_round.room_id) then
    raise exception 'Not a member of this room' using errcode = '42501';
  end if;

  return query
    select sub.option_id, sub.option_text
    from (
      select f.id as option_id, f.text as option_text
      from public.fakes f
      where f.round_id = p_round_id
      union all
      select s.id as option_id, s.second_half as option_text
      from public.sentences s
      where s.id = v_round.sentence_id
    ) sub
    order by md5(p_round_id::text || sub.option_id::text);
end;
$$;

grant execute on function public.round_options(uuid) to authenticated;

drop function if exists public.submit_vote(uuid, text, uuid);

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
  if not exists (select 1 from public.players where id = v_uid and room_id = v_round.room_id) then
    raise exception 'Not a member of this room' using errcode = '42501';
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
