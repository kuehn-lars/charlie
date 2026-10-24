import type { Config } from '../config';
import { formatInstant, formatSlotLong } from './dates';
import type { Slot } from './schedule';

export const ENDPOINT = 'https://api.web3forms.com/submit';
export const TIMEOUT_MS = 15_000;

export interface Answers {
  slots: readonly Slot[];
  activities: readonly string[];
  note: string;
  neinCount: number;
}

export interface Payload {
  access_key: string;
  subject: string;
  from_name: string;
  message: string;
  botcheck: boolean;
}

type PayloadConfig = Pick<Config, 'WEB3FORMS_ACCESS_KEY' | 'activities' | 'texts'>;

export function buildMessage(cfg: PayloadConfig, answers: Answers, now: Date): string {
  const t = cfg.texts.email;
  const activity = answers.activities
    .map((id) => cfg.activities.find((a) => a.id === id)?.title ?? id)
    .join(', ');
  const note = answers.note.trim();
  return [
    t.intro,
    '',
    `${t.slots}:`,
    ...answers.slots.map((s) => `- ${formatSlotLong(s.date, s.time)}`),
    '',
    `${t.activity}: ${activity}`,
    '',
    `${t.note}:`,
    note || t.noNote,
    '',
    `${t.neinAttempts}: ${answers.neinCount}`,
    `${t.sentAt}: ${formatInstant(now)}`,
  ].join('\n');
}

export function buildPayload(
  cfg: PayloadConfig,
  answers: Answers,
  now: Date,
  botcheck: boolean,
): Payload {
  return {
    access_key: cfg.WEB3FORMS_ACCESS_KEY,
    subject: cfg.texts.email.subject,
    from_name: cfg.texts.email.fromName,
    message: buildMessage(cfg, answers, now),
    botcheck,
  };
}

export type SubmitResult = { ok: true } | { ok: false; reason: string };

export interface SubmitOptions {
  dryRun: boolean;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Sends the payload. Success means HTTP response *and* `{ success: true }` in
 * the body: Web3Forms reports some failures (bad key, spam) with a JSON body
 * and a non-2xx status, others with 200 and success: false.
 */
export async function submit(payload: Payload, opts: SubmitOptions): Promise<SubmitResult> {
  if (opts.dryRun) {
    console.info('[DRY_RUN] Web3Forms payload', payload);
    return { ok: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, opts.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await (opts.fetch ?? fetch)(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as {
      success?: unknown;
      message?: unknown;
    } | null;
    if (body?.success === true) return { ok: true };
    const message = typeof body?.message === 'string' ? body.message : `HTTP ${res.status}`;
    return { ok: false, reason: message };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
