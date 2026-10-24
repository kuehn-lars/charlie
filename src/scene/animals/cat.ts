import { Actor, clampX, hop, moveTo, type ActorSpec } from '../actor';
import {
  animation,
  createFrame,
  drawLeg,
  gait,
  paint,
  palette,
  recolor,
  sequence,
  stroke,
  type LegPose,
  type LegSpec,
  type Point,
} from '../sprite';

/*
 * Orange tabby, facing right. o orange, O stripes, l cream, k eye, p nose.
 * Chases the pointer (or last tap), then sits and blinks.
 */
const W = 16;
const H = 12;

// prettier-ignore
const SIT = [
  '................',
  '.......o...o....',
  '.......oo.oo....',
  '.......oOoOo....',
  '......ooookoo...',
  '......Ooooollp..',
  '......oOoooll...',
  '.....oOoooll....',
  '....ooOooOll....',
  '...ooOooOooll...',
  '..ooooOooolll...',
  'OoOooooOoolll...',
];

// Running body without legs and tail.
// prettier-ignore
const RUN = [
  '................',
  '...........o.o..',
  '...........ooo..',
  '..........oooo..',
  '.....oOoo.oooko.',
  '...OooOooOoooolp',
  '..oOooOooOoooll.',
  '...oooooooo.....',
  '......oo........',
];

const TAILS: readonly (readonly Point[])[] = [
  [
    [2.6, 5.4],
    [1, 3.6],
    [1.2, 1.6],
  ],
  [
    [2.6, 5.4],
    [0.8, 4.6],
    [0.4, 2.6],
  ],
];

export function createCat(x: number): Actor {
  const pal = palette({ o: '#DD8A3E', O: '#B8652A', l: '#F5C893', k: '#2A1D1A', p: '#E8638C' });

  const leg = (x: number, far: boolean): LegSpec => ({
    x,
    hip: 7.6,
    knee: 9.3,
    ground: H - 1,
    upperWidth: 1.3,
    lowerWidth: 1.3,
    upper: far ? pal.O! : pal.o!,
    lower: far ? pal.O! : pal.o!,
  });
  const legs = [leg(4, true), leg(5.2, false), leg(9.6, true), leg(10.8, false)];

  function run(tail: number, poses: readonly LegPose[]) {
    const f = createFrame(W, H);
    paint(f, RUN, pal);
    stroke(f, TAILS[tail]!, 1.6, pal.o!);
    legs.forEach((l, i) => {
      const p = poses[i]!;
      drawLeg(f, l, p);
      const px = Math.max(0, Math.min(W - 1, Math.round(l.x + p.dx - 0.5)));
      f.px[(H - 1 - p.lift) * W + px] = pal.l!; // paw
    });
    return f;
  }

  const sit = paint(createFrame(W, H), SIT, pal);
  const blink = recolor(sit, pal.k!, pal.o!);
  const strides = gait([0, 0.5, 0.25, 0.75], 1.6, 4);
  const runFrames = strides.map((p, i) => run(i % 2, p));
  const pounce = run(0, [
    { dx: -1.4, lift: 2 },
    { dx: -1, lift: 2 },
    { dx: 1.4, lift: 2 },
    { dx: 1, lift: 2 },
  ]);

  const spec: ActorSpec = {
    name: 'cat',
    lane: 19,
    initial: 'sit',
    onTap: 'pounce',
    onCelebrate: 'pounce',
    anims: {
      sit: sequence([
        [sit, 2.2],
        [blink, 0.12],
        [sit, 0.25],
        [blink, 0.12],
        [sit, 1.6],
      ]),
      run: animation(runFrames, 12),
      pounce: animation([pounce], 1, false),
    },
    states: {
      sit: {
        anim: 'sit',
        update: (a, w) => {
          if (w.happy && a.stateTime > 2.5) return 'pounce';
          if (w.reducedMotion || w.pointerX === null) return;
          if (Math.abs(clampX(w, w.pointerX, W / 2) - a.x) > 6) return 'run';
        },
      },
      run: {
        anim: 'run',
        update: (a, w, dt) => {
          const target = clampX(w, w.pointerX ?? a.x, W / 2);
          return moveTo(a, target, 46, dt) ? 'sit' : undefined;
        },
      },
      pounce: {
        anim: 'pounce',
        enter: (a, w) => {
          hop(a, w.reducedMotion ? 30 : 64);
        },
        update: (a) => (a.stateTime > 0.15 && a.z === 0 ? 'sit' : undefined),
      },
    },
  };
  return new Actor(spec, x);
}
