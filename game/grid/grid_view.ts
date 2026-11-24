// The only folder allowed to import Phaser, and for one job: drawing the grid.
// Input, the HUD, sound, and the order of events all live outside it.
import Phaser from "phaser";
import type { Cell, GameEvent, GameState, Terrain } from "../../core/mod.ts";
import { materialAt, terrainAt } from "../../core/mod.ts";

export const CELL_SIZE = 32;
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const WALK_MS = 120;
const BUMP_MS = 60;
const POP_MS = 90;
const MARKER_COLOR = 0xf5e6a8;
const BUMP_COLOR = 0xe0533d;
const STONE_COLOR = 0xb8b2a8;

const TERRAIN_COLORS: Record<Terrain, number> = {
  saltgrass: 0x5d9e4a,
  bramblewood: 0x2f6b3a,
  tideflat: 0x2d5f9e,
  cairnstone: 0x6e6a66,
  hardwoodGrove: 0x543b24,
};

const CELLS_ACROSS = 16;
const CELLS_DOWN = 13;

function cellCenter({ x, y }: Cell): Cell {
  return {
    x: x * CELL_SIZE + CELL_SIZE / 2,
    y: y * CELL_SIZE + CELL_SIZE / 2,
  };
}

function cellKey({ x, y }: Cell): string {
  return `${x},${y}`;
}

export class GridView extends Phaser.Scene {
  private readonly seed: number;
  private readonly start: Cell;
  private readonly gathered = new Set<string>();
  private ground!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Arc;
  private lastCenter: Cell;

  constructor(state: GameState) {
    super("grid");
    this.seed = state.seed;
    this.start = { ...state.player };
    this.lastCenter = { ...state.player };
    for (const key of state.gatheredCells) this.gathered.add(key);
  }

  create() {
    this.ground = this.add.graphics();
    const { x, y } = cellCenter(this.start);
    this.marker = this.add.circle(x, y, CELL_SIZE * 0.35, MARKER_COLOR);
    this.cameras.main.startFollow(this.marker, true, 0.2, 0.2);
    this.drawCellsAround(this.start);
    this.fitToDisplay();
  }

  private fitToDisplay() {
    const ratio = globalThis.devicePixelRatio || 1;
    this.scale.resize(
      Math.round(VIEW_WIDTH * ratio),
      Math.round(VIEW_HEIGHT * ratio),
    );
    this.scale.canvas.style.width = `${VIEW_WIDTH}px`;
    this.scale.canvas.style.height = `${VIEW_HEIGHT}px`;
    this.cameras.main.setZoom(ratio);
    matchMedia(`(resolution: ${ratio}dppx)`).addEventListener(
      "change",
      () => this.fitToDisplay(),
      { once: true },
    );
  }

  show(event: GameEvent): Promise<void> {
    switch (event.type) {
      case "moved":
        this.lastCenter = { ...event.to };
        this.drawCellsAround(event.to);
        return this.walk(event.to);
      case "blocked":
        return this.bump(event.at, event.toward);
      case "gathered":
        this.gathered.add(cellKey(event.cell));
        this.drawCellsAround(this.lastCenter);
        return this.pop();
      case "nothingToGather":
      case "cannotGather":
      case "crafted":
      case "cannotCraft":
      case "ended":
        return Promise.resolve();
      default:
        event satisfies never;
        return Promise.resolve();
    }
  }

  private walk(to: Cell): Promise<void> {
    return new Promise((done) => {
      this.tweens.add({
        targets: this.marker,
        ...cellCenter(to),
        duration: WALK_MS,
        onComplete: () => done(),
      });
    });
  }

  private bump(at: Cell, toward: Cell): Promise<void> {
    const start = cellCenter(at);
    const target = cellCenter(toward);
    this.marker.setFillStyle(BUMP_COLOR);
    return new Promise((done) => {
      this.tweens.add({
        targets: this.marker,
        x: start.x + (target.x - start.x) * 0.3,
        y: start.y + (target.y - start.y) * 0.3,
        duration: BUMP_MS,
        yoyo: true,
        onComplete: () => {
          this.marker.setFillStyle(MARKER_COLOR);
          done();
        },
      });
    });
  }

  private pop(): Promise<void> {
    return new Promise((done) => {
      this.tweens.add({
        targets: this.marker,
        scale: 1.25,
        duration: POP_MS,
        yoyo: true,
        onComplete: () => {
          this.marker.setScale(1);
          done();
        },
      });
    });
  }

  private drawCellsAround({ x: centerX, y: centerY }: Cell) {
    this.ground.clear();
    for (let y = centerY - CELLS_DOWN; y <= centerY + CELLS_DOWN; y++) {
      for (let x = centerX - CELLS_ACROSS; x <= centerX + CELLS_ACROSS; x++) {
        const terrain = terrainAt(this.seed, x, y);
        const isUsed = this.gathered.has(`${x},${y}`);
        const alpha = isUsed ? 0.55 : 1;
        this.ground.fillStyle(TERRAIN_COLORS[terrain], alpha);
        this.ground.fillRect(
          x * CELL_SIZE,
          y * CELL_SIZE,
          CELL_SIZE - 1,
          CELL_SIZE - 1,
        );

        if (!isUsed && materialAt(this.seed, x, y) === "stone") {
          const cx = x * CELL_SIZE + CELL_SIZE / 2;
          const cy = y * CELL_SIZE + CELL_SIZE / 2;
          this.ground.fillStyle(STONE_COLOR, 0.95);
          this.ground.fillCircle(cx - 4, cy + 2, 3);
          this.ground.fillCircle(cx + 4, cy - 2, 2.5);
          this.ground.fillCircle(cx + 2, cy + 4, 2);
        }
      }
    }
  }
}

export function startGridView(
  parent: HTMLElement,
  state: GameState,
): Promise<GridView> {
  return new Promise((ready) => {
    const view = new GridView(state);
    new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      backgroundColor: "#14161a",
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scene: view,
      callbacks: {
        postBoot: () => ready(view),
      },
    });
  });
}
