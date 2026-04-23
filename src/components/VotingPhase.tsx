import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { selectCurrentRound, useGameStore } from "../store/gameStore.ts";
import { Banner, Button, Card, Page, Spinner } from "./ui.tsx";
import { RoundHeader } from "./RoundHeader.tsx";

interface Option {
  option_id: string;
  option_text: string;
}

export function VotingPhase() {
  const round = useGameStore(selectCurrentRound);
  const prompts = useGameStore((s) => s.prompts);
  const players = useGameStore((s) => s.players);
  const fakes = useGameStore((s) => s.fakes);
  const votes = useGameStore((s) => s.votes);
  const myId = useGameStore((s) => s.myId);

  const prompt = useMemo(
    () => (round ? prompts.find((p) => p.id === round.sentence_id) : null),
    [prompts, round],
  );
  const author = useMemo(
    () => (prompt ? players.find((p) => p.id === prompt.player_id) : null),
    [prompt, players],
  );
  const myVote = useMemo(
    () =>
      round && myId ? votes.find((v) => v.round_id === round.id && v.voter_id === myId) : null,
    [votes, round, myId],
  );

  const isAuthor = prompt?.player_id === myId;
  const myFake = useMemo(
    () =>
      round && myId ? fakes.find((f) => f.round_id === round.id && f.player_id === myId) : null,
    [fakes, round, myId],
  );

  const nonAuthorCount = players.filter((p) => p.id !== prompt?.player_id).length;
  const votesForRound = votes.filter((v) => v.round_id === round?.id);

  const [options, setOptions] = useState<Option[] | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    void (async () => {
      setOptionsError(null);
      const { data, error: rpcError } = await supabase.rpc("round_options", {
        p_round_id: round.id,
      });
      if (cancelled) return;
      if (rpcError) {
        setOptionsError(rpcError.message);
        return;
      }
      setOptions(data as Option[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [round?.id]);

  async function submit() {
    if (!round || !selected) return;
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("submit_vote", {
        p_round_id: round.id,
        p_option_id: selected,
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
          isAuthor ? "Watch the others vote. No cheating!" : "Which one is the real ending?"
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
          <p className="opacity-70">You wrote this one — sit back and watch the vote.</p>
          <p className="mt-3 text-sm opacity-50">
            {votesForRound.length} / {nonAuthorCount} votes cast
          </p>
        </Card>
      ) : optionsError ? (
        <Banner tone="error">{optionsError}</Banner>
      ) : !options ? (
        <div className="flex justify-center">
          <Spinner />
        </div>
      ) : myVote ? (
        <Card className="text-center">
          <p className="font-semibold">You voted. Good luck.</p>
          <p className="mt-2 text-sm opacity-60">
            {votesForRound.length} / {nonAuthorCount} votes cast
          </p>
        </Card>
      ) : (
        <>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <ul className="flex flex-col gap-3">
            {options.map((opt, idx) => {
              const isMine = myFake?.id === opt.option_id;
              const isSelected = selected === opt.option_id;
              return (
                <li key={opt.option_id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMine) return;
                      setSelected(opt.option_id);
                    }}
                    disabled={isMine}
                    className={`w-full rounded-2xl border-2 px-4 py-4 text-left text-base transition ${
                      isMine
                        ? "cursor-not-allowed border-ink/10 bg-ink/5 opacity-50"
                        : isSelected
                          ? "border-ink bg-lemon"
                          : "border-ink/10 bg-white hover:border-ink/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ink text-sm font-bold text-cream">
                        {idx + 1}
                      </span>
                      <span className="flex-1 leading-relaxed">
                        {opt.option_text}
                        {isMine ? (
                          <span className="ml-2 text-xs font-semibold uppercase tracking-wider opacity-70">
                            Your fake
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button onClick={submit} disabled={!selected || busy}>
            {busy ? "Voting…" : "Lock in my vote"}
          </Button>
          <div className="text-center text-sm opacity-60">
            {votesForRound.length} / {nonAuthorCount} votes cast
          </div>
        </>
      )}
    </Page>
  );
}
