import { useMemo } from "react";
import { selectCurrentRound, useActivePlayers, useGameStore } from "../../store/gameStore.ts";
import { TvFrame } from "./TvFrame.tsx";

export function TvReveal() {
  const round = useGameStore(selectCurrentRound);
  const prompts = useGameStore((s) => s.prompts);
  const players = useActivePlayers();
  const sentences = useGameStore((s) => s.sentences);
  const fakes = useGameStore((s) => s.fakes);
  const votes = useGameStore((s) => s.votes);

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

  if (!round || !prompt) return null;

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const truthVoters = votersByTarget.get("truth") ?? [];

  return (
    <TvFrame footer="Host: tap Next round on your phone when you're ready.">
      <section className="flex flex-col items-center gap-2 text-center">
        <p className="text-xl font-semibold uppercase tracking-[0.3em] opacity-60">
          Round {round.round_number} · Reveal
        </p>
        <h1 className="font-display text-5xl font-bold">
          {author?.nickname ?? "Someone"}'s sentence
        </h1>
      </section>

      <section className="mx-auto w-full max-w-6xl rounded-3xl border-4 border-mint/50 bg-mint/10 px-10 py-8 shadow-sm">
        <p className="text-base font-semibold uppercase tracking-widest text-mint">Truth</p>
        <p className="mt-2 font-display text-5xl font-semibold leading-snug">
          {prompt.first_half}{" "}
          <span className="rounded bg-mint/40 px-2">{truth?.second_half ?? "…"}</span>
        </p>
        <p className="mt-4 text-2xl opacity-70">
          {truthVoters.length > 0
            ? `Got it right: ${truthVoters.join(", ")}`
            : "Nobody guessed the truth — point to the author!"}
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-2">
        {roundFakes.map((fake) => {
          const voters = votersByTarget.get(fake.id) ?? [];
          const fakeAuthor = playerById.get(fake.player_id) ?? "?";
          return (
            <div
              key={fake.id}
              className="flex flex-col gap-2 rounded-2xl bg-white px-8 py-6 shadow-sm"
            >
              <p className="text-2xl leading-snug">{fake.text}</p>
              <div className="flex items-center justify-between text-lg opacity-70">
                <span>
                  by <span className="font-semibold">{fakeAuthor}</span>
                </span>
                <span>{voters.length > 0 ? `Fooled: ${voters.join(", ")}` : "No takers"}</span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mx-auto w-full max-w-5xl">
        <h2 className="mb-4 font-display text-4xl font-bold">Scoreboard</h2>
        <ul className="grid grid-cols-2 gap-3">
          {sorted.map((p, idx) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-white px-6 py-4 shadow-sm"
            >
              <span className="truncate text-3xl font-semibold">
                <span className="mr-3 opacity-50">{idx + 1}.</span>
                {p.nickname}
              </span>
              <span className="font-mono text-3xl font-bold">{p.score}</span>
            </li>
          ))}
        </ul>
      </section>
    </TvFrame>
  );
}
