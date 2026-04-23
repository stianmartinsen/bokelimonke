import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.ts";
import { Banner, Button, Card, Page, TextField } from "../components/ui.tsx";

const NICKNAME_KEY = "bokelimonke.nickname";

export function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICKNAME_KEY) ?? "");
  const [code, setCode] = useState("");
  const [tvCode, setTvCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | "tv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function persistNickname(name: string) {
    localStorage.setItem(NICKNAME_KEY, name);
  }

  async function handleCreate() {
    setError(null);
    setBusy("create");
    try {
      const trimmed = nickname.trim();
      if (!trimmed) {
        setError("Enter a nickname first");
        return;
      }
      persistNickname(trimmed);
      const { data, error: rpcError } = await supabase.rpc("create_room", {
        p_nickname: trimmed,
      });
      if (rpcError) throw rpcError;
      void navigate(`/r/${data as string}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room");
    } finally {
      setBusy(null);
    }
  }

  async function handleJoinAsTv() {
    setError(null);
    setBusy("tv");
    try {
      const trimmedCode = tvCode.trim().toUpperCase();
      if (!trimmedCode) {
        setError("Enter the room code");
        return;
      }
      const { data, error: rpcError } = await supabase.rpc("join_as_spectator", {
        p_code: trimmedCode,
      });
      if (rpcError) throw rpcError;
      void navigate(`/tv/${data as string}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join as TV");
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    setError(null);
    setBusy("join");
    try {
      const trimmedNick = nickname.trim();
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedNick) {
        setError("Enter a nickname first");
        return;
      }
      if (!trimmedCode) {
        setError("Enter the room code");
        return;
      }
      persistNickname(trimmedNick);
      const { data, error: rpcError } = await supabase.rpc("join_room", {
        p_code: trimmedCode,
        p_nickname: trimmedNick,
      });
      if (rpcError) throw rpcError;
      void navigate(`/r/${data as string}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join room");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <header className="flex flex-col items-center gap-2 pt-4 text-center">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Bokelimonke</h1>
        <p className="opacity-70">Grab a book, pick a sentence — fool your friends.</p>
      </header>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Card className="flex flex-col gap-4">
        <TextField
          label="Your nickname"
          hint="Shown to other players when you create or join a room."
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Rolf"
          autoCapitalize="words"
          autoComplete="nickname"
          maxLength={24}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold">Start a new room</h2>
          <p className="text-sm opacity-70">Invite your friends with a room code.</p>
        </div>
        <Button variant="primary" onClick={handleCreate} disabled={busy !== null}>
          {busy === "create" ? "Creating…" : "Create a room"}
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold">Join a room</h2>
          <p className="text-sm opacity-70">Got a code from a friend? Enter it below.</p>
        </div>
        <TextField
          label="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC23F"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={6}
          inputMode="text"
        />
        <Button variant="secondary" onClick={handleJoin} disabled={busy !== null}>
          {busy === "join" ? "Joining…" : "Join room"}
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold">Big screen mode</h2>
          <p className="text-sm opacity-70">
            Use on a TV or laptop to show the game to everyone in the room.
          </p>
        </div>
        <TextField
          label="Room code"
          value={tvCode}
          onChange={(e) => setTvCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC23F"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={6}
          inputMode="text"
        />
        <Button variant="secondary" onClick={handleJoinAsTv} disabled={busy !== null}>
          {busy === "tv" ? "Connecting…" : "Open big screen"}
        </Button>
      </Card>

      <footer className="mt-auto pt-8 text-center text-xs opacity-50">
        Each player needs their own phone and a book.
      </footer>
    </Page>
  );
}
