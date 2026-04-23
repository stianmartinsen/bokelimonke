import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUserId } from "../lib/supabase.ts";
import { useGameStore } from "../store/gameStore.ts";
import { useRoomRealtime } from "../hooks/useRoomRealtime.ts";
import { Banner, Button, Page, Spinner } from "../components/ui.tsx";
import { Lobby } from "../components/Lobby.tsx";
import { WriteSentence } from "../components/WriteSentence.tsx";
import { Playing } from "../components/Playing.tsx";
import { Finished } from "../components/Finished.tsx";

export function Room() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const code = (params.code ?? "").toUpperCase();

  const { status, error } = useRoomRealtime(code);
  const room = useGameStore((s) => s.room);
  const players = useGameStore((s) => s.players);
  const myId = useGameStore((s) => s.myId);
  const setMyId = useGameStore((s) => s.setMyId);

  useEffect(() => {
    const id = getCurrentUserId();
    if (id) setMyId(id);
  }, [setMyId]);

  if (status === "loading") {
    return (
      <Page className="items-center justify-center">
        <Spinner />
      </Page>
    );
  }

  if (status === "not_found") {
    return (
      <Page>
        <Banner tone="error">
          Room <code className="font-mono">{code}</code> doesn't exist.
        </Banner>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </Page>
    );
  }

  if (status === "error") {
    return (
      <Page>
        <Banner tone="error">{error ?? "Something went wrong"}</Banner>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </Page>
    );
  }

  if (!room) {
    return (
      <Page className="items-center justify-center">
        <Spinner />
      </Page>
    );
  }

  const isMember = myId !== null && players.some((p) => p.id === myId);
  if (!isMember) {
    return (
      <Page>
        <Banner tone="error">You're not in this room. Go back and join with the code.</Banner>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </Page>
    );
  }

  switch (room.phase) {
    case "lobby":
      return <Lobby />;
    case "writing":
      return <WriteSentence />;
    case "playing":
      return <Playing />;
    case "finished":
      return <Finished />;
    default:
      return null;
  }
}
