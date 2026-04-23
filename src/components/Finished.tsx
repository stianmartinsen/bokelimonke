import { useNavigate } from "react-router-dom";
import { selectMe, useGameStore } from "../store/gameStore.ts";
import { Button, Card, Page } from "./ui.tsx";

export function Finished() {
  const navigate = useNavigate();
  const players = useGameStore((s) => s.players);
  const me = useGameStore(selectMe);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const winners = sorted.filter((p) => p.score === topScore);

  return (
    <Page>
      <header className="flex flex-col items-center gap-2 pt-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-60">Game over</p>
        <h1 className="font-display text-4xl font-extrabold">
          {winners.length === 1 ? `${winners[0]?.nickname} wins!` : "It's a tie!"}
        </h1>
        {winners.length > 1 ? (
          <p className="opacity-70">
            {winners.map((w) => w.nickname).join(" & ")} — {topScore} points each
          </p>
        ) : null}
      </header>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold opacity-70">Final scoreboard</p>
        <ul className="flex flex-col gap-2">
          {sorted.map((p, idx) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                p.score === topScore ? "bg-lemon" : "bg-cream"
              }`}
            >
              <span className="font-semibold">
                <span className="mr-2 opacity-50">{idx + 1}.</span>
                {p.nickname}
                {p.id === me?.id ? <span className="ml-1 text-sm opacity-50">(you)</span> : null}
              </span>
              <span className="font-mono text-xl font-bold">{p.score}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Button onClick={() => navigate("/")}>Play again</Button>
    </Page>
  );
}
