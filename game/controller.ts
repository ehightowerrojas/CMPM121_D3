import { apply, type Command, type Direction } from "../core/mod.ts";
import type { GameState } from "../core/mod.ts";
import type { Presenter } from "./presenter.ts";

const ARROWS: Record<string, Direction> = {
  ArrowUp: "north",
  ArrowDown: "south",
  ArrowLeft: "west",
  ArrowRight: "east",
};

function onControl(target: EventTarget | null): boolean {
  return target instanceof Element &&
    target.closest("button, a, input, select, textarea") !== null;
}

// Input in, core in the middle, presenter out. None of those three knows the others,
// which makes this a Mediator: https://refactoring.guru/design-patterns/mediator
// There is no frame loop here: a command runs on a key press or when playback ends.
export class Controller {
  private readonly state: GameState;
  private readonly presenter: Presenter;
  // A tap made during a walk, kept until the presenter is free.
  private pressed: Command | null = null;
  private held: Direction[] = [];
  // Runs when nothing is playing and no next command has started, so it is safe
  // to read the core here. During playback, the core is ahead of what the player
  // has seen, and reading it would show the future.
  onSettled: () => void = () => {};

  constructor(state: GameState, presenter: Presenter) {
    this.state = state;
    this.presenter = presenter;
    presenter.onIdle = () => {
      this.next();
      // next() may have just started another walk.
      if (!presenter.busy) this.onSettled();
    };
    addEventListener("keydown", (event) => this.keyDown(event));
    addEventListener("keyup", (event) => this.keyUp(event));
    addEventListener("blur", () => this.held = []);
  }

  private keyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = ARROWS[event.key];
    // Space on a focused control, such as the sound button, belongs to that control.
    const gather = event.key === " " && !onControl(event.target);
    if (!direction && !gather) return;
    // Otherwise arrow keys and Space would also scroll the page.
    event.preventDefault();
    if (event.repeat) return;
    if (direction) {
      this.held.push(direction);
      this.pressed = { type: "move", direction };
    } else {
      // A tap only, never held: holding Space would gather again after every step.
      this.pressed = { type: "gather" };
    }
    this.next();
  }

  private keyUp(event: KeyboardEvent) {
    this.held = this.held.filter((direction) =>
      direction !== ARROWS[event.key]
    );
  }

  private next() {
    // While the presenter is busy, input waits and the core hears nothing. The
    // busy state lives here in game/: the core never learns about animation.
    if (this.presenter.busy) return;

    const held = this.held.at(-1);
    const command: Command | null = this.pressed ??
      (held ? { type: "move", direction: held } : null);
    this.pressed = null;
    if (!command) return;

    // Playing nothing would report idle at once, and a held key would land back
    // here until the stack overflowed. No events means there is nothing to wait for.
    const events = apply(this.state, command);
    if (events.length > 0) this.presenter.play(events);
  }
}
