import { useActivePlayers, useGameStore } from "../../store/gameStore.ts";
import { TvFrame } from "./TvFrame.tsx";

export function TvLobby() {
  const room = useGameStore((s) => s.room);
  const players = useActivePlayers();

  if (!room) return null;

  const sorted = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  return (
    <TvFrame footer="Waiting for the host to start…">
      <section className="flex flex-col items-center gap-6 pt-4 text-center">
        <p className="text-2xl font-semibold uppercase tracking-[0.3em] opacity-60">
          Join on your phone
        </p>
        <div className="rounded-3xl border-4 border-ink/10 bg-white px-16 py-10 shadow-sm">
          <p className="font-mono text-[10rem] font-extrabold leading-none tracking-[0.15em]">
            {room.id}
          </p>
        </div>
        <p className="text-2xl opacity-70">
          Go to the Bokelimonke site and tap <span className="font-semibold">Join room</span>.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-5xl font-bold">Players</h2>
          <span className="font-mono text-5xl font-bold opacity-60">{players.length}</span>
        </div>
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-3xl opacity-50">Nobody's joined yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4">
            {sorted.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl bg-white px-8 py-6 shadow-sm"
              >
                <span className="truncate text-4xl font-semibold">{p.nickname}</span>
                {p.is_host ? (
                  <span className="ml-4 rounded-full bg-lemon px-4 py-2 text-base font-bold uppercase tracking-wider">
                    Host
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </TvFrame>
  );
}
