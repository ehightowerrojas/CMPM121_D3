import {
  cannotCraftReason,
  type GameState,
  type Item,
  type Material,
  RECIPES,
} from "../core/mod.ts";

const ITEM_LABELS: Record<Item, string> = {
  reedSkiff: "Reed Skiff",
  stoneAxe: "Stone Axe",
  sturdyRaft: "Sturdy Raft",
};

const MATERIAL_LABELS: Record<Material, string> = {
  reeds: "reeds",
  driftwood: "driftwood",
  stone: "stone",
  hardwood: "hardwood",
};

function formatAmounts(amounts: Partial<Record<Material, number>>): string {
  return (Object.entries(amounts) as [Material, number][])
    .map(([material, amount]) => `${amount} ${MATERIAL_LABELS[material]}`)
    .join(", ");
}

export class RecipeBook {
  private readonly state: GameState;
  private readonly onCraft: (item: Item) => void;
  private readonly buttons: { item: Item; element: HTMLButtonElement }[] = [];

  constructor(
    list: HTMLElement,
    state: GameState,
    onCraft: (item: Item) => void,
  ) {
    this.state = state;
    this.onCraft = onCraft;

    for (const item of Object.keys(RECIPES) as Item[]) {
      const entry = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", (event) => {
        this.onCraft(item);
        if (event.detail > 0) button.blur();
      });
      entry.append(button);
      list.append(entry);
      this.buttons.push({ item, element: button });
    }
  }

  update() {
    for (const { item, element } of this.buttons) {
      const recipe = RECIPES[item];
      const ingredients = formatAmounts(recipe);
      const reason = cannotCraftReason(this.state, item);
      const status = reason === null
        ? "Ready"
        : reason.kind === "alreadyOwned"
        ? "Already owned"
        : reason.kind === "gameEnded"
        ? "Game complete"
        : `Missing ${formatAmounts(reason.missing)}`;
      element.textContent = `Craft ${
        ITEM_LABELS[item]
      } (${ingredients}) - ${status}`;
    }
  }
}
