import { assertEquals } from "@std/assert";
import { unreachableRecipes } from "./mod.ts";
import { RECIPES } from "./rules.ts";

Deno.test("the real recipe table can reach every recipe through the skiff", () => {
  assertEquals(unreachableRecipes(RECIPES), []);
  assertEquals(
    unreachableRecipes({
      sturdyRaft: RECIPES.sturdyRaft,
      stoneAxe: RECIPES.stoneAxe,
      reedSkiff: RECIPES.reedSkiff,
    }),
    [],
  );
});

Deno.test("a recipe that needs its own output cannot be reached", () => {
  const recipes = {
    reedSkiff: { reeds: 3, driftwood: 2, reedSkiff: 1 },
    stoneAxe: { driftwood: 2, stone: 1 },
    sturdyRaft: { hardwood: 3 },
  };

  assertEquals(unreachableRecipes(recipes), [
    "reedSkiff",
    "stoneAxe",
    "sturdyRaft",
  ]);
});

Deno.test("the raft is unreachable without the axe or its ingredients", () => {
  assertEquals(
    unreachableRecipes({
      reedSkiff: RECIPES.reedSkiff,
      sturdyRaft: RECIPES.sturdyRaft,
    }),
    ["sturdyRaft"],
  );
  assertEquals(
    unreachableRecipes({
      reedSkiff: RECIPES.reedSkiff,
      stoneAxe: RECIPES.stoneAxe,
      sturdyRaft: { ...RECIPES.sturdyRaft, unknownMaterial: 1 },
    }),
    ["sturdyRaft"],
  );
});
