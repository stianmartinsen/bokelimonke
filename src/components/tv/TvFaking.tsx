import { useMemo } from "react";
import { selectCurrentRound, useActivePlayers, useGameStore } from "../../store/gameStore.ts";
import { TvFrame } from "./TvFrame.tsx";

export function TvFaking() {
  const round = useGameStore(selectCurrentRound);
  const prompts = useGameStore((s) => s.prompts);
  const players = useActivePlayers();
  const fakes = useGameStore((s) => s.fakes);

  const prompt = useMemo(
    () => (round ? prompts.find((p) => p.id === round.sentence_id) : null),
    [prompts, round],
  );
  const author = useMemo(
    () => (prompt ? players.find((p) => p.id === prompt.player_id) : null),
    [prompt, players],
  );

  if (!round || !prompt) return null;

  const nonAuthors = players.filter((p) => p.id !== prompt.player_id);
  const submittedIds = new Set(
    fakes.filter((f) => f.round_id === round.id).map((f) => f.player_id),
  );
  const submittedCount = nonAuthors.filter((p) => submittedIds.has(p.id)).length;

  return (
    <TvFrame footer="Everyone else is writing a fake ending on their phone.">
      <section className="flex flex-col items-center gap-2 text-center">
        <p className="text-xl font-semibold uppercase tracking-[0.3em] opacity-60">
          Round {round.round_number}
        </p>
        <h1 className="font-display text-5xl font-bold">
          {author?.nickname ?? "Someone"}'s sentence
        </h1>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center">
        <div className="rounded-3xl bg-white px-12 py-16 shadow-sm">
          <p className="font-display text-7xl font-semibold leading-tight">
            {prompt.first_half}
            <span className="ml-4 opacity-30">…</span>
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6">
        <p className="text-3xl opacity-70">Writing fakes…</p>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-7xl font-extrabold">{submittedCount}</span>
          <span className="text-4xl opacity-60">/ {nonAuthors.length}</span>
        </div>
        <ul className="flex flex-wrap justify-center gap-3">
          {nonAuthors.map((p) => {
            const done = submittedIds.has(p.id);
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
