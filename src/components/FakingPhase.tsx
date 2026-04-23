import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { selectCurrentRound, useGameStore } from "../store/gameStore.ts";
import { Banner, Button, Card, Page, TextArea } from "./ui.tsx";
import { RoundHeader } from "./RoundHeader.tsx";

export function FakingPhase() {
  const round = useGameStore(selectCurrentRound);
  const prompts = useGameStore((s) => s.prompts);
  const players = useGameStore((s) => s.players);
  const fakes = useGameStore((s) => s.fakes);
  const myId = useGameStore((s) => s.myId);

  const prompt = useMemo(
    () => (round ? prompts.find((p) => p.id === round.sentence_id) : null),
    [prompts, round],
  );
  const author = useMemo(
    () => (prompt ? players.find((p) => p.id === prompt.player_id) : null),
    [prompt, players],
  );
  const myFake = useMemo(
    () =>
      round && myId ? fakes.find((f) => f.round_id === round.id && f.player_id === myId) : null,
    [fakes, round, myId],
  );

  const isAuthor = prompt?.player_id === myId;
  const nonAuthorCount = players.filter((p) => p.id !== prompt?.player_id).length;
  const fakesForRound = fakes.filter((f) => f.round_id === round?.id);

  const [text, setText] = useState(() => myFake?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!round) return;
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("submit_fake", {
        p_round_id: round.id,
        p_text: text,
      });
      if (rpcError) throw rpcError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (!round || !prompt) return null;

  const authorName = author?.nickname ?? "Someone";

  return (
    <Page>
      <RoundHeader
        round={round}
        authorName={authorName}
        subtitle={
          isAuthor
            ? "Wait while the others make up fake endings."
            : "Write a fake ending. Try to trick the others."
        }
      />

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold opacity-70">First half</p>
        <p className="text-lg leading-relaxed">
          {prompt.first_half}
          <span className="ml-1 opacity-40">…</span>
        </p>
      </Card>

      {isAuthor ? (
        <Card className="text-center">
          <p className="opacity-70">You wrote this one. Kick back and watch the bluffs roll in.</p>
          <p className="mt-3 text-sm opacity-50">
            {fakesForRound.length} / {nonAuthorCount} fakes submitted
          </p>
        </Card>
      ) : myFake ? (
        <>
          <Card className="flex flex-col gap-2">
            <p className="text-sm font-semibold opacity-70">Your fake</p>
            <p className="text-lg">{myFake.text}</p>
          </Card>
          <div className="text-center text-sm opacity-60">
            {fakesForRound.length} / {nonAuthorCount} fakes submitted
          </div>
        </>
      ) : (
        <>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Card className="flex flex-col gap-3">
            <TextArea
              label="Fake ending"
              placeholder="…and then a dragon ate the moon."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={280}
            />
            <Button onClick={submit} disabled={busy || !text.trim()}>
              {busy ? "Submitting…" : "Submit fake"}
            </Button>
          </Card>
          <div className="text-center text-sm opacity-60">
            {fakesForRound.length} / {nonAuthorCount} fakes submitted
          </div>
        </>
      )}
    </Page>
  );
}
