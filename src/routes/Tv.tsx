import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUserId } from "../lib/supabase.ts";
import { selectCurrentRound, useGameStore } from "../store/gameStore.ts";
import { useRoomRealtime } from "../hooks/useRoomRealtime.ts";
import { TvFrame } from "../components/tv/TvFrame.tsx";
import { TvLobby } from "../components/tv/TvLobby.tsx";
import { TvWriting } from "../components/tv/TvWriting.tsx";
import { TvFaking } from "../components/tv/TvFaking.tsx";
import { TvVoting } from "../components/tv/TvVoting.tsx";
import { TvReveal } from "../components/tv/TvReveal.tsx";
import { TvFinished } from "../components/tv/TvFinished.tsx";

export function Tv() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const code = (params.code ?? "").toUpperCase();

  const { status, error } = useRoomRealtime(code);
  const room = useGameStore((s) => s.room);
  const round = useGameStore(selectCurrentRound);
  const setMyId = useGameStore((s) => s.setMyId);

  useEffect(() => {
    const id = getCurrentUserId();
    if (id) setMyId(id);
  }, [setMyId]);

  if (status === "loading") {
    return (
      <TvFrame>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-4xl opacity-60">Connecting…</p>
        </div>
      </TvFrame>
    );
  }

  if (status === "not_found") {
    return (
      <TvFrame>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-display text-6xl font-bold">Room not found</p>
          <p className="text-2xl opacity-70">
            Code <span className="font-mono">{code}</span> doesn't exist.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 rounded-2xl bg-ink px-6 py-3 text-xl text-cream"
          >
            Back home
          </button>
        </div>
      </TvFrame>
    );
  }

  if (status === "error" || !room) {
    return (
      <TvFrame>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-display text-5xl font-bold">Something went wrong</p>
          <p className="text-2xl opacity-70">{error ?? "Please try again."}</p>
        </div>
      </TvFrame>
    );
  }

  switch (room.phase) {
    case "lobby":
      return <TvLobby />;
    case "writing":
      return <TvWriting />;
    case "playing":
      if (!round) {
        return (
          <TvFrame>
            <div className="flex flex-1 items-center justify-center">
              <p className="text-4xl opacity-60">Loading round…</p>
            </div>
          </TvFrame>
        );
      }
      switch (round.phase) {
        case "faking":
          return <TvFaking />;
        case "voting":
          return <TvVoting />;
        case "reveal":
          return <TvReveal />;
        default:
          return null;
      }
    case "finished":
      return <TvFinished />;
    default:
      return null;
  }
}
