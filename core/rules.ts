import { isPassable, type Terrain, terrainAt } from "./terrain.ts";

export type Cell = { x: number; y: number };

export type Direction = "north" | "south" | "east" | "west";

export type Resource = "reeds" | "driftwood" | "stone";

export type GameState = {
  seed: number;
  player: Cell;
  resources: Record<Resource, number>;
  gatheredCells: string[];
};

export type Command =
  | { type: "move"; direction: Direction }
  | { type: "gather" };

export type GameEvent =
  | { type: "moved"; from: Cell; to: Cell }
  | { type: "blocked"; at: Cell; toward: Cell; terrain: Terrain }
  | { type: "gathered"; cell: Cell; resource: Resource; amount: number }
  | { type: "nothingToGather"; cell: Cell };

const STEPS: Record<Direction, Cell> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

function cellKey({ x, y }: Cell): string {
  return `${x},${y}`;
}

// Adjust this mapping if your terrain / coordinate rules assign resources differently.
export function resourceAt(
  seed: number,
  x: number,
  y: number,
): Resource | null {
  const terrain = terrainAt(seed, x, y);
  if (terrain === "cairnstone") return "stone";
  if (terrain === "bramblewood") return "driftwood";
  if (terrain === "saltgrass" && Math.abs((x * 31 + y * 17 + seed) % 5) === 0) {
    return "reeds";
  }
  return null;
}

export function newGame(seed: number): GameState {
  return {
    seed,
    player: { x: 0, y: 0 },
    resources: { reeds: 0, driftwood: 0, stone: 0 },
    gatheredCells: [],
  };
}

export function apply(state: GameState, command: Command): GameEvent[] {
  switch (command.type) {
    case "move":
      return move(state, command.direction);
    case "gather":
      return gather(state);
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
  const resource = resourceAt(state.seed, cell.x, cell.y);
  if (!resource) {
    return [{ type: "nothingToGather", cell }];
  }
  const amount = 1;
  state.gatheredCells.push(key);
  state.resources[resource] += amount;
  return [{ type: "gathered", cell, resource, amount }];
}
