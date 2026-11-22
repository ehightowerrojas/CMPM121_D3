import { assertEquals, fail } from "@std/assert";
import {
  apply,
  cannotCraftReason,
  type Direction,
  type GameState,
  isPassable,
  type Material,
  materialAt,
  newGame,
  RECIPES,
  terrainAt,
} from "./mod.ts";

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function standingOn(
  seed: number,
  predicate: (material: Material | null, x: number, y: number) => boolean,
): { state: GameState; x: number; y: number } {
  for (let radius = 1; radius <= 25; radius++) {
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x === 0 && y === 0) continue;
        if (!isPassable(terrainAt(seed, x, y))) continue;
        if (!predicate(materialAt(seed, x, y), x, y)) continue;

        const state = newGame(seed);
        const steps: Direction[] = [];
        const dx = Math.sign(x);
        const dy = Math.sign(y);
        const horiz: Direction = dx > 0 ? "east" : "west";
        const vert: Direction = dy > 0 ? "south" : "north";

        let curX = 0;
        let curY = 0;
        while (curX !== x || curY !== y) {
          if (curX !== x && isPassable(terrainAt(seed, curX + dx, curY))) {
            curX += dx;
            steps.push(horiz);
          } else if (
            curY !== y && isPassable(terrainAt(seed, curX, curY + dy))
          ) {
            curY += dy;
            steps.push(vert);
          } else {
            break;
          }
        }

        if (curX === x && curY === y) {
          for (const direction of steps) {
            apply(state, { type: "move", direction });
          }
          return { state, x, y };
        }
      }
    }
  }
  throw new Error("Could not find a reachable cell matching predicate");
}

Deno.test("moving onto passable terrain moves the player", () => {
  const state = newGame(1);
  const events = apply(state, { type: "move", direction: "east" });
  assertEquals(state.player, { x: 1, y: 0 });
  assertEquals(events, [{
    type: "moved",
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
  }]);
});

Deno.test("a blocked move changes nothing and reports why", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const state = newGame(seed);
    let x = 0;
    while (x < 100 && isPassable(terrainAt(seed, x + 1, 0))) {
      apply(state, { type: "move", direction: "east" });
      x++;
    }
    const toward = { x: x + 1, y: 0 };
    const terrain = terrainAt(seed, toward.x, toward.y);
    if (!isPassable(terrain)) {
      const before = cloneState(state);
      const events = apply(state, { type: "move", direction: "east" });
      assertEquals(state, before);
      assertEquals(events, [{
        type: "blocked",
        at: { x, y: 0 },
        toward,
        terrain,
      }]);
      return;
    }
  }
  fail(
    "Expected to find a blocked cell within 100 steps for at least one seed",
  );
});

Deno.test("an event keeps its cells while state moves on", () => {
  const state = newGame(1);
  const [moved] = apply(state, { type: "move", direction: "east" });
  apply(state, { type: "move", direction: "east" });
  assertEquals(moved, {
    type: "moved",
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
  });
});

Deno.test("gathering a material cell adds to resources and marks cell gathered", () => {
  const { state, x, y } = standingOn(1, (mat) => mat !== null);
  const expectedResource = materialAt(1, x, y)!;

  const events = apply(state, { type: "gather" });

  assertEquals(events, [{
    type: "gathered",
    cell: { x, y },
    resource: expectedResource,
    amount: 1,
  }]);
  assertEquals(state.resources[expectedResource], 1);
  assertEquals(state.gatheredCells.includes(`${x},${y}`), true);
});

Deno.test("gathering an already-gathered cell returns nothingToGather", () => {
  const { state, x, y } = standingOn(1, (mat) => mat !== null);
  const expectedResource = materialAt(1, x, y)!;

  apply(state, { type: "gather" });
  const before = cloneState(state);
  const secondEvents = apply(state, { type: "gather" });

  assertEquals(secondEvents, [{
    type: "nothingToGather",
    cell: { x, y },
  }]);
  assertEquals(state, before);
  assertEquals(state.resources[expectedResource], 1);
});

Deno.test("crafting with enough resources deducts costs and adds item", () => {
  const state = newGame(1);
  state.resources = { reeds: 5, driftwood: 3, stone: 1 };

  const events = apply(state, { type: "craft", item: "reedSkiff" });

  assertEquals(events, [{
    type: "crafted",
    item: "reedSkiff",
    spent: { reeds: 3, driftwood: 2 },
  }]);
  assertEquals(state.resources, { reeds: 2, driftwood: 1, stone: 1 });
  assertEquals(state.items.reedSkiff, 1);
  assertEquals(state.items.cairnPick, 0);
});

Deno.test("crafting while short changes nothing and reports missing materials", () => {
  const state = newGame(1);
  state.resources = { reeds: 1, driftwood: 2, stone: 0 };
  const before = cloneState(state);

  const events = apply(state, { type: "craft", item: "reedSkiff" });

  assertEquals(state, before);
  assertEquals(events, [{
    type: "cannotCraft",
    item: "reedSkiff",
    reason: { kind: "missing", missing: { reeds: 2 } },
  }]);
});

Deno.test("crafting query reports readiness and ownership for both recipes", () => {
  const state = newGame(1);

  assertEquals(cannotCraftReason(state, "reedSkiff"), {
    kind: "missing",
    missing: { reeds: 3, driftwood: 2 },
  });
  assertEquals(cannotCraftReason(state, "cairnPick"), {
    kind: "missing",
    missing: { driftwood: 2, stone: 1 },
  });

  state.resources = { reeds: 3, driftwood: 2, stone: 1 };
  assertEquals(cannotCraftReason(state, "reedSkiff"), null);
  assertEquals(cannotCraftReason(state, "cairnPick"), null);

  state.items.reedSkiff = 1;
  assertEquals(cannotCraftReason(state, "reedSkiff"), {
    kind: "alreadyOwned",
  });
});

Deno.test("crafting a second pick returns alreadyOwned and changes nothing", () => {
  const state = newGame(1);
  state.resources = { reeds: 0, driftwood: 4, stone: 2 };

  const firstEvents = apply(state, { type: "craft", item: "cairnPick" });
  assertEquals(firstEvents, [{
    type: "crafted",
    item: "cairnPick",
    spent: { driftwood: 2, stone: 1 },
  }]);
  assertEquals(state.items.cairnPick, 1);

  const beforeSecond = cloneState(state);
  const secondEvents = apply(state, { type: "craft", item: "cairnPick" });

  assertEquals(state, beforeSecond);
  assertEquals(secondEvents, [{
    type: "cannotCraft",
    item: "cairnPick",
    reason: { kind: "alreadyOwned" },
  }]);
});

Deno.test("every recipe material appears on passable ground near the start of every seed", () => {
  const neededMaterials = new Set<Material>();
  for (
    const recipe of Object.values(RECIPES) as Partial<
      Record<Material, number>
    >[]
  ) {
    for (
      const [mat, amount] of Object.entries(recipe) as [Material, number][]
    ) {
      if (amount && amount > 0) neededMaterials.add(mat);
    }
  }

  for (const mat of neededMaterials) {
    for (let seed = 1; seed <= 20; seed++) {
      let found = false;
      for (let y = -15; y <= 15 && !found; y++) {
        for (let x = -15; x <= 15; x++) {
          if (!isPassable(terrainAt(seed, x, y))) continue;
          if (materialAt(seed, x, y) === mat) {
            found = true;
            break;
          }
        }
      }
      assertEquals(
        found,
        true,
        `Expected passable '${mat}' near origin for seed ${seed}`,
      );
    }
  }
});
