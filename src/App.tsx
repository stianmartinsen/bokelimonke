import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ensureSignedIn } from "./lib/supabase.ts";
import { Home } from "./routes/Home.tsx";
import { Room } from "./routes/Room.tsx";

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSignedIn()
      .then(() => setReady(true))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to sign in");
      });
  }, []);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Could not connect</h1>
          <p className="mt-2 text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="font-display text-xl">Loading…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/r/:code" element={<Room />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
