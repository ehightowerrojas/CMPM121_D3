import {
  type GameEvent,
  type GameState,
  type Resource,
  terrainAt,
} from "../core/mod.ts";

function element(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function describe(event: GameEvent): string {
  switch (event.type) {
    case "moved":
      return `moved to ${event.to.x}, ${event.to.y}`;
    case "blocked":
      return `blocked by ${event.terrain} at ${event.toward.x}, ${event.toward.y}`;
    case "gathered":
      return `gathered ${event.amount} ${event.resource} at ${event.cell.x}, ${event.cell.y}`;
    case "nothingToGather":
      return `nothing to gather at ${event.cell.x}, ${event.cell.y}`;
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
