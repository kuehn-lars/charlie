import { describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { ENDPOINT, buildMessage, buildPayload, submit } from '../../src/submit';

const answers = {
  slots: [
    { date: '2026-10-31', time: '19:30' },
    { date: '2026-11-07', time: '12:00' },
  ],
  activities: ['lars-decides'],
  note: '  Freu mich!  ',
  neinCount: 3,
};
const now = new Date('2026-10-24T12:05:00Z');

describe('payload', () => {
  it('builds a readable German message', () => {
    expect(buildMessage(config, answers, now)).toBe(
      [
        'Charlie hat Ja gesagt.',
        '',
        'Termine:',
        '- Samstag, 31. Oktober 2026 um 19:30 Uhr',
        '- Samstag, 7. November 2026 um 12:00 Uhr',
        '',
        'Aktivität: Ich kann mich nicht entscheiden, Lars entscheidet.',
        '',
        'Notiz:',
        'Freu mich!',
        '',
        'Nein-Versuche: 3',
        'Gesendet: Samstag, 24. Oktober 2026 um 14:05 Uhr',
      ].join('\n'),
    );
  });

  it('marks an empty note', () => {
    expect(buildMessage(config, { ...answers, note: ' ' }, now)).toContain('Notiz:\n(keine)');
  });

  it('carries subject, sender and honeypot', () => {
    const p = buildPayload(config, answers, now, false);
    expect(p).toMatchObject({
      access_key: config.WEB3FORMS_ACCESS_KEY,
      subject: 'Charlie hat geantwortet',
      from_name: 'Date-Website',
      botcheck: false,
    });
  });
});

describe('submit', () => {
  const payload = buildPayload(config, answers, now, false);
  const respond = (body: unknown, status = 200) =>
    vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('logs instead of sending in dry-run mode', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await expect(submit(payload, { dryRun: true, fetch })).resolves.toEqual({ ok: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('[DRY_RUN] Web3Forms payload', payload);
    info.mockRestore();
  });

  it('posts JSON and requires success: true', async () => {
    const fetch = respond({ success: true });
    await expect(submit(payload, { dryRun: false, fetch })).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  it('fails on success: false even with HTTP 200', async () => {
    const fetch = respond({ success: false, message: 'Invalid access key' });
    await expect(submit(payload, { dryRun: false, fetch })).resolves.toEqual({
      ok: false,
      reason: 'Invalid access key',
    });
  });

  it('fails on non-JSON error pages and network errors', async () => {
    const html = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(submit(payload, { dryRun: false, fetch: html })).resolves.toEqual({
      ok: false,
      reason: 'HTTP 502',
    });
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(submit(payload, { dryRun: false, fetch: offline })).resolves.toMatchObject({
      ok: false,
    });
  });

  it('times out', async () => {
    const hang = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    await expect(submit(payload, { dryRun: false, fetch: hang, timeoutMs: 10 })).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    });
  });
});
