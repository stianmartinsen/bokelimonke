import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { useGameStore } from "../store/gameStore.ts";
import { Banner, Button, Card, Page, TextArea } from "./ui.tsx";

export function WriteSentence() {
  const room = useGameStore((s) => s.room);
  const players = useGameStore((s) => s.players);
  const sentences = useGameStore((s) => s.sentences);
  const myId = useGameStore((s) => s.myId);

  const mySentence = useMemo(() => sentences.find((s) => s.player_id === myId), [sentences, myId]);

  const [firstHalf, setFirstHalf] = useState(() => mySentence?.first_half ?? "");
  const [secondHalf, setSecondHalf] = useState(() => mySentence?.second_half ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitted = mySentence?.submitted === true;

  async function submit() {
    if (!room) return;
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("submit_sentence", {
        p_room_id: room.id,
        p_first_half: firstHalf,
        p_second_half: secondHalf,
      });
      if (rpcError) throw rpcError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (!room) return null;

  const submittedCount = players.filter((p) =>
    sentences.some((s) => s.player_id === p.id && s.submitted === true),
  ).length;

  if (submitted) {
    return (
      <Page>
        <header className="text-center">
          <h1 className="font-display text-3xl font-bold">Got it.</h1>
          <p className="opacity-70">Waiting for the others to finish writing their sentences.</p>
        </header>
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold opacity-70">Your sentence</p>
          <p className="text-lg">
            {mySentence?.first_half}{" "}
            <span className="rounded bg-lemon/50 px-1">{mySentence?.second_half}</span>
          </p>
        </Card>
        <div className="rounded-2xl bg-white p-4 text-center text-sm opacity-70">
          {submittedCount} / {players.length} players ready
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <header className="text-center">
        <h1 className="font-display text-3xl font-bold">Pick a sentence</h1>
        <p className="mt-1 opacity-70">Grab any book. Find a sentence you like. Split it in two.</p>
      </header>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Card className="flex flex-col gap-4">
        <TextArea
          label="First half (everyone sees this)"
          placeholder="e.g. It was a bright cold day in April,"
          value={firstHalf}
          onChange={(e) => setFirstHalf(e.target.value)}
          maxLength={280}
        />
        <TextArea
          label="Second half (others will try to guess this)"
          placeholder="e.g. and the clocks were striking thirteen."
          value={secondHalf}
          onChange={(e) => setSecondHalf(e.target.value)}
          maxLength={280}
          hint="Try to match the voice and length of the first half."
        />
        <Button onClick={submit} disabled={busy || !firstHalf.trim() || !secondHalf.trim()}>
          {busy ? "Submitting…" : "Lock it in"}
        </Button>
      </Card>

      <div className="text-center text-sm opacity-60">
        {submittedCount} / {players.length} players ready
      </div>
    </Page>
  );
}
