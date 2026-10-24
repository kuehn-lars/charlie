/**
 * Für Charlie: site configuration.
 *
 * THIS REPOSITORY IS PUBLIC. Everything in this file ends up readable on GitHub
 * and in the deployed JavaScript bundle. Do not put anything here you would not
 * be comfortable with anyone reading. (The Web3Forms access key is public by
 * design: it can only deliver mail to the inbox it was created for.)
 *
 * Conventions
 * - Calendar days are 'YYYY-MM-DD' strings, interpreted in Europe/Berlin.
 * - Times are 'HH:MM', 24h.
 * - Weekdays are ISO numbers: 1 = Monday ... 7 = Sunday.
 * - Colors are '#RRGGBB'. Color lists are dithered stop to stop.
 *
 * In dev (`npm run dev`) the config is validated at startup; problems are
 * logged to the browser console as `[config]` warnings.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Hex = `#${string}`;

/** A single blocked day. */
export interface BlockedDay {
  date: string;
  /** Shown when the day is hovered, focused or tapped. */
  reason?: string;
}

/** An inclusive range of blocked days. */
export interface BlockedRange {
  from: string;
  to: string;
  reason?: string;
}

export interface HighlightedDay {
  date: string;
  /** Short label, e.g. "Lars hat ab 17:30 Zeit". Shown above the day's time chips. */
  label: string;
  /** Earliest time Lars is free ('HH:MM'): earlier chips and custom times are not offered. */
  from?: string;
}

/** Built-in 16x16 pixel icons. See `src/icons.ts`. */
export type IconName = 'pot' | 'sushi' | 'bowling' | 'dice' | 'heart';

/**
 * A custom icon: up to 16 rows of up to 16 chars. `#` = ink, `+` = accent,
 * `o` = accent partner (blush), `.` = transparent.
 */
export type CustomIcon = readonly string[];

export interface Activity {
  /** Stable id, used in persisted state. Never reuse an id for a different activity. */
  id: string;
  title: string;
  description: string;
  icon: IconName | CustomIcon;
  /** Accent border plus badge. Use for at most one activity. */
  recommended?: boolean;
  badge?: string;
}

export interface Palette {
  /** Page background. */
  bg: Hex;
  /** Raised surfaces: cards, inputs, secondary buttons. */
  surface: Hex;
  /** Primary text. */
  ink: Hex;
  /** Secondary text. Keep >= 4.5:1 against `bg`. */
  muted: Hex;
  /** Decorative / disabled text. */
  faint: Hex;
  /** 1px borders. */
  border: Hex;
  /** Grid rails, fainter than `border`. */
  grid: Hex;
  /** The accent. Dither, focus rings, highlight borders. */
  rose: Hex;
  /** Accent for text (>= 4.5:1 against `bg`) and filled buttons. */
  roseInk: Hex;
  /** Text on `roseInk` buttons (>= 4.5:1). */
  onAccent: Hex;
  /** Dither partner of `rose`. */
  blush: Hex;

  // The painting. Each list is dithered stop to stop.
  /** Sky, top to horizon. */
  sky: readonly Hex[];
  /** Sun (or moon), core to rim; the last stops also paint the halo rings. */
  sun: readonly Hex[];
  /** Brush-stroke clouds: highlight, body, shadow. */
  clouds: readonly Hex[];
  /** Distant hills: far, near. */
  hills: readonly Hex[];
  /** Meadow, horizon to front. */
  meadow: readonly Hex[];
  /** Flower dabs in the meadow. */
  blooms: readonly Hex[];
  /** Twinkling specks above the horizon (stars, glints). Empty for none. */
  sparkles: readonly Hex[];
}

export interface HorseColors {
  coat: Hex;
  highlight: Hex;
  shade: Hex;
  /** Mane, tail, lower legs. */
  points: Hex;
  blaze: Hex;
  muzzle: Hex;
  /** Halter. Defaults to the accent if you like it matching. */
  halter: Hex;
}

export interface Texts {
  documentTitle: string;
  /** Used for og:description / twitter:description. */
  shareDescription: string;
  brand: string;
  /** Screen reader announcement on step change. */
  stepAnnouncement: (step: number, total: number, title: string) => string;
  back: string;
  next: string;
  /** Label of the dark mode switch. */
  darkMode: string;

  question: {
    title: string;
    eyebrow: string;
    /** Wrap a word in *asterisks* to set it in the accent color. */
    headline: string;
    yes: string;
    no: string;
    /** Shown in rotation under the buttons after "Nein" escapes. */
    escapes: readonly string[];
  };
  when: {
    title: string;
    headline: string;
    lead: string;
    prevMonth: string;
    nextMonth: string;
    pickDayHint: string;
    timesTitle: string;
    timesFor: (dayLabel: string) => string;
    customTime: string;
    customTimeLabel: string;
    add: string;
    duplicate: string;
    maxReached: (max: number) => string;
    slotsTitle: string;
    slotsEmpty: string;
    remove: (slotLabel: string) => string;
    blockedFallbackReason: string;
    highlightLegend: string;
    pastTime: string;
  };
  what: {
    title: string;
    headline: string;
    leadSingle: string;
    leadMultiple: string;
  };
  note: {
    title: string;
    headline: string;
    lead: string;
    label: string;
    optional: string;
    summaryTitle: string;
    summarySlots: string;
    summaryActivity: string;
    edit: string;
    submit: string;
    sending: string;
    errorTitle: string;
    errorBody: string;
    retry: string;
  };
  done: {
    title: string;
    eyebrow: string;
    headline: string;
    body: string;
  };
  email: {
    subject: string;
    fromName: string;
    intro: string;
    slots: string;
    activity: string;
    note: string;
    noNote: string;
    neinAttempts: string;
    sentAt: string;
  };
}

export interface Config {
  names: { her: string; me: string; horse: string };
  /** Absolute URL of the deployed site, with trailing slash. Its path is the Vite `base`. */
  SITE_URL: string;
  /** Web3Forms access key (https://web3forms.com). Public by design. */
  WEB3FORMS_ACCESS_KEY: string;
  /** When true, the payload is logged to the console instead of being sent. */
  DRY_RUN: boolean;

  /** Light theme. */
  palette: Palette;
  /** Dark theme, used when the system prefers dark or the switch says so. */
  paletteDark: Palette;
  horse: HorseColors;

  /** First selectable day. Default: today (Europe/Berlin). */
  minDate?: string;
  /** Last selectable day. Default: today + 3 months. */
  maxDate?: string;
  blockedDates: readonly (BlockedDay | BlockedRange)[];
  highlightedDates: readonly HighlightedDay[];
  /** ISO weekdays that are never selectable (1 = Monday ... 7 = Sunday). */
  blockedWeekdays: readonly number[];
  timePresets: readonly string[];
  maxSlots: number;

  activities: readonly Activity[];
  allowMultiple: boolean;

  texts: Texts;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const names = { her: 'Charlie', me: 'Lars', horse: 'Lewin' } as const;

export const config: Config = {
  names,
  SITE_URL: 'https://kuehn-lars.github.io/charlie/',
  WEB3FORMS_ACCESS_KEY: '221e5558-a00c-4ce2-afc7-7bdd8c9589f9',
  DRY_RUN: false,

  // Golden hour: periwinkle sky melting into apricot, a ringed sun, lilac hills.
  palette: {
    bg: '#FFF3EA',
    surface: '#FFFAF6',
    ink: '#2B1533',
    muted: '#7A5A6E',
    faint: '#B39AAA',
    border: '#F1D8CE',
    grid: '#F8E6DD',
    rose: '#FF4F7B',
    roseInk: '#D42E62',
    onAccent: '#FFFAF6',
    blush: '#FFC2D1',
    sky: ['#9FB2FF', '#C5B6FA', '#F2BDE0', '#FFC9C2', '#FFD6A5', '#FFB37D'],
    sun: ['#FFFBE6', '#FFE680', '#FFC24B', '#FF8A5B', '#FF4F7B', '#E33D8F'],
    clouds: ['#FFF4F8', '#F7A8CB', '#B999F0'],
    hills: ['#B59CEB', '#8E7FD9'],
    meadow: ['#C6EB7A', '#7FD27E', '#3BAA72', '#1E7C64', '#14524F'],
    blooms: ['#FF4F7B', '#FFD84D', '#FFFFFF', '#7FC8FF', '#C17CFF'],
    sparkles: ['#FFFFFF', '#FFF2A8'],
  },

  // Starry night: indigo swirls, a golden ringed moon, fireflies in the grass.
  paletteDark: {
    bg: '#120E24',
    surface: '#1B1533',
    ink: '#F7EEF6',
    muted: '#B4A4C6',
    faint: '#6E6189',
    border: '#2F2752',
    grid: '#211A3D',
    rose: '#FF6B9A',
    roseInk: '#FF7EAA',
    onAccent: '#1A0B1F',
    blush: '#5C2A5E',
    sky: ['#0A0A26', '#141A52', '#22307A', '#3D2F86', '#7A3489', '#C9477A'],
    sun: ['#FFFCE8', '#FFF0A3', '#FFD45C', '#F7A541', '#E8673C', '#B9367A'],
    clouds: ['#BFD7FF', '#5E7FE6', '#2C3A9E'],
    hills: ['#2B2068', '#1B1A4A'],
    meadow: ['#3E8F7A', '#2A6B66', '#1B4D55', '#123546', '#0A2033'],
    blooms: ['#FF7EAA', '#FFD84D', '#9FE8FF', '#E9FF6A', '#C9A2FF'],
    sparkles: ['#FFFFFF', '#FFF3B0', '#9FE8FF'],
  },

  horse: {
    coat: '#7A3B22',
    highlight: '#A65634',
    shade: '#5A2917',
    points: '#2A1D1A',
    blaze: '#F3ECE6',
    muzzle: '#3B2B27',
    halter: '#FF4F7B',
  },

  // Real availability; visible on the live site. A highlight's `from` hides
  // that day's earlier time chips and rejects earlier custom times.
  blockedDates: [
    { date: '2026-10-24', reason: 'Lars ist schon verplant' },
    { from: '2026-10-30', to: '2026-10-31', reason: 'Lars ist schon verplant' },
  ],
  highlightedDates: [
    { date: '2026-10-25', label: 'Lars hat ab 13:00 Zeit', from: '13:00' },
    { date: '2026-10-26', label: 'Lars hat ab 17:30 Zeit', from: '17:30' },
    { date: '2026-10-27', label: 'Lars hat ab 17:30 Zeit', from: '17:30' },
    { date: '2026-10-28', label: 'Lars hat ab 17:30 Zeit', from: '17:30' },
    { date: '2026-10-29', label: 'Lars hat ab 17:30 Zeit', from: '17:30' },
  ],
  blockedWeekdays: [],
  timePresets: ['12:00', '14:00', '16:00', '18:00', '20:00'],
  maxSlots: 6,

  activities: [
    {
      id: 'cook',
      title: 'Charlie kocht',
      description: 'Ich bringe Wein und Nachtisch mit.',
      icon: 'pot',
    },
    {
      id: 'sushi',
      title: 'Sushi essen',
      description: 'Ich suche ein gutes Restaurant aus.',
      icon: 'sushi',
    },
    {
      id: 'bowling',
      title: 'Bowling',
      description: 'Wer verliert, zahlt die Getränke.',
      icon: 'bowling',
    },
    {
      id: 'lars-decides',
      title: 'Ich kann mich nicht entscheiden, Lars entscheidet.',
      description: 'Ich plane etwas Schönes. Lass dich überraschen.',
      icon: 'dice',
      recommended: true,
      badge: 'Empfohlen',
    },
  ],
  allowMultiple: false,

  texts: {
    documentTitle: 'Für Charlie',
    shareDescription: 'Eine Frage von Lars.',
    brand: 'Für Charlie',
    stepAnnouncement: (step, total, title) => `Schritt ${step} von ${total}: ${title}`,
    back: 'Zurück',
    next: 'Weiter',
    darkMode: 'Dunkler Modus',

    question: {
      title: 'Die Frage',
      eyebrow: 'Eine Frage von Lars',
      headline: `${names.her}, gehst du mit mir auf ein *Date*?`,
      yes: 'Ja',
      no: 'Nein',
      escapes: [
        'Netter Versuch.',
        'Knapp daneben.',
        'Der Knopf ist schüchtern.',
        'Fast.',
        `${names.horse} sagt Ja.`,
        'Der Knopf ist heute nicht erreichbar.',
      ],
    },
    when: {
      title: 'Wann?',
      headline: 'Wann hast du Zeit?',
      lead: 'Wähle einen Tag und eine oder mehrere Uhrzeiten. Gerne mehrere Vorschläge.',
      prevMonth: 'Vorheriger Monat',
      nextMonth: 'Nächster Monat',
      pickDayHint: 'Wähle zuerst einen Tag im Kalender.',
      timesTitle: 'Uhrzeit',
      timesFor: (day) => `Uhrzeit am ${day}`,
      customTime: 'Andere Uhrzeit',
      customTimeLabel: 'Eigene Uhrzeit',
      add: 'Hinzufügen',
      duplicate: 'Diesen Termin hast du schon gewählt.',
      maxReached: (max) => `Maximal ${max} Termine. Entferne einen, um einen neuen zu wählen.`,
      slotsTitle: 'Deine Vorschläge',
      slotsEmpty: 'Noch keine Termine gewählt.',
      remove: (slot) => `${slot} entfernen`,
      blockedFallbackReason: 'Nicht verfügbar',
      highlightLegend: 'Lars hat Zeit',
      pastTime: 'Diese Uhrzeit ist heute schon vorbei.',
    },
    what: {
      title: 'Was?',
      headline: 'Was machen wir?',
      leadSingle: 'Such dir etwas aus.',
      leadMultiple: 'Such dir aus, worauf du Lust hast. Mehrere sind möglich.',
    },
    note: {
      title: 'Notiz',
      headline: 'Fast geschafft.',
      lead: 'Schau noch einmal drüber und schick es ab.',
      label: 'Möchtest du mir noch etwas sagen?',
      optional: 'Optional',
      summaryTitle: 'Zusammenfassung',
      summarySlots: 'Termine',
      summaryActivity: 'Aktivität',
      edit: 'Ändern',
      submit: 'Absenden',
      sending: 'Wird gesendet',
      errorTitle: 'Das hat nicht geklappt.',
      errorBody:
        'Deine Antworten sind gespeichert. Prüfe deine Verbindung und versuche es noch einmal.',
      retry: 'Erneut versuchen',
    },
    done: {
      title: 'Fertig',
      eyebrow: 'Antwort gesendet',
      headline: 'Hervorragend.',
      body: `Deine Antwort ist angekommen. Ich melde mich bei dir, ${names.her}.`,
    },
    email: {
      subject: `${names.her} hat geantwortet`,
      fromName: 'Date-Website',
      intro: `${names.her} hat Ja gesagt.`,
      slots: 'Termine',
      activity: 'Aktivität',
      note: 'Notiz',
      noNote: '(keine)',
      neinAttempts: 'Nein-Versuche',
      sentAt: 'Gesendet',
    },
  },
};
