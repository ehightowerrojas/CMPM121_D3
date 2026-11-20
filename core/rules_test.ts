import { assertEquals } from "@std/assert";
import {
  apply,
  type Direction,
  type GameState,
  isPassable,
  type Material,
  materialAt,
  newGame,
  terrainAt,
} from "./mod.ts";

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
    for (const direction of ["north", "south", "east", "west"] as const) {
      const step = {
        north: { x: 0, y: -1 },
        south: { x: 0, y: 1 },
        east: { x: 1, y: 0 },
        west: { x: -1, y: 0 },
      }[direction];
      const terrain = terrainAt(seed, step.x, step.y);
      if (!isPassable(terrain)) {
        const state = newGame(seed);
        const events = apply(state, { type: "move", direction });
        assertEquals(state.player, { x: 0, y: 0 });
        assertEquals(events, [{
          type: "blocked",
          at: { x: 0, y: 0 },
          toward: step,
          terrain,
        }]);
        return;
      }
    }
  }
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
  const secondEvents = apply(state, { type: "gather" });

  assertEquals(secondEvents, [{
    type: "nothingToGather",
    cell: { x, y },
  }]);
  assertEquals(state.resources[expectedResource], 1);
  assertEquals(state.gatheredCells.length, 1);
});
