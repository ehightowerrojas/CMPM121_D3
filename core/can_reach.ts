import { RECIPES } from "./rules.ts";
import { TERRAIN_RULES } from "./terrain.ts";

type RecipeTable = Record<string, Partial<Record<string, number>>>;

export function unreachableRecipes(
  recipes: RecipeTable = RECIPES,
): string[] {
  const reached = new Set<string>();
  const made = new Set<string>();

  for (const terrain of Object.values(TERRAIN_RULES)) {
    if (!terrain.requires && terrain.yields) reached.add(terrain.yields);
  }

  let changed: boolean;
  do {
    changed = false;
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
      for (const terrain of Object.values(TERRAIN_RULES)) {
        if (terrain.requires === output && terrain.yields) {
          reached.add(terrain.yields);
        }
      }
    }
  } while (changed);

  return Object.keys(recipes).filter((recipe) => !made.has(recipe));
}
