import { useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { selectMe, useActivePlayers, useGameStore, useSpectators } from "../store/gameStore.ts";
import { Banner, Button, Card, Page } from "./ui.tsx";

export function Lobby() {
  const room = useGameStore((s) => s.room);
  const players = useActivePlayers();
  const spectators = useSpectators();
  const me = useGameStore(selectMe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const isHost = me?.is_host ?? false;
  const canStart = isHost && players.length >= 2;

  async function startGame() {
    if (!room) return;
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("start_game", {
        p_room_id: room.id,
      });
      if (rpcError) throw rpcError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore; user can still read the code.
    }
  }

  const sortedPlayers = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  return (
    <Page>
      <header className="flex flex-col items-center gap-3 pt-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-60">Room code</p>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-2xl border-2 border-ink/10 bg-white px-6 py-3 font-mono text-4xl font-bold tracking-[0.3em] shadow-sm active:scale-[0.98]"
        >
          {room.id}
        </button>
        <p className="text-sm opacity-60">
          {copied ? "Copied!" : "Tap to copy. Share with your friends."}
        </p>
      </header>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Players</h2>
          <span className="text-sm opacity-60">{players.length}</span>
        </div>
        <ul className="flex flex-col gap-2">
          {sortedPlayers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-cream px-4 py-3"
            >
              <span className="font-semibold">
                {p.nickname}
                {p.id === me?.id ? <span className="ml-1 text-sm opacity-50">(you)</span> : null}
              </span>
              {p.is_host ? (
                <span className="rounded-full bg-lemon px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  Host
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {spectators.length > 0 ? (
          <p className="text-center text-xs opacity-60">
            {spectators.length === 1 ? "1 TV connected" : `${spectators.length} TVs connected`}
          </p>
        ) : null}
      </Card>

      {isHost ? (
        <Button variant="primary" onClick={startGame} disabled={!canStart || busy}>
          {busy ? "Starting…" : canStart ? "Start the game" : "Waiting for players…"}
        </Button>
      ) : (
        <Banner>Waiting for the host to start the game…</Banner>
      )}
    </Page>
  );
}
