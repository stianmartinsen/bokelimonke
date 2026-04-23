import { selectCurrentRound, useGameStore } from "../store/gameStore.ts";
import { Page, Spinner } from "./ui.tsx";
import { FakingPhase } from "./FakingPhase.tsx";
import { VotingPhase } from "./VotingPhase.tsx";
import { RevealPhase } from "./RevealPhase.tsx";

export function Playing() {
  const round = useGameStore(selectCurrentRound);

  if (!round) {
    return (
      <Page className="items-center justify-center">
        <Spinner />
      </Page>
    );
  }

  switch (round.phase) {
    case "faking":
      return <FakingPhase />;
    case "voting":
      return <VotingPhase />;
    case "reveal":
      return <RevealPhase />;
    default:
      return null;
  }
}
