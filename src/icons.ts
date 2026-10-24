import type { CustomIcon, IconName } from '../config';

/*
 * 16x16 pixel icons for the activity cards, rendered as crisp SVG rects.
 * # currentColor (ink)   + accent   o accent partner (blush)
 */
// prettier-ignore
const ICONS: Record<IconName, CustomIcon> = {
  pot: [
    '................',
    '.....o..o.......',
    '......o..o......',
    '.....o..o.......',
    '................',
    '......####......',
    '..############..',
    '................',
    '.#.##########.#.',
    '.##+++++++++++#.',
    '...#++++++++#...',
    '...#++++++++#...',
    '...#++++++++#...',
    '....########....',
    '................',
    '................',
  ],
  sushi: [
    '................',
    '................',
    '................',
    '.......++++.....',
    '....++++++o+....',
    '..++o+++++++o+..',
    '.+++++++++o++++.',
    '.##############.',
    '.#oooooooooooo#.',
    '.#oooooooooooo#.',
    '..############..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  bowling: [
    '...........##...',
    '..........#oo#..',
    '..........#oo#..',
    '...........##...',
    '..........#++#..',
    '..........#oo#..',
    '...++++..#oooo#.',
    '..++++++.#oooo#.',
    '.++#+#+++#oooo#.',
    '.+++#++++#oooo#.',
    '.++++++++.#oo#..',
    '.++++++++.#oo#..',
    '..++++++...##...',
    '...++++.........',
    '................',
    '################',
  ],
  dice: [
    '................',
    '................',
    '...##########...',
    '..#++++++++++#..',
    '..#+oo++++oo+#..',
    '..#+oo++++oo+#..',
    '..#++++oo++++#..',
    '..#++++oo++++#..',
    '..#+oo++++oo+#..',
    '..#+oo++++oo+#..',
    '..#++++++++++#..',
    '...##########...',
    '................',
    '................',
    '................',
    '................',
  ],
  heart: [
    '................',
    '................',
    '................',
    '...+++...+++....',
    '..+ooo+.+++++...',
    '..+oo+++++++++..',
    '..+o++++++++++..',
    '..++++++++++++..',
    '...++++++++++...',
    '....++++++++....',
    '.....++++++.....',
    '......++++......',
    '.......++.......',
    '................',
    '................',
    '................',
  ],
};

/** Small UI glyphs on an 8x8 grid (brand mark 13x13), same format. */
// prettier-ignore
export const GLYPHS = {
  left: ['........', '....##..', '...##...', '..##....', '..##....', '...##...', '....##..', '........'],
  right: ['........', '..##....', '...##...', '....##..', '....##..', '...##...', '..##....', '........'],
  close: ['........', '.#....#.', '..#..#..', '...##...', '...##...', '..#..#..', '.#....#.', '........'],
  arrow: ['........', '....#...', '.....#..', '########', '.....#..', '....#...', '........', '........'],
  /** Brand mark: the painting seen through a heart, in the current theme's colors. */
  brand: [
    '..kkk...kkk..',
    '.kaaak.kaaak.',
    'ka**aakaavaak',
    'ka*aaaaaaaaak',
    'kbbbbbbrrrbbk',
    'kcccccruyurck',
    'kccccruyyyurk',
    '.kllllluyulk.',
    '..kggLLLggk..',
    '...kgfgggk...',
    '....kdddk....',
    '.....kdk.....',
    '......k......',
  ],
  sun: ['...##...', '.#....#.', '..####..', '#.####.#', '#.####.#', '..####..', '.#....#.', '...##...'],
  moon: ['..####..', '.###....', '###.....', '###.....', '###.....', '###...+.', '.###....', '..####..'],
} satisfies Record<string, CustomIcon>;

const FILL: Record<string, string> = {
  '#': 'currentColor',
  '+': 'var(--rose)',
  o: 'var(--blush)',
  // Painting colors, for the brand mark.
  k: 'var(--rose-ink)',
  a: 'var(--sky-0)',
  b: 'var(--sky-2)',
  c: 'var(--sky-4)',
  y: 'var(--sun-1)',
  u: 'var(--sun-3)',
  r: 'var(--sun-4)',
  l: 'var(--hills-0)',
  L: 'var(--hills-1)',
  g: 'var(--meadow-1)',
  d: 'var(--meadow-3)',
  f: 'var(--blooms-1)',
  '*': 'var(--sparkles-0)',
  v: 'var(--sparkles-1)',
};

/** Builds an SVG with one <rect> per horizontal run of same-colored pixels. */
export function pixelIcon(icon: IconName | CustomIcon, size: number): SVGSVGElement {
  const rows = typeof icon === 'string' ? ICONS[icon] : icon;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${rows[0]?.length ?? 16} ${rows.length}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String((size * rows.length) / (rows[0]?.length ?? 16)));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = FILL[ch];
      if (fill) {
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(end - x));
        rect.setAttribute('height', '1');
        rect.setAttribute('fill', fill);
        svg.append(rect);
      }
      x = end;
    }
  });
  return svg;
}
