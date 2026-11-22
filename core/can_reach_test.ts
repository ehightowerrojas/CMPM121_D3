import { assertEquals } from "@std/assert";
import { unreachableRecipes } from "./mod.ts";
import { RECIPES } from "./rules.ts";

Deno.test("the real recipe table can reach every recipe through the skiff", () => {
  assertEquals(unreachableRecipes(RECIPES), []);
  assertEquals(
    unreachableRecipes({
      cairnPick: RECIPES.cairnPick,
      reedSkiff: RECIPES.reedSkiff,
    }),
    [],
  );
});

Deno.test("a recipe that needs its own output cannot be reached", () => {
  const recipes = {
    reedSkiff: { reeds: 3, driftwood: 2, reedSkiff: 1 },
    cairnPick: { driftwood: 2, stone: 1 },
  };

  assertEquals(unreachableRecipes(recipes), ["reedSkiff", "cairnPick"]);
});
