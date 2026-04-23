import type { ReactNode } from "react";
import { useGameStore } from "../../store/gameStore.ts";

interface TvFrameProps {
  children: ReactNode;
  footer?: ReactNode;
}

export function TvFrame({ children, footer }: TvFrameProps) {
  const room = useGameStore((s) => s.room);

  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col bg-cream text-ink">
      <header className="flex items-center justify-between px-12 pt-8">
        <span className="font-display text-3xl font-extrabold tracking-tight">Bokelimonke</span>
        {room ? (
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-xs font-semibold uppercase tracking-widest opacity-60">Room</span>
            <span className="font-mono text-3xl font-bold tracking-[0.3em]">{room.id}</span>
          </div>
        ) : null}
      </header>
      <main className="flex flex-1 flex-col gap-8 px-12 py-10">{children}</main>
      {footer ? (
        <footer className="px-12 pb-8 text-center text-lg opacity-60">{footer}</footer>
      ) : null}
    </div>
  );
}
