import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.ts";
import { selectCurrentRound, useActivePlayers, useGameStore } from "../../store/gameStore.ts";
import { TvFrame } from "./TvFrame.tsx";

interface Option {
  option_id: string;
  option_text: string;
}

export function TvVoting() {
  const round = useGameStore(selectCurrentRound);
  const prompts = useGameStore((s) => s.prompts);
  const players = useActivePlayers();
  const votes = useGameStore((s) => s.votes);

  const prompt = useMemo(
    () => (round ? prompts.find((p) => p.id === round.sentence_id) : null),
    [prompts, round],
  );
  const author = useMemo(
    () => (prompt ? players.find((p) => p.id === prompt.player_id) : null),
    [prompt, players],
  );

  const nonAuthors = prompt ? players.filter((p) => p.id !== prompt.player_id) : [];
  const votesForRound = votes.filter((v) => v.round_id === round?.id);
  const votedIds = new Set(votesForRound.map((v) => v.voter_id));

  const [options, setOptions] = useState<Option[] | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    void (async () => {
      setOptionsError(null);
      const { data, error } = await supabase.rpc("round_options", {
        p_round_id: round.id,
      });
      if (cancelled) return;
      if (error) {
        setOptionsError(error.message);
        return;
      }
      setOptions(data as Option[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [round?.id]);

  if (!round || !prompt) return null;

  return (
    <TvFrame footer="Pick the real ending on your phone.">
      <section className="flex flex-col items-center gap-2 text-center">
        <p className="text-xl font-semibold uppercase tracking-[0.3em] opacity-60">
          Round {round.round_number} · Vote
        </p>
        <h1 className="font-display text-5xl font-bold">
          {author?.nickname ?? "Someone"}'s sentence
        </h1>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-3xl bg-white px-10 py-8 shadow-sm">
          <p className="text-base font-semibold uppercase tracking-widest opacity-50">First half</p>
          <p className="mt-2 font-display text-5xl font-semibold leading-snug">
            {prompt.first_half}
            <span className="ml-3 opacity-30">…</span>
          </p>
        </div>

        {optionsError ? (
          <div className="rounded-2xl bg-coral/20 px-8 py-6 text-2xl">{optionsError}</div>
        ) : !options ? (
          <p className="text-center text-3xl opacity-60">Shuffling…</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {options.map((opt, idx) => (
              <li
                key={opt.option_id}
                className="flex items-start gap-6 rounded-2xl bg-white px-8 py-6 shadow-sm"
              >
                <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-ink text-4xl font-bold text-cream">
                  {idx + 1}
                </span>
                <p className="flex-1 text-4xl leading-snug">{opt.option_text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-6xl font-extrabold">{votesForRound.length}</span>
          <span className="text-3xl opacity-60">/ {nonAuthors.length} voted</span>
        </div>
        <ul className="flex flex-wrap justify-center gap-3">
          {nonAuthors.map((p) => {
            const done = votedIds.has(p.id);
            return (
              <li
                key={p.id}
                className={`rounded-full px-5 py-2 text-xl font-semibold ${
                  done ? "bg-mint/40" : "bg-white opacity-60"
                }`}
              >
                {p.nickname} {done ? "✓" : "…"}
              </li>
            );
          })}
        </ul>
      </section>
    </TvFrame>
  );
}
