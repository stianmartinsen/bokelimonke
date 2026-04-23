import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Fake, Player, Round, Room, Sentence, Vote } from "../lib/types.ts";

export interface SentencePrompt {
  id: string;
  room_id: string;
  player_id: string;
  first_half: string;
}

interface GameState {
  myId: string | null;
  room: Room | null;
  players: Player[];
  sentences: Sentence[];
  prompts: SentencePrompt[];
  rounds: Round[];
  fakes: Fake[];
  votes: Vote[];

  setMyId: (id: string) => void;
  setRoom: (room: Room | null) => void;
  setPlayers: (players: Player[]) => void;
  upsertPlayer: (player: Player) => void;
  removePlayer: (id: string) => void;
  setSentences: (sentences: Sentence[]) => void;
  upsertSentence: (sentence: Sentence) => void;
  setPrompts: (prompts: SentencePrompt[]) => void;
  upsertPrompt: (prompt: SentencePrompt) => void;
  setRounds: (rounds: Round[]) => void;
  upsertRound: (round: Round) => void;
  setFakes: (fakes: Fake[]) => void;
  upsertFake: (fake: Fake) => void;
  setVotes: (votes: Vote[]) => void;
  upsertVote: (vote: Vote) => void;

  reset: () => void;
}

function upsertBy<T, K extends keyof T>(list: T[], item: T, key: K): T[] {
  const idx = list.findIndex((x) => x[key] === item[key]);
  if (idx === -1) return [...list, item];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}

export const useGameStore = create<GameState>((set) => ({
  myId: null,
  room: null,
  players: [],
  sentences: [],
  prompts: [],
  rounds: [],
  fakes: [],
  votes: [],

  setMyId: (id) => set({ myId: id }),
  setRoom: (room) => set({ room }),
  setPlayers: (players) => set({ players }),
  upsertPlayer: (player) => set((s) => ({ players: upsertBy(s.players, player, "id") })),
  removePlayer: (id) => set((s) => ({ players: s.players.filter((p) => p.id !== id) })),
  setSentences: (sentences) => set({ sentences }),
  upsertSentence: (sentence) => set((s) => ({ sentences: upsertBy(s.sentences, sentence, "id") })),
  setPrompts: (prompts) => set({ prompts }),
  upsertPrompt: (prompt) => set((s) => ({ prompts: upsertBy(s.prompts, prompt, "id") })),
  setRounds: (rounds) => set({ rounds }),
  upsertRound: (round) => set((s) => ({ rounds: upsertBy(s.rounds, round, "id") })),
  setFakes: (fakes) => set({ fakes }),
  upsertFake: (fake) => set((s) => ({ fakes: upsertBy(s.fakes, fake, "id") })),
  setVotes: (votes) => set({ votes }),
  upsertVote: (vote) => set((s) => ({ votes: upsertBy(s.votes, vote, "id") })),

  reset: () =>
    set({
      room: null,
      players: [],
      sentences: [],
      prompts: [],
      rounds: [],
      fakes: [],
      votes: [],
    }),
}));

export function selectCurrentRound(state: GameState): Round | null {
  if (!state.room) return null;
  return state.rounds.find((r) => r.round_number === state.room!.current_round) ?? null;
}

export function selectMe(state: GameState): Player | null {
  if (!state.myId) return null;
  return state.players.find((p) => p.id === state.myId) ?? null;
}

function selectActivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.is_spectator);
}

function selectSpectators(state: GameState): Player[] {
  return state.players.filter((p) => p.is_spectator);
}

// Wrap filtering selectors in useShallow so they don't trigger infinite
// re-renders: they return a fresh array reference every call.
export function useActivePlayers(): Player[] {
  return useGameStore(useShallow(selectActivePlayers));
}

export function useSpectators(): Player[] {
  return useGameStore(useShallow(selectSpectators));
}
