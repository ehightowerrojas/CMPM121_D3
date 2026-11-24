// The rules of the game. There is no clock here: a command updates the state at
// once, and the events it returns are a record of what happened. Whoever called
// apply() decides how, or whether, to show them over time.

import {
  isPassable,
  type Item,
  type Material,
  materialAt,
  type Terrain,
  TERRAIN_RULES,
  terrainAt,
} from "./terrain.ts";

export type { Item, Material };

export type Resource = Material;

export type Cell = { x: number; y: number };

export type Direction = "north" | "south" | "east" | "west";

export type GameState = {
  seed: number;
  player: Cell;
  resources: Record<Material, number>;
  gatheredCells: string[];
  items: Record<Item, number>;
  ended: boolean;
};

export type Command =
  | { type: "move"; direction: Direction }
  | { type: "gather" }
  | { type: "craft"; item: Item };

export type CannotCraftReason =
  | { kind: "alreadyOwned" }
  | { kind: "gameEnded" }
  | { kind: "missing"; missing: Partial<Record<Material, number>> };

export type GameEvent =
  | { type: "moved"; from: Cell; to: Cell }
  | { type: "blocked"; at: Cell; toward: Cell; terrain: Terrain }
  | { type: "gathered"; cell: Cell; resource: Material; amount: number }
  | { type: "nothingToGather"; cell: Cell }
  | { type: "cannotGather"; cell: Cell; required: Item }
  | {
    type: "crafted";
    item: Item;
    spent: Partial<Record<Material, number>>;
  }
  | { type: "cannotCraft"; item: Item; reason: CannotCraftReason }
  | { type: "ended" };

export const CAPSTONE: Item = "sturdyRaft";

export const RECIPES: Record<Item, Partial<Record<Material, number>>> = {
  reedSkiff: { reeds: 3, driftwood: 2 },
  stoneAxe: { driftwood: 2, stone: 1 },
  sturdyRaft: { hardwood: 3, reeds: 2, driftwood: 2 },
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
    resources: { reeds: 0, driftwood: 0, stone: 0, hardwood: 0 },
    gatheredCells: [],
    items: { reedSkiff: 0, stoneAxe: 0, sturdyRaft: 0 },
    ended: false,
  };
}

export function apply(state: GameState, command: Command): GameEvent[] {
  if (state.ended) return [];
  switch (command.type) {
    case "move":
      return move(state, command.direction);
    case "gather":
      return gather(state);
    case "craft":
      return craft(state, command.item);
  }
}

export function cannotCraftReason(
  state: GameState,
  item: Item,
): CannotCraftReason | null {
  if (state.ended) return { kind: "gameEnded" };
  if (state.items[item] > 0) {
    return { kind: "alreadyOwned" };
  }

  const missing: Partial<Record<Material, number>> = {};
  for (
    const [mat, needed] of Object.entries(RECIPES[item]) as [
      Material,
      number,
    ][]
  ) {
    const have = state.resources[mat];
    if (have < needed) missing[mat] = needed - have;
  }

  return Object.keys(missing).length > 0 ? { kind: "missing", missing } : null;
}

function move(state: GameState, direction: Direction): GameEvent[] {
  const step = STEPS[direction];
  const from = { ...state.player };
  const to = { x: from.x + step.x, y: from.y + step.y };
  const terrain = terrainAt(state.seed, to.x, to.y);
  if (!isPassable(terrain, state.items)) {
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
  const required = TERRAIN_RULES[terrainAt(state.seed, cell.x, cell.y)]
    .gatherRequires;
  if (required && state.items[required] <= 0) {
    return [{ type: "cannotGather", cell, required }];
  }
  const amount = 1;
  state.gatheredCells.push(key);
  state.resources[resource] += amount;
  return [{ type: "gathered", cell, resource, amount }];
}

function craft(state: GameState, item: Item): GameEvent[] {
  const reason = cannotCraftReason(state, item);
  if (reason) return [{ type: "cannotCraft", item, reason }];
  const recipe = RECIPES[item];
  const spent: Partial<Record<Material, number>> = {};
  for (const [mat, needed] of Object.entries(recipe) as [Material, number][]) {
    state.resources[mat] -= needed;
    spent[mat] = needed;
  }
  state.items[item] += 1;

  const crafted: GameEvent = { type: "crafted", item, spent };
  if (item === CAPSTONE) {
    state.ended = true;
    return [crafted, { type: "ended" }];
  }
  return [crafted];
}
