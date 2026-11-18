import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { isPassable, materialAt, terrainAt } from "./mod.ts";

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

Deno.test("no seed starts walled in", () => {
  for (const seed of [1, 2, 3, 121, 2026]) {
    const seen = new Set(["0,0"]);
    const frontier = [{ x: 0, y: 0 }];
    while (frontier.length > 0 && seen.size < 2000) {
      const { x, y } = frontier.pop()!;
      for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const key = next.join();
        if (seen.has(key)) continue;
        if (!isPassable(terrainAt(seed, next[0], next[1]))) continue;
        seen.add(key);
        frontier.push({ x: next[0], y: next[1] });
      }
    }
    assert(seen.size >= 2000, `seed ${seed} stops at ${seen.size} cells`);
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

Deno.test("loose stones lie on some Saltgrass", () => {
  const found = cellsAround(20).some(({ x, y }) =>
    terrainAt(121, x, y) === "saltgrass" && materialAt(121, x, y) === "stone"
  );
  assert(found, "expected a stone on Saltgrass within 20 cells of the start");
});
