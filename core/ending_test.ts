import { assert, assertEquals } from "@std/assert";
import {
  apply,
  CAPSTONE,
  type Command,
  newGame,
  RECIPES,
  terrainAt,
} from "./mod.ts";

Deno.test("hardwood requires a reusable stone axe and can only be gathered once", () => {
  const state = newGame(121);
  let cell: { x: number; y: number } | undefined;
  for (let y = -40; y <= 40 && !cell; y++) {
    for (let x = -40; x <= 40; x++) {
      if (terrainAt(state.seed, x, y) === "hardwoodGrove") {
        cell = { x, y };
        break;
      }
    }
  }
  assert(cell, "expected hardwood on an outer island");
  state.player = cell;
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(apply(state, { type: "gather" }), [{
    type: "cannotGather",
    cell: { ...cell },
    required: "stoneAxe",
  }]);
  assertEquals(state, before);

  state.items.stoneAxe = 1;
  assertEquals(apply(state, { type: "gather" }), [{
    type: "gathered",
    cell: { ...cell },
    resource: "hardwood",
    amount: 1,
  }]);
  assertEquals(state.items.stoneAxe, 1);
  assertEquals(state.resources.hardwood, 1);
  assertEquals(apply(state, { type: "gather" }), [{
    type: "nothingToGather",
    cell: { ...cell },
  }]);
});

Deno.test("crafting the sturdy raft ends the game and freezes every command", () => {
  const state = newGame(121);
  state.resources = {
    reeds: RECIPES.sturdyRaft.reeds!,
    driftwood: RECIPES.sturdyRaft.driftwood!,
    stone: 0,
    hardwood: RECIPES.sturdyRaft.hardwood!,
  };
  assertEquals(apply(state, { type: "craft", item: CAPSTONE }), [{
    type: "crafted",
    item: CAPSTONE,
    spent: RECIPES.sturdyRaft,
  }, { type: "ended" }]);
  assertEquals(state.ended, true);
  assertEquals(state.items.sturdyRaft, 1);
  const before = JSON.parse(JSON.stringify(state));
  const commands: Command[] = [
    { type: "move", direction: "north" },
    { type: "move", direction: "south" },
    { type: "move", direction: "east" },
    { type: "move", direction: "west" },
    { type: "gather" },
    { type: "craft", item: "reedSkiff" },
    { type: "craft", item: "stoneAxe" },
    { type: "craft", item: "sturdyRaft" },
  ];
  for (const command of commands) {
    assertEquals(apply(state, command), []);
    assertEquals(state, before);
  }
});

Deno.test("missing raft ingredients do not end the game", () => {
  const state = newGame(121);
  const before = JSON.parse(JSON.stringify(state));
  const [event] = apply(state, { type: "craft", item: CAPSTONE });
  assertEquals(event.type, "cannotCraft");
  assertEquals(state, before);
});
