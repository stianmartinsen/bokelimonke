import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.ts";
import { selectCurrentRound, useGameStore, type SentencePrompt } from "../store/gameStore.ts";
import type { Fake, Player, Room, Round, Sentence, Vote } from "../lib/types.ts";

export type RealtimeStatus = "loading" | "ready" | "not_found" | "error";

export function useRoomRealtime(roomId: string): {
  status: RealtimeStatus;
  error: string | null;
} {
  const [status, setStatus] = useState<RealtimeStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const store = useGameStore.getState();
    store.reset();

    async function initialFetch() {
      const [roomRes, playersRes, sentencesRes, promptsRes, roundsRes] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("players").select("*").eq("room_id", roomId),
        supabase.from("sentences").select("*").eq("room_id", roomId),
        supabase.from("sentence_prompts").select("*").eq("room_id", roomId),
        supabase.from("rounds").select("*").eq("room_id", roomId),
      ]);

      if (cancelled) return;
      if (roomRes.error) throw roomRes.error;
      if (!roomRes.data) {
        setStatus("not_found");
        return;
      }
      if (playersRes.error) throw playersRes.error;
      if (sentencesRes.error) throw sentencesRes.error;
      if (promptsRes.error) throw promptsRes.error;
      if (roundsRes.error) throw roundsRes.error;

      const rounds = (roundsRes.data ?? []) as Round[];
      store.setRoom(roomRes.data as Room);
      store.setPlayers((playersRes.data ?? []) as Player[]);
      store.setSentences((sentencesRes.data ?? []) as Sentence[]);
      store.setPrompts((promptsRes.data ?? []) as SentencePrompt[]);
      store.setRounds(rounds);

      const roundIds = rounds.map((r) => r.id);
      if (roundIds.length > 0) {
        const [fakesRes, votesRes] = await Promise.all([
          supabase.from("fakes").select("*").in("round_id", roundIds),
          supabase.from("votes").select("*").in("round_id", roundIds),
        ]);
        if (cancelled) return;
        if (fakesRes.error) throw fakesRes.error;
        if (votesRes.error) throw votesRes.error;
        store.setFakes((fakesRes.data ?? []) as Fake[]);
        store.setVotes((votesRes.data ?? []) as Vote[]);
      }

      setStatus("ready");
    }

    initialFetch().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Failed to load room");
      setStatus("error");
    });

    // Channel: room-scoped tables.
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            useGameStore.getState().setRoom(null);
            return;
          }
          useGameStore.getState().setRoom(payload.new as Room);
          // Re-fetch prompts/sentences, since RLS visibility of sentences can
          // change when room phase advances.
          void refetchAfterPhaseChange();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            useGameStore.getState().removePlayer((payload.old as Player).id);
          } else {
            useGameStore.getState().upsertPlayer(payload.new as Player);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rounds",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          useGameStore.getState().upsertRound(payload.new as Round);
          void refetchAfterPhaseChange();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sentences",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          useGameStore.getState().upsertSentence(payload.new as Sentence);
        },
      )
      // Fakes/votes don't have room_id. Subscribe without filter; RLS
      // limits what we receive. Also filter client-side by known round ids.
      .on("postgres_changes", { event: "*", schema: "public", table: "fakes" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const fake = payload.new as Fake;
        const roundIds = useGameStore.getState().rounds.map((r) => r.id);
        if (!roundIds.includes(fake.round_id)) return;
        useGameStore.getState().upsertFake(fake);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const vote = payload.new as Vote;
        const roundIds = useGameStore.getState().rounds.map((r) => r.id);
        if (!roundIds.includes(vote.round_id)) return;
        useGameStore.getState().upsertVote(vote);
      })
      .subscribe();

    // When phase changes, refresh data that has phase-dependent RLS visibility
    // (e.g. reveal unlocks all sentences; voting unlocks fakes).
    async function refetchAfterPhaseChange() {
      try {
        const state = useGameStore.getState();
        const currentRound = selectCurrentRound(state);

        const [sentencesRes, promptsRes] = await Promise.all([
          supabase.from("sentences").select("*").eq("room_id", roomId),
          supabase.from("sentence_prompts").select("*").eq("room_id", roomId),
        ]);

        if (cancelled) return;
        if (!sentencesRes.error) store.setSentences((sentencesRes.data ?? []) as Sentence[]);
        if (!promptsRes.error) store.setPrompts((promptsRes.data ?? []) as SentencePrompt[]);

        if (currentRound) {
          const [fakesRes, votesRes] = await Promise.all([
            supabase.from("fakes").select("*").eq("round_id", currentRound.id),
            supabase.from("votes").select("*").eq("round_id", currentRound.id),
          ]);
          if (cancelled) return;
          if (!fakesRes.error) store.setFakes((fakesRes.data ?? []) as Fake[]);
          if (!votesRes.error) store.setVotes((votesRes.data ?? []) as Vote[]);
        }
      } catch {
        // ignore transient fetch errors; realtime will reconcile.
      }
    }

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { status, error };
}
