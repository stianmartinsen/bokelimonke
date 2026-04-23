import { useActivePlayers, useGameStore } from "../../store/gameStore.ts";
import { TvFrame } from "./TvFrame.tsx";

export function TvWriting() {
  const players = useActivePlayers();
  const sentences = useGameStore((s) => s.sentences);

  const submittedIds = new Set(sentences.filter((s) => s.submitted).map((s) => s.player_id));
  const submittedCount = players.filter((p) => submittedIds.has(p.id)).length;

  const sorted = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  return (
    <TvFrame footer="Grab a book, pick a sentence, split it in two.">
      <section className="flex flex-col items-center gap-4 text-center">
        <p className="text-2xl font-semibold uppercase tracking-[0.3em] opacity-60">
          Writing sentences
        </p>
        <h1 className="font-display text-8xl font-extrabold">
          {submittedCount} / {players.length}
        </h1>
        <p className="text-3xl opacity-70">ready to play</p>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        <ul className="grid grid-cols-2 gap-4">
          {sorted.map((p) => {
            const done = submittedIds.has(p.id);
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-2xl px-8 py-6 shadow-sm transition ${
                  done ? "bg-mint/30" : "bg-white"
                }`}
              >
                <span className="truncate text-4xl font-semibold">{p.nickname}</span>
                <span
                  className={`ml-4 font-mono text-3xl font-bold ${done ? "text-mint" : "opacity-30"}`}
                >
                  {done ? "✓" : "…"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </TvFrame>
  );
}
