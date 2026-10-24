import { Actor, between, clampX, hop, moveTo, randomX, type ActorSpec } from '../actor';
import {
  REST,
  animation,
  createFrame,
  drawLeg,
  gait,
  paint,
  palette,
  sequence,
  stroke,
  type Frame,
  type LegPose,
  type LegSpec,
  type Point,
} from '../sprite';

/*
 * Golden retriever, facing right. g gold, G shade, L feathering, k eye, n nose.
 */
const W = 27;
const H = 19;

// prettier-ignore
const STAND = [
  '...........................',
  '...................ggg.....',
  '..................gggggg...',
  '.................Gggggkgg..',
  '.................GGgggggggn',
  '................gGGggggggg.',
  '......gggggggggggGGLLggGG..',
  '.....gggggggggggggGGg......',
  '....gggggggggggggggggg.....',
  '....gggggggggggggggggg.....',
  '....ggGgggGgggGgggGgL......',
  '.....GgGgGgGgGgGgGgLg......',
  '.......GGGLGLGLGGLLG.......',
];

// Nose to the ground. Rows 0-4 are empty and omitted (painted at dy = 5).
// prettier-ignore
const SNIFF = [
  '................gggggg.....',
  '......gggggggggggggggggg...',
  '.....ggggggggggggGggggkgg..',
  '....gggggggggggggGGgggggggn',
  '....gggggggggggggGGggggggg.',
  '....ggGgggGgggGggGGLLggGG..',
  '.....GgGgGgGgGgGgGGGg......',
  '.......GGGLGLGLGGLLG.......',
];

/** Feathered tail: low, up, wagged up-back. */
const TAILS: readonly (readonly Point[])[] = [
  [
    [5, 7.6],
    [2.6, 6.4],
    [0.8, 4.2],
  ],
  [
    [5, 7.6],
    [2.4, 5.2],
    [1.6, 2.2],
  ],
  [
    [5, 7.6],
    [2.4, 7.6],
    [0.6, 6.8],
  ],
];

export function createDog(x: number): Actor {
  const pal = palette({ g: '#D9A35B', G: '#B07A3A', L: '#EFCB8E', k: '#2A1D1A', n: '#2A1D1A' });

  const leg = (x: number, far: boolean): LegSpec => ({
    x,
    hip: 11,
    knee: 15,
    ground: H - 1,
    upperWidth: 2,
    lowerWidth: 2,
    upper: far ? pal.G! : pal.g!,
    lower: far ? pal.G! : pal.g!,
    foot: far ? pal.G! : pal.L!,
  });
  const legs = [leg(7, true), leg(9.6, false), leg(17, true), leg(19.4, false)];

  function pose(body: readonly string[], dy: number, tail: number, poses: readonly LegPose[]) {
    const f = createFrame(W, H);
    drawLeg(f, legs[0]!, poses[0]);
    drawLeg(f, legs[2]!, poses[2]);
    paint(f, body, pal, 0, dy);
    stroke(f, TAILS[tail]!, 2.8, pal.g!);
    stroke(f, TAILS[tail]!.slice(1), 1.6, pal.L!);
    drawLeg(f, legs[1]!, poses[1]);
    drawLeg(f, legs[3]!, poses[3]);
    return f;
  }

  const still = [REST, REST, REST, REST];
  const [low, up, back] = [0, 1, 2].map((t) => pose(STAND, 0, t, still)) as [Frame, Frame, Frame];
  const sniff = pose(SNIFF, 5, 0, still);
  const trot = gait([0, 0.5, 0.5, 0], 1.8, 4).map((p, i) => pose(STAND, 0, i % 2 ? 1 : 2, p));
  const tucked = pose(STAND, 0, 1, [
    { dx: -1.5, lift: 3 },
    { dx: -1, lift: 2 },
    { dx: 1.8, lift: 3 },
    { dx: 1.4, lift: 2 },
  ]);
  const wag = [up, back, up, back, up, back, up, back];

  const spec: ActorSpec = {
    name: 'dog',
    lane: 15,
    initial: 'idle',
    onTap: 'hop',
    onCelebrate: 'hop',
    anims: {
      idle: sequence([
        [low, 1.4],
        [up, 0.2],
        [low, 1.2],
      ]),
      wag: animation(wag, 12),
      trot: animation(trot, 9),
      sniff: animation([sniff], 1),
      hop: sequence(
        [
          [tucked, 0.3],
          [up, 0.1],
          [back, 0.1],
        ],
        false,
      ),
    },
    states: {
      idle: {
        anim: 'idle',
        enter: (a, w) => (a.memo.until = between(w, 1.5, 4)),
        update: (a, w) => {
          if (w.happy && a.stateTime > 1) return 'wag';
          if (a.stateTime < a.memo.until!) return;
          const r = w.random();
          return r < 0.55 ? 'trot' : r < 0.8 ? 'wag' : 'sniff';
        },
      },
      wag: {
        anim: 'wag',
        update: (a, w) =>
          a.stateTime > (w.happy ? 1.4 : 0.9) ? (w.happy ? 'hop' : 'idle') : undefined,
      },
      trot: {
        anim: 'trot',
        enter: (a, w) => (a.memo.target = randomX(w, W / 2 + 2)),
        update: (a, w, dt) =>
          moveTo(a, clampX(w, a.memo.target!, W / 2), w.reducedMotion ? 10 : 26, dt)
            ? 'idle'
            : undefined,
      },
      sniff: {
        anim: 'sniff',
        enter: (a, w) => (a.memo.until = between(w, 1.6, 2.4)),
        update: (a) => (a.stateTime > a.memo.until! ? 'idle' : undefined),
      },
      hop: {
        anim: 'hop',
        enter: (a, w) => {
          hop(a, w.reducedMotion ? 30 : 60);
        },
        update: (a) => (a.stateTime > 0.15 && a.z === 0 ? 'wag' : undefined),
      },
    },
  };
  return new Actor(spec, x);
}
