import type { HorseColors } from '../../../config';
import { Actor, between, clampX, hop, moveTo, randomX, type ActorSpec } from '../actor';
import {
  REST,
  animation,
  createFrame,
  drawLeg,
  gait,
  paint,
  palette,
  recolor,
  sequence,
  stroke,
  type Frame,
  type LegPose,
  type LegSpec,
  type Point,
} from '../sprite';

/*
 * Lewin: bay, black points, long white blaze. Facing right.
 * Body grids exclude legs and tail; both are generated so every gait and tail
 * position shares one drawing.
 *
 *   c coat   h highlight   s shade   k points (mane, tail, legs)
 *   w blaze  m muzzle      e eye
 */
const W = 40;
const H = 30;

// prettier-ignore
const STAND = [
  '.............................k..........',
  '...........................kkcc.........',
  '..........................kkkcccwc......',
  '.........................kkkccccwwc.....',
  '........................kkkkcccecwwc....',
  '.......................kkkkcccccccwwc...',
  '......................kkkcccccccccwwc...',
  '.....................kkkcccccccccccwwc..',
  '.........chchc......kkkccccccccccccwwc..',
  '.......hccccccchchckkkccccccccccccccwwc.',
  '.......chccccchchchckccccccccccccccccwk.',
  '......cccccccccccccccccccccccc..cccmmmm.',
  '......hccccccccccccccccccccccc.....mmm..',
  '......cccccccccccccccccccccccc..........',
  '......scscscscscscscscscscscsc..........',
  '.......scccscccscccscccscccsc...........',
  '.......cssscssscssscssscsssc............',
  '.........scscscscscscsc..s..............',
];

// Head down, grazing. Rows 0-6 are empty and omitted (painted at dy = 7).
// prettier-ignore
const GRAZE = [
  '.......................kkkkk............',
  '.........chchc.......kkkkkkkkk..........',
  '.......hccccccchchchckkkccckkkk.........',
  '.......chccccchchchchchcccccckkk........',
  '......cccccccccccccccccccccccckk........',
  '......hccccccccccccccccccccccckkk.......',
  '......ccccccccccccccccccccccccckk.......',
  '......scscscscscscscscscscscscsckk......',
  '.......scccscccscccscccscccsccckccc.....',
  '.......cssscssscssscssscsssc.skccwwc....',
  '.........scscscscscscsc..s...scecwwc....',
  '..............................cccwwc....',
  '...............................cccwwc...',
  '...............................cccwwc...',
  '................................ccwwc...',
  '................................ccwwc...',
  '................................ccwwc...',
  '................................mmmwm...',
  '................................mmmmm...',
  '.................................mmm....',
];

// Same, muzzle one pixel lower: the chewing frame.
// prettier-ignore
const CHEW = [
  '.......................kkkkk............',
  '.........chchc.......kkkkkkkkk..........',
  '.......hccccccchchchckkkccckkkk.........',
  '.......chccccchchchchchcccccckkk........',
  '......cccccccccccccccccccccccckk........',
  '......hccccccccccccccccccccccckkk.......',
  '......ccccccccccccccccccccccccckk.......',
  '......scscscscscscscscscscscscsck.......',
  '.......scccscccscccscccscccscccsck......',
  '.......cssscssscssscssscsssc.sskccc.....',
  '.........scscscscscscsc..s...skccwwc....',
  '..............................cecwwc....',
  '..............................cccwwc....',
  '...............................cccwwc...',
  '...............................cccwwc...',
  '................................ccwwc...',
  '................................ccwwc...',
  '................................ccwwc...',
  '................................mmmwm...',
  '................................mmmmm...',
  '.................................mmm....',
];

/** Tail polylines: rest, swished back, swished forward. */
const TAILS: readonly (readonly Point[])[] = [
  [
    [6.8, 9.6],
    [5, 12],
    [4.2, 16],
    [4.2, 20],
    [4.8, 22.6],
  ],
  [
    [6.8, 9.6],
    [4.6, 12],
    [3.2, 15.5],
    [2.6, 19],
    [2.2, 21.6],
  ],
  [
    [6.8, 9.6],
    [5, 11.6],
    [4.6, 15],
    [5.4, 18.6],
    [6.6, 21],
  ],
];

export function createLewin(colors: HorseColors, x: number): Actor {
  const pal = palette({
    c: colors.coat,
    h: colors.highlight,
    s: colors.shade,
    k: colors.points,
    w: colors.blaze,
    m: colors.muzzle,
    e: '#120C0B',
  });
  const k = pal.k!;

  const leg = (x: number, hind: boolean, far: boolean): LegSpec => ({
    x,
    hip: 14,
    knee: hind ? 20 : 21,
    ground: H - 1,
    upperWidth: hind ? 3 : 2.6,
    lowerWidth: 1.9,
    upper: far ? pal.s! : pal.c!,
    lower: k,
    foot: k,
    kneeOffset: hind ? -0.9 : 0,
  });
  // Order: hind far, hind near, front far, front near.
  const legs = [
    leg(10, true, true),
    leg(13.6, true, false),
    leg(24.2, false, true),
    leg(27.6, false, false),
  ];

  function pose(body: readonly string[], bodyDy: number, tail: number, poses: readonly LegPose[]) {
    const f = createFrame(W, H);
    drawLeg(f, legs[0]!, poses[0]);
    drawLeg(f, legs[2]!, poses[2]);
    paint(f, body, pal, 0, bodyDy);
    stroke(f, TAILS[tail]!, 2.4, k);
    stroke(f, TAILS[tail]!.slice(0, 3), 2.9, k); // fuller at the dock
    drawLeg(f, legs[1]!, poses[1]);
    drawLeg(f, legs[3]!, poses[3]);
    return f;
  }

  const still = [REST, REST, REST, REST];
  const stand = [0, 1, 2].map((t) => pose(STAND, 0, t, still)) as [Frame, Frame, Frame];
  const blink = recolor(stand[0], pal.e!, pal.c!);
  const graze = pose(GRAZE, 7, 0, still);
  const chew = pose(CHEW, 7, 0, still);
  const grazeFlick = pose(GRAZE, 7, 1, still);
  // Lateral walk: hind-near, front-near, hind-far, front-far a quarter apart.
  const walk = gait([0.5, 0, 0.75, 0.25], 2.2, 4).map((p) => pose(STAND, 0, 0, p));
  // Trot: diagonal pairs move together.
  const trot = gait([0, 0.5, 0.5, 0], 3, 4).map((p, i) => pose(STAND, 0, i % 2 ? 1 : 0, p));
  const tucked = pose(STAND, 0, 1, [
    { dx: -2, lift: 3 },
    { dx: -1.6, lift: 2 },
    { dx: 2.6, lift: 5 },
    { dx: 2.2, lift: 4 },
  ]);

  const spec: ActorSpec = {
    name: 'lewin',
    lane: 9,
    initial: 'idle',
    onTap: 'hop',
    onCelebrate: 'hop',
    anims: {
      idle: sequence([
        [stand[0], 1.6],
        [blink, 0.12],
        [stand[0], 1.1],
        [stand[1], 0.14],
        [stand[2], 0.14],
        [stand[1], 0.14],
        [stand[0], 0.9],
      ]),
      walk: animation(walk, 6),
      trot: animation(trot, 10),
      graze: sequence([
        [graze, 0.7],
        [chew, 0.35],
        [graze, 0.5],
        [chew, 0.35],
        [grazeFlick, 0.18],
        [graze, 1.2],
      ]),
      hop: animation([tucked], 1, false),
    },
    states: {
      idle: {
        anim: 'idle',
        enter: (a, w) => (a.memo.until = between(w, 2, 5)),
        update: (a, w) => {
          if (w.happy && a.stateTime > 1.6) return 'hop';
          if (a.stateTime < a.memo.until!) return;
          const r = w.random();
          if (r < 0.45) return 'walk';
          if (r < 0.8) return 'graze';
          return w.reducedMotion ? 'walk' : 'trot';
        },
      },
      walk: {
        anim: 'walk',
        enter: (a, w) => (a.memo.target = randomX(w, W / 2 + 2)),
        update: (a, w, dt) =>
          moveTo(a, clampX(w, a.memo.target!, W / 2), w.reducedMotion ? 5 : 9, dt)
            ? 'idle'
            : undefined,
      },
      trot: {
        anim: 'trot',
        enter: (a, w) => {
          // Trot somewhere worth trotting to: the far half of the meadow.
          a.memo.target =
            a.x < w.w / 2 ? between(w, w.w * 0.6, w.w - W / 2) : between(w, W / 2, w.w * 0.4);
        },
        update: (a, w, dt) =>
          moveTo(a, clampX(w, a.memo.target!, W / 2), 24, dt) ? 'idle' : undefined,
      },
      graze: {
        anim: 'graze',
        enter: (a, w) => (a.memo.until = between(w, 3, 7)),
        update: (a) => (a.stateTime > a.memo.until! ? 'idle' : undefined),
      },
      hop: {
        anim: 'hop',
        enter: (a, w) => {
          hop(a, w.reducedMotion ? 40 : 72);
          const [l, t, r] = a.bounds(w);
          w.hearts(a.dir === 1 ? r - 6 : l + 6, t, w.happy ? 2 : 3);
        },
        update: (a) => (a.stateTime > 0.15 && a.z === 0 ? 'idle' : undefined),
      },
    },
  };
  return new Actor(spec, x);
}
