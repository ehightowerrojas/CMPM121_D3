import { assert, assertEquals } from "@std/assert";
import { apply, type Command, type GameEvent, newGame } from "./mod.ts";
import run from "./run.json" with { type: "json" };

function replay() {
  const state = newGame(run.seed);
  const events: GameEvent[] = [];
  for (const command of run.commands as Command[]) {
    events.push(...apply(state, command));
  }
  return { state, events };
}

Deno.test("recorded run finishes and replays deterministically", () => {
  const first = replay();
  assert(first.state.ended, "replay did not reach the ending");
  assertEquals(
    first.events.filter((event) => event.type === "crafted").map((event) =>
      event.item
    ),
    ["reedSkiff", "stoneAxe", "sturdyRaft"],
  );
  assertEquals(first.events.at(-1), { type: "ended" });

  const start = Date.now();
  while (Date.now() === start);
  assertEquals(replay(), first);
});
