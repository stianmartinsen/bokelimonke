-- Fix: non-author players couldn't see the first half of a sentence during
-- faking/voting, because sentence_prompts was a security_invoker view that
-- inherited the RLS policies of public.sentences. Those policies only allow
-- reading your own row, or any sentence whose round is in 'reveal'.
--
-- The view is designed to expose only the safe first_half column to all
-- room members, so it should run with the owner's privileges and enforce
-- access via its own is_room_member() where-clause.

drop view if exists public.sentence_prompts;

create view public.sentence_prompts
with (security_invoker = false)
as
  select s.id, s.room_id, s.player_id, s.first_half
  from public.sentences s
  where public.is_room_member(s.room_id);

grant select on public.sentence_prompts to authenticated;
