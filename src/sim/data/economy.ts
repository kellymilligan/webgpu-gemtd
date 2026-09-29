/**
 * Grade odds per odds level (percent for Chipped..Perfect). Buying odds is the
 * main use of gold.
 */
export const ODDS_TABLE: readonly (readonly number[])[] = [
  [100, 0, 0, 0, 0],
  [70, 30, 0, 0, 0],
  [50, 35, 15, 0, 0],
  [30, 40, 25, 5, 0],
  [15, 35, 35, 15, 0],
  [5, 25, 40, 25, 5],
  [0, 15, 40, 35, 10],
  [0, 5, 35, 40, 20],
  [0, 0, 25, 45, 30],
];

/** Cost to go from level i to i + 1. */
export const ODDS_COST: readonly number[] = [20, 40, 70, 110, 160, 220, 290, 370];

export const MAX_ODDS_LEVEL = ODDS_TABLE.length - 1;
export const STONE_REMOVE_COST = 10;
export const GEMS_PER_ROUND = 5;
