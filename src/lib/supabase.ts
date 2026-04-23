import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env.local.");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "bokelimonke-auth",
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

let cachedUserId: string | null = null;
let signInPromise: Promise<string> | null = null;

export function ensureSignedIn(): Promise<string> {
  if (!signInPromise) {
    signInPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id) {
        cachedUserId = data.session.user.id;
        return cachedUserId;
      }
      const { data: anon, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (!anon.user?.id) throw new Error("Anonymous sign-in returned no user");
      cachedUserId = anon.user.id;
      return cachedUserId;
    })();
  }
  return signInPromise;
}

export function getCurrentUserId(): string | null {
  return cachedUserId;
}
