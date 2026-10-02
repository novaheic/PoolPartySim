import { spotPrice } from '../amm';
import { POOL_DEFS, type Pool, type PoolId, type TokenId } from '../types';

export interface ArbHint {
  token: TokenId;
  buyPoolId: PoolId;
  sellPoolId: PoolId;
  buyLabel: string;
  sellLabel: string;
  edgePct: number;
  summary: string;
  route: string;
}

/**
 * Detect when WOOD priced in GOLD differs between the direct pool and the
 * WOOD→STONE→GOLD path (classic triangular arb teaching case).
 */
export function detectArbitrage(
  pools: Record<PoolId, Pool>,
  minEdgePct = 0.5,
): ArbHint[] {
  const hints: ArbHint[] = [];
  const woodGold = pools.WOOD_GOLD;
  const woodStone = pools.WOOD_STONE;
  const stoneGold = pools.STONE_GOLD;

  const direct = spotPrice(woodGold.reserveA, woodGold.reserveB);
  const viaStone =
    spotPrice(woodStone.reserveA, woodStone.reserveB) *
    spotPrice(stoneGold.reserveA, stoneGold.reserveB);

  if (direct > 0 && viaStone > 0) {
    const edge = Math.abs(direct - viaStone) / Math.min(direct, viaStone);
    if (edge * 100 >= minEdgePct) {
      if (direct < viaStone) {
        hints.push({
          token: 'WOOD',
          buyPoolId: 'WOOD_GOLD',
          sellPoolId: 'WOOD_STONE',
          buyLabel: POOL_DEFS.WOOD_GOLD.label,
          sellLabel: `${POOL_DEFS.WOOD_STONE.label} → ${POOL_DEFS.STONE_GOLD.label}`,
          edgePct: edge * 100,
          summary: `WOOD is cheaper on ${POOL_DEFS.WOOD_GOLD.label}. Buy there, sell via the STONE path.`,
          route:
            'Buy WOOD on WOOD/GOLD (spend GOLD), sell WOOD for STONE, sell STONE for GOLD.',
        });
      } else {
        hints.push({
          token: 'WOOD',
          buyPoolId: 'WOOD_STONE',
          sellPoolId: 'WOOD_GOLD',
          buyLabel: `${POOL_DEFS.WOOD_STONE.label} → ${POOL_DEFS.STONE_GOLD.label}`,
          sellLabel: POOL_DEFS.WOOD_GOLD.label,
          edgePct: edge * 100,
          summary: `WOOD is cheaper via the STONE path. Buy via STONE, sell on WOOD/GOLD.`,
          route:
            'Buy STONE with GOLD, buy WOOD with STONE, sell WOOD for GOLD on WOOD/GOLD.',
        });
      }
    }
  }

  return hints;
}
