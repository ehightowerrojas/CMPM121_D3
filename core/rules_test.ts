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
        if (!isPassable(terrainAt(seed, x, y), {})) continue;
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
          if (
            curX !== x && isPassable(terrainAt(seed, curX + dx, curY), {})
          ) {
            curX += dx;
            steps.push(horiz);
          } else if (
            curY !== y && isPassable(terrainAt(seed, curX, curY + dy), {})
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
    while (x < 100 && isPassable(terrainAt(seed, x + 1, 0), {})) {
      apply(state, { type: "move", direction: "east" });
      x++;
    }
    const toward = { x: x + 1, y: 0 };
    const terrain = terrainAt(seed, toward.x, toward.y);
    if (!isPassable(terrain, {})) {
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

Deno.test("a crafted event keeps its costs while later crafting continues", () => {
  const state = newGame(1);
  state.resources = { reeds: 3, driftwood: 4, stone: 1 };
  const [crafted] = apply(state, { type: "craft", item: "reedSkiff" });

  apply(state, { type: "craft", item: "cairnPick" });

  assertEquals(crafted, {
    type: "crafted",
    item: "reedSkiff",
    spent: { reeds: 3, driftwood: 2 },
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

Deno.test("a skiff crosses shallow water to the stone island for a pick", () => {
  const state = newGame(121);
  state.resources = { reeds: 3, driftwood: 4, stone: 0 };

  assertEquals(cannotCraftReason(state, "reedSkiff"), null);
  assertEquals(cannotCraftReason(state, "cairnPick"), {
    kind: "missing",
    missing: { stone: 1 },
  });

  let blocked = false;
  for (let steps = 0; steps < 40; steps++) {
    const [event] = apply(state, { type: "move", direction: "east" });
    if (event.type === "blocked") {
      assertEquals(event.terrain, "tideflat");
      blocked = true;
      break;
    }
  }
  assertEquals(blocked, true);

  apply(state, { type: "craft", item: "reedSkiff" });
  assertEquals(isPassable("tideflat", state.items), true);
  const route = pathToCairnstone(state);
  for (const direction of route) {
    const [event] = apply(state, { type: "move", direction });
    assertEquals(event.type, "moved");
  }
  assertEquals(
    terrainAt(state.seed, state.player.x, state.player.y),
    "cairnstone",
  );

  const [gathered] = apply(state, { type: "gather" });
  assertEquals(gathered.type, "gathered");
  assertEquals(state.resources.stone, 1);
  assertEquals(cannotCraftReason(state, "cairnPick"), null);

  const [crafted] = apply(state, { type: "craft", item: "cairnPick" });
  assertEquals(crafted.type, "crafted");
  assertEquals(state.items.cairnPick, 1);
});

function pathToCairnstone(state: GameState): Direction[] {
  const steps: Record<Direction, { x: number; y: number }> = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
  };
  const queue: {
    x: number;
    y: number;
    route: Direction[];
  }[] = [{ ...state.player, route: [] }];
  const visited = new Set([`${state.player.x},${state.player.y}`]);

  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (terrainAt(state.seed, cell.x, cell.y) === "cairnstone") {
      return cell.route;
    }

    for (const direction of Object.keys(steps) as Direction[]) {
      const step = steps[direction];
      const x = cell.x + step.x;
      const y = cell.y + step.y;
      const key = `${x},${y}`;
      if (visited.has(key) || Math.abs(x) > 60 || Math.abs(y) > 60) continue;
      if (!isPassable(terrainAt(state.seed, x, y), state.items)) continue;
      visited.add(key);
      queue.push({ x, y, route: [...cell.route, direction] });
    }
  }

  throw new Error("Could not find a skiff route to cairnstone");
}

Deno.test("the starting island has skiff materials but no stone", () => {
  const neededForSkiff = Object.keys(RECIPES.reedSkiff);
  for (let seed = 1; seed <= 50; seed++) {
    const available = new Set<Material>();
    for (let y = -12; y <= 12; y++) {
      for (let x = -12; x <= 12; x++) {
        const terrain = terrainAt(seed, x, y);
        if (!isPassable(terrain, {})) continue;
        const material = materialAt(seed, x, y);
        if (material) available.add(material);
      }
    }

    for (const material of neededForSkiff) {
      assertEquals(
        available.has(material as Material),
        true,
        `Expected '${material}' on the starting island for seed ${seed}`,
      );
    }
    assertEquals(
      available.has("stone"),
      false,
      `Expected no stone on the starting island for seed ${seed}`,
    );
  }
});
