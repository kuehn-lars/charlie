import { blit, frameAt, type Animation, type Frame, type Surface } from './sprite';

/** What actors can see and do. Owned by the engine, rebuilt on resize. */
export interface World {
  readonly w: number;
  readonly h: number;
  /** y of the meadow's top edge. Actor lanes are offsets from it. */
  readonly horizon: number;
  readonly reducedMotion: boolean;
  /** Last known pointer x in scene px (mouse hover or last tap), if any. */
  readonly pointerX: number | null;
  /** True after the success screen: animals celebrate. */
  readonly happy: boolean;
  hearts(x: number, y: number, count: number): void;
  random(): number;
}

/**
 * One state of an actor's state machine. `update` returns the name of the
 * next state to transition, or nothing to stay.
 */
export interface StateDef {
  anim: string;
  enter?(a: Actor, w: World): void;
  update?(a: Actor, w: World, dt: number): string | undefined;
}

export interface ActorSpec {
  name: string;
  anims: Readonly<Record<string, Animation>>;
  states: Readonly<Record<string, StateDef>>;
  initial: string;
  /** Lane: feet y = horizon + lane. Lower lanes are drawn in front. */
  lane: number;
  /** State entered when tapped (if any). */
  onTap?: string;
  /** State entered on `celebrate()` (the "Ja" moment). */
  onCelebrate?: string;
}

const GRAVITY = 420; // px/s^2, scene pixels

export class Actor {
  x: number;
  /** Height above the lane, for hops. */
  z = 0;
  vz = 0;
  dir: 1 | -1 = 1;
  state: string;
  stateTime = 0;
  animTime = 0;
  /** Free-form per-actor scratch (targets, timers). */
  readonly memo: Record<string, number> = {};

  constructor(
    readonly spec: ActorSpec,
    x: number,
  ) {
    this.x = x;
    this.state = spec.initial;
  }

  get def(): StateDef {
    return this.spec.states[this.state]!;
  }

  get frame(): Frame {
    return frameAt(this.spec.anims[this.def.anim]!, this.animTime);
  }

  feetY(w: World): number {
    return w.horizon + this.spec.lane;
  }

  go(state: string, w: World): void {
    if (!(state in this.spec.states)) throw new Error(`${this.spec.name}: unknown state ${state}`);
    this.state = state;
    this.stateTime = 0;
    this.animTime = 0;
    this.def.enter?.(this, w);
  }

  update(w: World, dt: number): void {
    this.stateTime += dt;
    this.animTime += dt;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0) this.vz = 0;
    }
    const next = this.def.update?.(this, w, dt);
    if (next !== undefined && next !== this.state) this.go(next, w);
  }

  /** Bounding box in scene px: [left, top, right, bottom]. */
  bounds(w: World): [number, number, number, number] {
    const f = this.frame;
    const left = Math.round(this.x - f.w / 2);
    const bottom = Math.round(this.feetY(w) - this.z);
    return [left, bottom - f.h + 1, left + f.w, bottom + 1];
  }

  hit(w: World, x: number, y: number, pad = 2): boolean {
    const [l, t, r, b] = this.bounds(w);
    return x >= l - pad && x <= r + pad && y >= t - pad && y <= b + pad;
  }

  draw(dst: Surface, w: World): void {
    const [l, t] = this.bounds(w);
    blit(dst, this.frame, l, t, this.dir === -1);
  }
}

// ---------------------------------------------------------------------------
// Behavior helpers shared by animals.
// ---------------------------------------------------------------------------

/** Moves towards `target` at `speed` px/s. Returns true once arrived. */
export function moveTo(a: Actor, target: number, speed: number, dt: number): boolean {
  const d = target - a.x;
  if (Math.abs(d) <= speed * dt || Math.abs(d) < 0.5) {
    a.x = target;
    return true;
  }
  a.dir = d > 0 ? 1 : -1;
  a.x += Math.sign(d) * speed * dt;
  return false;
}

/** A random x inside the scene, keeping `margin` px off both edges. */
export const randomX = (w: World, margin: number): number =>
  margin + w.random() * Math.max(1, w.w - margin * 2);

export const clampX = (w: World, x: number, margin: number): number =>
  Math.min(w.w - margin, Math.max(margin, x));

/** Uniform random duration in [min, max) seconds. */
export const between = (w: World, min: number, max: number): number =>
  min + w.random() * (max - min);

export function hop(a: Actor, velocity: number): void {
  if (a.z === 0) a.vz = velocity;
}
