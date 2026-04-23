import { useGameStore } from "../store/gameStore.ts";
import type { Round } from "../lib/types.ts";

interface RoundHeaderProps {
  round: Round;
  authorName: string;
  subtitle?: string;
}

export function RoundHeader({ round, authorName, subtitle }: RoundHeaderProps) {
  const room = useGameStore((s) => s.room);
  const totalRounds = useGameStore((s) => s.players.length);

  return (
    <header className="flex flex-col items-center gap-1 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest opacity-60">
        Round {round.round_number}
        {totalRounds ? ` / ${totalRounds}` : ""}
        {room ? ` • ${room.id}` : ""}
      </p>
      <h1 className="font-display text-2xl font-bold">{authorName}'s sentence</h1>
      {subtitle ? <p className="opacity-70">{subtitle}</p> : null}
    </header>
  );
}
