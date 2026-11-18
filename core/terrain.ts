// The world is a pure function of a seed and coordinates. Nothing here is stored,
// so the world can be effectively unbounded while saved state stays small.

export type Terrain = "saltgrass" | "bramblewood" | "tideflat" | "cairnstone";

export function terrainAt(seed: number, x: number, y: number): Terrain {
  const raw = 0.65 * noise(seed, x, y, 9) + 0.35 * noise(seed + 1, x, y, 3);
  // Every game starts at the origin, so flatten the land there. Otherwise some
  // seeds would start cut off by tideflat or walled into a pocket of cairnstone.
  const height = 0.5 + (raw - 0.5) * Math.min(1, Math.hypot(x, y) / 10);
  if (height < 0.3) return "tideflat";
  if (height > 0.7) return "cairnstone";
  return noise(seed + 2, x, y, 6) < 0.45 ? "bramblewood" : "saltgrass";
}

export function isPassable(terrain: Terrain): boolean {
  return terrain !== "tideflat" && terrain !== "cairnstone";
}

export type Material = "reeds" | "driftwood" | "stone";

// About one Saltgrass cell in ten holds a loose stone instead of reeds.
const looseStoneChance = 0.1;

// What a cell yields when gathered. Like terrain, this is computed, not stored:
// the rules record only which cells are used up. Cairnstone always answers
// stone here, and the rules decide whether the player can get at it.
export function materialAt(
  seed: number,
  x: number,
  y: number,
): Material | null {
  switch (terrainAt(seed, x, y)) {
    case "saltgrass":
      // A per-cell hash rather than noise, so stones scatter instead of clumping.
      return gridValue(seed + 3, x, y) < looseStoneChance ? "stone" : "reeds";
    case "bramblewood":
      return "driftwood";
    case "cairnstone":
      return "stone";
    case "tideflat":
      return null;
  }
}

// Value noise: random numbers at coarse grid points, blended between them, so
// that terrain forms regions instead of static.
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
