// The rules of the game. There is no clock here: a command updates the state at
// once, and the events it returns are a record of what happened. Whoever called
// apply() decides how, or whether, to show them over time.

import {
  isPassable,
  type Material,
  materialAt,
  type Terrain,
  terrainAt,
} from "./terrain.ts";

export type { Material };

export type Resource = Material;

export type Item = "reedSkiff" | "cairnPick";

export type Cell = { x: number; y: number };

export type Direction = "north" | "south" | "east" | "west";

export type GameState = {
  seed: number;
  player: Cell;
  resources: Record<Material, number>;
  gatheredCells: string[];
  items: Record<Item, number>;
};

export type Command =
  | { type: "move"; direction: Direction }
  | { type: "gather" }
  | { type: "craft"; item: Item };

export type CannotCraftReason =
  | { kind: "alreadyOwned" }
  | { kind: "missing"; missing: Partial<Record<Material, number>> };

export type GameEvent =
  | { type: "moved"; from: Cell; to: Cell }
  | { type: "blocked"; at: Cell; toward: Cell; terrain: Terrain }
  | { type: "gathered"; cell: Cell; resource: Material; amount: number }
  | { type: "nothingToGather"; cell: Cell }
  | {
    type: "crafted";
    item: Item;
    spent: Partial<Record<Material, number>>;
  }
  | { type: "cannotCraft"; item: Item; reason: CannotCraftReason };

export const RECIPES: Record<Item, Partial<Record<Material, number>>> = {
  reedSkiff: { reeds: 3, driftwood: 2 },
  cairnPick: { driftwood: 2, stone: 1 },
};

const STEPS: Record<Direction, Cell> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

function cellKey({ x, y }: Cell): string {
  return `${x},${y}`;
}

export function newGame(seed: number): GameState {
  return {
    seed,
    player: { x: 0, y: 0 },
    resources: { reeds: 0, driftwood: 0, stone: 0 },
    gatheredCells: [],
    items: { reedSkiff: 0, cairnPick: 0 },
  };
}

export function apply(state: GameState, command: Command): GameEvent[] {
  switch (command.type) {
    case "move":
      return move(state, command.direction);
    case "gather":
      return gather(state);
    case "craft":
      return craft(state, command.item);
  }
}

function move(state: GameState, direction: Direction): GameEvent[] {
  const step = STEPS[direction];
  const from = { ...state.player };
  const to = { x: from.x + step.x, y: from.y + step.y };
  const terrain = terrainAt(state.seed, to.x, to.y);
  if (!isPassable(terrain)) {
    return [{ type: "blocked", at: from, toward: to, terrain }];
  }
  state.player.x = to.x;
  state.player.y = to.y;
  return [{ type: "moved", from, to }];
}

function gather(state: GameState): GameEvent[] {
  const cell = { ...state.player };
  const key = cellKey(cell);
  if (state.gatheredCells.includes(key)) {
    return [{ type: "nothingToGather", cell }];
  }
  const resource = materialAt(state.seed, cell.x, cell.y);
  if (!resource) {
    return [{ type: "nothingToGather", cell }];
  }
  const amount = 1;
  state.gatheredCells.push(key);
  state.resources[resource] += amount;
  return [{ type: "gathered", cell, resource, amount }];
}

function craft(state: GameState, item: Item): GameEvent[] {
  if (state.items[item] > 0) {
    return [{ type: "cannotCraft", item, reason: { kind: "alreadyOwned" } }];
  }

  const recipe = RECIPES[item];
  const missing: Partial<Record<Material, number>> = {};
  let hasMissing = false;

  for (const [mat, needed] of Object.entries(recipe) as [Material, number][]) {
    const have = state.resources[mat];
    if (have < needed) {
      missing[mat] = needed - have;
      hasMissing = true;
    }
  }

  if (hasMissing) {
    return [{
      type: "cannotCraft",
      item,
      reason: { kind: "missing", missing },
    }];
  }

  const spent: Partial<Record<Material, number>> = {};
  for (const [mat, needed] of Object.entries(recipe) as [Material, number][]) {
    state.resources[mat] -= needed;
    spent[mat] = needed;
  }
  state.items[item] += 1;

  return [{ type: "crafted", item, spent }];
}
