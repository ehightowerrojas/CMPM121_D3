// The world is a pure function of a seed and coordinates. Nothing here is stored,
// so the world can be effectively unbounded while saved state stays small.

export type Terrain =
  | "saltgrass"
  | "bramblewood"
  | "tideflat"
  | "cairnstone"
  | "hardwoodGrove";

export type Material = "reeds" | "driftwood" | "stone" | "hardwood";

export type Item = "reedSkiff" | "stoneAxe" | "sturdyRaft";

export type TerrainRule = {
  yields: Material | null;
  requires?: Item;
  gatherRequires?: Item;
};

export const TERRAIN_RULES: Record<Terrain, TerrainRule> = {
  saltgrass: { yields: "reeds" },
  bramblewood: { yields: "driftwood" },
  tideflat: { yields: null, requires: "reedSkiff" },
  cairnstone: { yields: "stone", requires: "reedSkiff" },
  hardwoodGrove: {
    yields: "hardwood",
    requires: "reedSkiff",
    gatherRequires: "stoneAxe",
  },
};

const ISLAND_SPACING = 25;
const ISLAND_JITTER = 3.5;
const HOME_ISLAND_RADIUS = 8.5;

type Island = { x: number; y: number; gridX: number; gridY: number };

// Each terrain row says what can be gathered there and what opens access.
export function materialAt(
  seed: number,
  x: number,
  y: number,
): Material | null {
  return TERRAIN_RULES[terrainAt(seed, x, y)].yields;
}

export function terrainAt(seed: number, x: number, y: number): Terrain {
  const island = nearestIsland(seed, x, y);
  const { gridX, gridY } = island;
  const offsetX = x - island.x;
  const offsetY = y - island.y;
  const home = gridX === 0 && gridY === 0;
  const radius = home
    ? HOME_ISLAND_RADIUS
    : 5 + gridValue(seed + 4, gridX, gridY);
  const shoreline = (noise(seed + 5, x, y, 4) - 0.5) * 3.2 +
    (noise(seed + 6, x, y, 1.7) - 0.5) * 1.4;
  const angle = gridValue(seed + 7, gridX, gridY) * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedX = offsetX * cos - offsetY * sin;
  const rotatedY = offsetX * sin + offsetY * cos;
  const stretchX = 0.82 + gridValue(seed + 8, gridX, gridY) * 0.36;
  const stretchY = 0.82 + gridValue(seed + 9, gridX, gridY) * 0.36;
  const distance = Math.hypot(rotatedX / stretchX, rotatedY / stretchY);
  if (distance > radius + shoreline) return "tideflat";

  if (home && offsetX <= -2 && Math.abs(offsetY) <= 2) return "saltgrass";
  if (home && offsetX >= 2 && Math.abs(offsetY) <= 2) return "bramblewood";

  if (!home && inCairnClump(seed, gridX, gridY, x, y)) return "cairnstone";
  if (!home && offsetX ** 2 + offsetY ** 2 <= 6.25) return "hardwoodGrove";
  return noise(seed + 2, x, y, 5) < 0.45 ? "bramblewood" : "saltgrass";
}

function nearestIsland(seed: number, x: number, y: number): Island {
  const gridX = Math.round(x / ISLAND_SPACING);
  const gridY = Math.round(y / ISLAND_SPACING);
  let nearest: Island | null = null;
  let nearestDistance = Infinity;

  for (let candidateY = gridY - 1; candidateY <= gridY + 1; candidateY++) {
    for (let candidateX = gridX - 1; candidateX <= gridX + 1; candidateX++) {
      const island = islandAt(seed, candidateX, candidateY);
      const distance = (x - island.x) ** 2 + (y - island.y) ** 2;
      if (distance < nearestDistance) {
        nearest = island;
        nearestDistance = distance;
      }
    }
  }

  return nearest!;
}

function islandAt(seed: number, gridX: number, gridY: number): Island {
  if (gridX === 0 && gridY === 0) return { x: 0, y: 0, gridX, gridY };
  return {
    x: gridX * ISLAND_SPACING +
      (gridValue(seed + 10, gridX, gridY) * 2 - 1) * ISLAND_JITTER,
    y: gridY * ISLAND_SPACING +
      (gridValue(seed + 11, gridX, gridY) * 2 - 1) * ISLAND_JITTER,
    gridX,
    gridY,
  };
}

function inCairnClump(
  seed: number,
  islandX: number,
  islandY: number,
  x: number,
  y: number,
): boolean {
  const island = islandAt(seed, islandX, islandY);
  const rotation = gridValue(seed + 12, islandX, islandY) * Math.PI * 2;
  for (let index = 0; index < 3; index++) {
    const angle = rotation + index * Math.PI * 2 / 3;
    const distance = 2.7 + gridValue(seed + 13 + index, islandX, islandY) * 0.7;
    const clumpX = Math.round(island.x + Math.cos(angle) * distance);
    const clumpY = Math.round(island.y + Math.sin(angle) * distance);
    const radius = 0.9 + gridValue(seed + 16 + index, islandX, islandY) * 0.55;
    const roughness = (noise(seed + 19 + index, x, y, 1.2) - 0.5) * 0.35;

    if (x === clumpX && y === clumpY) return true;
    if (Math.hypot(x - clumpX, y - clumpY) <= radius + roughness) return true;
  }
  return false;
}

export function isPassable(
  terrain: Terrain,
  items: Partial<Record<Item, number>>,
): boolean {
  const requiredItem = TERRAIN_RULES[terrain].requires;
  return requiredItem === undefined || (items[requiredItem] ?? 0) > 0;
}

function noise(seed: number, x: number, y: number, scale: number): number {
  const left = Math.floor(x / scale);
  const top = Math.floor(y / scale);
  const blendX = smooth(x / scale - left);
  const blendY = smooth(y / scale - top);
  return mix(
    mix(gridValue(seed, left, top), gridValue(seed, left + 1, top), blendX),
    mix(
      gridValue(seed, left, top + 1),
      gridValue(seed, left + 1, top + 1),
      blendX,
    ),
    blendY,
  );
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// A hash, not a generator: the same inputs give the same number in [0, 1), with
// no memory of earlier calls.
function gridValue(seed: number, x: number, y: number): number {
  let hash = Math.imul(seed, 0x9e3779b1) ^ Math.imul(x, 0x85ebca6b) ^
    Math.imul(y, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
  return ((hash ^ (hash >>> 15)) >>> 0) / 2 ** 32;
}
