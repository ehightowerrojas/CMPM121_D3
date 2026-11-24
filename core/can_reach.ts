import { RECIPES } from "./rules.ts";
import { TERRAIN_RULES } from "./terrain.ts";

type RecipeTable = Record<string, Partial<Record<string, number>>>;

export function unreachableRecipes(
  recipes: RecipeTable = RECIPES,
): string[] {
  const reached = new Set<string>();
  const made = new Set<string>();

  let changed: boolean;
  do {
    changed = false;
    for (const terrain of Object.values(TERRAIN_RULES)) {
      if (
        terrain.yields && !reached.has(terrain.yields) &&
        (!terrain.requires || reached.has(terrain.requires)) &&
        (!terrain.gatherRequires || reached.has(terrain.gatherRequires))
      ) {
        reached.add(terrain.yields);
        changed = true;
      }
    }
    for (const [output, inputs] of Object.entries(recipes)) {
      if (made.has(output)) continue;
      const ingredients = Object.entries(inputs)
        .filter(([, amount]) => amount !== undefined && amount > 0)
        .map(([ingredient]) => ingredient);
      if (!ingredients.every((ingredient) => reached.has(ingredient))) {
        continue;
      }

      made.add(output);
      reached.add(output);
      changed = true;
    }
  } while (changed);

  return Object.keys(recipes).filter((recipe) => !made.has(recipe));
}
