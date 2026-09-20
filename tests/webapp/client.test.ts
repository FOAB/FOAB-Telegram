import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebAppApiClient } from '../../webapp/src/api.js';

const csrfOne = 'a'.repeat(43);
const csrfTwo = 'b'.repeat(43);
const session = (csrfToken: string) => ({
  csrfToken,
  expiresAt: '2026-09-20T16:00:00.000Z',
  user: { id: 1_000_000_001, languageCode: 'pt-BR', privateLocale: 'pt-BR' },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

afterEach(() => vi.unstubAllGlobals());

describe('Mini App client session recovery', () => {
  it('restores a missing CSRF value before saving a preference', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const fetchMock = vi.fn(async (path: string, init: RequestInit) => {
      if (path === '/api/session' && init.method === 'GET') return json(session(csrfOne));
      expect(path).toBe('/api/preferences');
      expect(init.method).toBe('PATCH');
      expect((init.headers as Record<string, string>)['x-foab-csrf']).toBe(csrfOne);
      return json({ privateLocale: 'es-ES' });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await new WebAppApiClient().updatePrivateLocale('es-ES')).toBe('es-ES');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes a rejected CSRF value and retries one write', async () => {
    vi.stubGlobal('document', { cookie: '' });
    let getCount = 0;
    let patchCount = 0;
    const fetchMock = vi.fn(async (path: string, init: RequestInit) => {
      if (path === '/api/session' && init.method === 'GET') {
        getCount += 1;
        return json(session(getCount === 1 ? csrfOne : csrfTwo));
      }
      patchCount += 1;
      expect((init.headers as Record<string, string>)['x-foab-csrf']).toBe(
        patchCount === 1 ? csrfOne : csrfTwo,
      );
      return patchCount === 1
        ? json({ error: 'csrf_denied' }, 403)
        : json({ privateLocale: 'es-ES' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new WebAppApiClient();
    await client.getSession();
    expect(await client.updatePrivateLocale('es-ES')).toBe('es-ES');
    expect(getCount).toBe(2);
    expect(patchCount).toBe(2);
  });

  it('reopens a lost server session with signed Telegram init data before retrying', async () => {
    vi.stubGlobal('document', { cookie: '' });
    let patchCount = 0;
    const fetchMock = vi.fn(async (path: string, init: RequestInit) => {
      if (path === '/api/session' && init.method === 'GET') return json(session(csrfOne));
      if (path === '/api/session' && init.method === 'POST') {
        expect(init.body).toBe(JSON.stringify({ initData: 'synthetic-signed-init-data' }));
        return json(session(csrfTwo), 201);
      }
      patchCount += 1;
      return patchCount === 1
        ? json({ error: 'unauthorized' }, 401)
        : json({ privateLocale: 'es-ES' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new WebAppApiClient(() => 'synthetic-signed-init-data');
    await client.getSession();
    expect(await client.updatePrivateLocale('es-ES')).toBe('es-ES');
    expect(patchCount).toBe(2);
  });
});
