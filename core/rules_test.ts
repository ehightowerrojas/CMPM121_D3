import { assertEquals } from "@std/assert";
import {
  apply,
  type GameState,
  isPassable,
  type Material,
  materialAt,
  newGame,
  terrainAt,
} from "./mod.ts";

// Each test has a Given-When-Then shape: https://martinfowler.com/bliki/GivenWhenThen.html
const SEED = 121;

// A state with the player just west of a cell that is, or is not, passable.
// Searching keeps these tests honest if the terrain formula changes.
function besideEasternCell(passable: boolean): GameState {
  for (let x = 2; x < 10_000; x++) {
    const here = isPassable(terrainAt(SEED, x, 0));
    const east = isPassable(terrainAt(SEED, x + 1, 0));
    if (here && east === passable) {
      const state = newGame(SEED);
      state.player = { x, y: 0 };
      return state;
    }
  }
  throw new Error("Found no suitable cell on this row.");
}

Deno.test("moving onto passable terrain moves the player", () => {
  const state = besideEasternCell(true);
  const { x, y } = state.player;

  const events = apply(state, { type: "move", direction: "east" });

  assertEquals(state.player, { x: x + 1, y });
  assertEquals(events, [{
    type: "moved",
    from: { x, y },
    to: { x: x + 1, y },
  }]);
});

Deno.test("a blocked move changes nothing and reports why", () => {
  const state = besideEasternCell(false);
  const snapshot = JSON.parse(JSON.stringify(state));
  const { x, y } = state.player;
  const target = { x: x + 1, y };

  const events = apply(state, { type: "move", direction: "east" });

  assertEquals(state, snapshot);
  assertEquals(events, [{
    type: "blocked",
    at: { x, y },
    toward: target,
    terrain: terrainAt(SEED, target.x, target.y),
  }]);
});

Deno.test("an event keeps its cells while state moves on", () => {
  const state = besideEasternCell(true);
  const { x, y } = state.player;

  const first = apply(state, { type: "move", direction: "east" });
  const second = apply(state, { type: "move", direction: "west" });
  apply(state, { type: "move", direction: "east" });

  // Both retained events still report the cells from when they happened, even
  // though state.player has since changed.
  assertEquals(first, [{
    type: "moved",
    from: { x, y },
    to: { x: x + 1, y },
  }]);
  assertEquals(second, [{
    type: "moved",
    from: { x: x + 1, y },
    to: { x, y },
  }]);
});

// A state with the player standing on a cell that gives the material.
function standingOn(material: Material): GameState {
  for (let x = 0; x < 10_000; x++) {
    if (
      isPassable(terrainAt(SEED, x, 0)) && materialAt(SEED, x, 0) === material
    ) {
      const state = newGame(SEED);
      state.player = { x, y: 0 };
      return state;
    }
  }
  throw new Error(`Found no ${material} to stand on in this row.`);
}

Deno.test("gathering adds one of the cell's material and marks the cell", () => {
  for (const material of ["reeds", "driftwood", "stone"] as const) {
    const state = standingOn(material);
    const { x, y } = state.player;

    const events = apply(state, { type: "gather" });

    assertEquals(events, [{ type: "gathered", at: { x, y }, material }]);
    assertEquals(state.inventory, {
      ...newGame(SEED).inventory,
      [material]: 1,
    });
    assertEquals(state.gathered, { [`${x},${y}`]: true });
  }
});

Deno.test("gathering a used-up cell changes nothing and says so", () => {
  const state = standingOn("reeds");
  const { x, y } = state.player;
  apply(state, { type: "gather" });
  const snapshot = JSON.parse(JSON.stringify(state));

  const events = apply(state, { type: "gather" });

  assertEquals(state, snapshot);
  assertEquals(events, [{ type: "nothingHere", at: { x, y } }]);
});
