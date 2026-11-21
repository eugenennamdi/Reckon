import { getChainReader } from "@/lib/reckon/chain";
import { currentEpochId } from "@/lib/reckon/commitment";
import { isDeployedAddress } from "@/lib/reckon/constants";
import { RoundsTerminal } from "@/components/RoundsTerminal";

export const revalidate = 15;

export default async function HomePage() {
  const chain = getChainReader();
  const nowSec = Math.floor(Date.now() / 1000);
  const currEpoch = currentEpochId(nowSec);
  const coreAddress = chain.getCoreAddress();
  const registryAddress = chain.getRegistryAddress();

  const [prices, rounds] = await Promise.all([
    chain.getLivePrices().catch(() => []),
    chain
      .getCanonicalRounds({
        epochIds: [currEpoch, currEpoch - 1, currEpoch - 2, currEpoch - 3],
      })
      .catch(() => []),
  ]);

  return (
    <RoundsTerminal
      initialData={{
        serverTime: nowSec,
        currentEpochId: currEpoch,
        anchorEpochId: currEpoch,
        coreAddress,
        registryAddress,
        deployed: isDeployedAddress(coreAddress),
        prices,
        rounds,
        pendingRounds: [],
      }}
    />
  );
}
