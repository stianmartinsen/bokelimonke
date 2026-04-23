import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { selectCurrentRound, selectMe, useGameStore } from "../store/gameStore.ts";
import { Banner, Button, Card, Page } from "./ui.tsx";
import { RoundHeader } from "./RoundHeader.tsx";

export function RevealPhase() {
  const room = useGameStore((s) => s.room);
  const round = useGameStore(selectCurrentRound);
  const prompts = useGameStore((s) => s.prompts);
  const players = useGameStore((s) => s.players);
  const sentences = useGameStore((s) => s.sentences);
  const fakes = useGameStore((s) => s.fakes);
  const votes = useGameStore((s) => s.votes);
  const me = useGameStore(selectMe);

  const prompt = useMemo(
    () => (round ? prompts.find((p) => p.id === round.sentence_id) : null),
    [prompts, round],
  );
  const truth = useMemo(
    () => (round ? sentences.find((s) => s.id === round.sentence_id) : null),
    [sentences, round],
  );
  const author = useMemo(
    () => (prompt ? players.find((p) => p.id === prompt.player_id) : null),
    [prompt, players],
  );

  const roundFakes = useMemo(() => fakes.filter((f) => f.round_id === round?.id), [fakes, round]);
  const roundVotes = useMemo(() => votes.filter((v) => v.round_id === round?.id), [votes, round]);

  const playerById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) m.set(p.id, p.nickname);
    return m;
  }, [players]);

  const votersByTarget = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of roundVotes) {
      const key = v.target_kind === "truth" ? "truth" : (v.target_id ?? "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(playerById.get(v.voter_id) ?? "?");
    }
    return map;
  }, [roundVotes, playerById]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    if (!room) return;
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("next_round", {
        p_room_id: room.id,
      });
      if (rpcError) throw rpcError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not advance");
    } finally {
      setBusy(false);
    }
  }

  if (!round || !prompt) return null;

  const isHost = me?.is_host ?? false;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <Page>
      <RoundHeader
        round={round}
        authorName={author?.nickname ?? "Someone"}
        subtitle="Reveal time."
      />

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold opacity-70">The real sentence</p>
        <p className="text-lg leading-relaxed">
          {prompt.first_half}{" "}
          <span className="rounded bg-mint/40 px-1">{truth?.second_half ?? "…"}</span>
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold opacity-70">The fakes</p>
        {roundFakes.map((fake) => {
          const voters = votersByTarget.get(fake.id) ?? [];
          const authorName = playerById.get(fake.player_id) ?? "?";
          return (
            <Card key={fake.id} className="flex flex-col gap-2">
              <p className="text-base leading-relaxed">{fake.text}</p>
              <div className="flex items-center justify-between text-sm opacity-70">
                <span>
                  by <span className="font-semibold">{authorName}</span>
                </span>
                <span>{voters.length > 0 ? `Fooled: ${voters.join(", ")}` : "No takers"}</span>
              </div>
            </Card>
          );
        })}

        {(() => {
          const truthVoters = votersByTarget.get("truth") ?? [];
          return (
            <Card className="flex flex-col gap-2 border-mint/50 bg-mint/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-mint">Truth</p>
              <p className="text-base leading-relaxed">{truth?.second_half ?? ""}</p>
              <div className="text-sm opacity-70">
                {truthVoters.length > 0
                  ? `Got it right: ${truthVoters.join(", ")}`
                  : "Nobody guessed the truth — point to the author!"}
              </div>
            </Card>
          );
        })()}
      </div>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold opacity-70">Scoreboard</p>
        <ul className="flex flex-col gap-2">
          {sortedPlayers.map((p, idx) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-cream px-3 py-2"
            >
              <span className="font-semibold">
                <span className="mr-2 opacity-50">{idx + 1}.</span>
                {p.nickname}
                {p.id === me?.id ? <span className="ml-1 text-sm opacity-50">(you)</span> : null}
              </span>
              <span className="font-mono text-lg font-bold">{p.score}</span>
            </li>
          ))}
        </ul>
      </Card>

      {error ? <Banner tone="error">{error}</Banner> : null}

      {isHost ? (
        <Button onClick={handleNext} disabled={busy}>
          {busy ? "Working…" : "Next round"}
        </Button>
      ) : (
        <Banner>Waiting for the host to continue…</Banner>
      )}
    </Page>
  );
}
