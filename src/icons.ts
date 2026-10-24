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

/** Small UI glyphs on an 8x8 grid (heart 7x6), same format. */
// prettier-ignore
export const GLYPHS = {
  left: ['........', '....##..', '...##...', '..##....', '..##....', '...##...', '....##..', '........'],
  right: ['........', '..##....', '...##...', '....##..', '....##..', '...##...', '..##....', '........'],
  close: ['........', '.#....#.', '..#..#..', '...##...', '...##...', '..#..#..', '.#....#.', '........'],
  arrow: ['........', '....#...', '.....#..', '########', '.....#..', '....#...', '........', '........'],
  heart: ['.++.++.', '+oo++++', '+o+++++', '.+++++.', '..+++..', '...+...'],
} satisfies Record<string, CustomIcon>;

const FILL: Record<string, string> = { '#': 'currentColor', '+': 'var(--rose)', o: 'var(--blush)' };

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
