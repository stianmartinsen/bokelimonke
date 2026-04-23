import { useActivePlayers } from "../../store/gameStore.ts";
import { TvFrame } from "./TvFrame.tsx";

export function TvFinished() {
  const players = useActivePlayers();

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const winners = sorted.filter((p) => p.score === topScore);

  return (
    <TvFrame footer="Thanks for playing!">
      <section className="flex flex-col items-center gap-4 pt-4 text-center">
        <p className="text-2xl font-semibold uppercase tracking-[0.3em] opacity-60">Game over</p>
        <h1 className="font-display text-[8rem] font-extrabold leading-none">
          {winners.length === 1 ? `${winners[0]?.nickname} wins!` : "It's a tie!"}
        </h1>
        {winners.length > 1 ? (
          <p className="text-4xl opacity-70">
            {winners.map((w) => w.nickname).join(" & ")} — {topScore} points each
          </p>
        ) : null}
      </section>

      <section className="mx-auto w-full max-w-5xl">
        <h2 className="mb-4 font-display text-4xl font-bold">Final scoreboard</h2>
        <ul className="flex flex-col gap-3">
          {sorted.map((p, idx) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-2xl px-8 py-6 shadow-sm ${
                p.score === topScore ? "bg-lemon" : "bg-white"
              }`}
            >
              <span className="truncate text-4xl font-semibold">
                <span className="mr-3 opacity-50">{idx + 1}.</span>
                {p.nickname}
              </span>
              <span className="font-mono text-5xl font-bold">{p.score}</span>
            </li>
          ))}
        </ul>
      </section>
    </TvFrame>
  );
}
