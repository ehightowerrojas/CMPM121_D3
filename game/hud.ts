import {
  type GameEvent,
  type GameState,
  type Item,
  type Material,
  type Resource,
  TERRAIN_RULES,
  terrainAt,
} from "../core/mod.ts";

const ITEM_LABELS: Record<Item, string> = {
  reedSkiff: "Reed Skiff",
  cairnPick: "Cairn Pick",
};

const MATERIAL_LABELS: Record<Material, string> = {
  reeds: "reeds",
  driftwood: "driftwood",
  stone: "stone",
};

function element(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function formatMissing(missing: Partial<Record<Material, number>>): string {
  const parts: string[] = [];
  for (const [mat, amount] of Object.entries(missing) as [Material, number][]) {
    if (amount && amount > 0) {
      parts.push(`${amount} ${MATERIAL_LABELS[mat]}`);
    }
  }
  return parts.join(", ");
}

function describe(event: GameEvent): string {
  switch (event.type) {
    case "moved":
      return `moved to ${event.to.x}, ${event.to.y}`;
    case "blocked": {
      const requiredItem = TERRAIN_RULES[event.terrain].requires;
      const requirement = requiredItem
        ? ` (need ${ITEM_LABELS[requiredItem]})`
        : "";
      return `blocked by ${event.terrain} at ${event.toward.x}, ${event.toward.y}${requirement}`;
    }
    case "gathered":
      return `gathered ${event.amount} ${event.resource} at ${event.cell.x}, ${event.cell.y}`;
    case "nothingToGather":
      return `nothing to gather at ${event.cell.x}, ${event.cell.y}`;
    case "crafted":
      return `crafted ${ITEM_LABELS[event.item]}`;
    case "cannotCraft":
      if (event.reason.kind === "alreadyOwned") {
        return `cannot craft ${ITEM_LABELS[event.item]}: already owned`;
      }
      return `cannot craft ${ITEM_LABELS[event.item]}: missing ${
        formatMissing(event.reason.missing)
      }`;
  }
}

export class Hud {
  private readonly seed: number;
  private readonly counts: Record<Resource, number>;

  constructor(state: GameState) {
    this.seed = state.seed;
    this.counts = { ...state.resources };
    this.showPosition(state.player.x, state.player.y);
    this.showResources();
  }

  show(event: GameEvent) {
    element("live").textContent = describe(event);
    if (event.type === "moved") {
      this.showPosition(event.to.x, event.to.y);
    } else if (event.type === "gathered") {
      this.counts[event.resource] += event.amount;
      this.showResources();
    } else if (event.type === "crafted") {
      for (
        const [mat, amount] of Object.entries(event.spent) as [
          Material,
          number,
        ][]
      ) {
        if (amount && amount > 0) {
          this.counts[mat] -= amount;
        }
      }
      this.showResources();
    }
  }

  private showPosition(x: number, y: number) {
    element("position").textContent = `${x}, ${y}`;
    element("terrain").textContent = terrainAt(this.seed, x, y);
  }

  private showResources() {
    element("reeds").textContent = String(this.counts.reeds);
    element("driftwood").textContent = String(this.counts.driftwood);
    element("stone").textContent = String(this.counts.stone);
  }
}
