import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { isPassable, materialAt, RECIPES, terrainAt } from "./mod.ts";

function sample(seed: number, originX = 0, originY = 0): string[] {
  const cells: string[] = [];
  for (let y = originY - 30; y < originY + 30; y++) {
    for (let x = originX - 30; x < originX + 30; x++) {
      cells.push(terrainAt(seed, x, y));
    }
  }
  return cells;
}

Deno.test("terrain depends only on seed and coordinates", () => {
  assertEquals(sample(121), sample(121));
  assertEquals(
    sample(121, 1_000_000, -1_000_000),
    sample(121, 1_000_000, -1_000_000),
  );
});

Deno.test("different seeds give different worlds", () => {
  assertNotEquals(sample(121), sample(122));
});

Deno.test("islands are separated by shallow water and skiffs open the route", () => {
  for (const seed of [1, 2, 3, 121, 2026]) {
    assertNotEquals(terrainAt(seed, 0, 0), "tideflat");
    assertEquals(isPassable(terrainAt(seed, 0, 0), {}), true);
    const channel = cellsAround(20).filter(({ x, y }) =>
      x >= 9 && x <= 18 && terrainAt(seed, x, y) === "tideflat"
    );
    assert(
      channel.length > 0,
      `expected a channel between islands for ${seed}`,
    );
    assertEquals(isPassable("tideflat", {}), false);
    assertEquals(isPassable("tideflat", { reedSkiff: 1 }), true);
    assertEquals(isPassable("cairnstone", {}), false);
    assertEquals(isPassable("cairnstone", { reedSkiff: 1 }), true);
    assert(
      cellsAround(40).some(({ x, y }) =>
        x >= 12 && x <= 40 && Math.abs(y) <= 14 &&
        terrainAt(seed, x, y) === "cairnstone"
      ),
      `expected a rocky island east of home for ${seed}`,
    );
  }
});

function cellsAround(radius: number): { x: number; y: number }[] {
  const cells = [];
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) cells.push({ x, y });
  }
  return cells;
}

Deno.test("the same seed and cell always give the same material", () => {
  for (const { x, y } of cellsAround(20)) {
    assertEquals(materialAt(121, x, y), materialAt(121, x, y));
  }
});

Deno.test("Tideflat gives nothing", () => {
  const tideflats = cellsAround(40).filter(({ x, y }) =>
    terrainAt(121, x, y) === "tideflat"
  );
  assert(tideflats.length > 0, "expected some Tideflat to check");
  for (const { x, y } of tideflats) assertEquals(materialAt(121, x, y), null);
});

Deno.test("neighboring islands provide enough hardwood for the raft", () => {
  const needed = RECIPES.sturdyRaft.hardwood;
  assert(needed !== undefined, "expected the raft to require hardwood");
  for (const seed of [1, 2, 3, 7, 121, 2026]) {
    const hardwood = cellsAround(40).filter(({ x, y }) =>
      x >= 12 && x <= 40 && Math.abs(y) <= 14 &&
      terrainAt(seed, x, y) === "hardwoodGrove"
    );
    assert(hardwood.length >= needed, `expected hardwood for seed ${seed}`);
  }
});

Deno.test("cairnstone forms small, separated clumps on outer islands", () => {
  const landSizes = new Set<number>();
  for (const seed of [1, 2, 3, 121, 2026]) {
    const clumps = cellsAround(40).filter(({ x, y }) =>
      x >= 12 && x <= 40 && Math.abs(y) <= 14 &&
      terrainAt(seed, x, y) === "cairnstone"
    );
    assert(clumps.length >= 3, `expected cairnstone clumps for ${seed}`);
    assert(clumps.length < 35, `cairnstone covered too much land for ${seed}`);
    assertNotEquals(materialAt(seed, 0, 0), "stone");

    const remaining = new Set(clumps.map(({ x, y }) => `${x},${y}`));
    let components = 0;
    while (remaining.size > 0) {
      components++;
      const [first] = remaining;
      remaining.delete(first);
      const frontier = [first.split(",").map(Number)];
      while (frontier.length > 0) {
        const [x, y] = frontier.pop()!;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const key = `${x + dx},${y + dy}`;
            if (remaining.delete(key)) {
              frontier.push([x + dx, y + dy]);
            }
          }
        }
      }
    }
    assert(components > 1, `expected separate cairnstone clumps for ${seed}`);

    landSizes.add(
      cellsAround(40).filter(({ x, y }) =>
        x >= 12 && x <= 40 && Math.abs(y) <= 14 &&
        terrainAt(seed, x, y) !== "tideflat"
      ).length,
    );
  }
  assert(landSizes.size > 1, "expected island size to vary by seed");
});
