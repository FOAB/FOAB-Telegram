import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateTelegramWebAppInitData } from '../../src/webapp/telegram-init-data.js';

const syntheticToken = 'synthetic-webapp-bot-token';
const syntheticNow = 1_800_000_900;

describe('Telegram Mini App init data validation', () => {
  it('accepts a valid synthetic signature and returns only the authenticated identity', () => {
    const raw = signedInitData({
      auth_date: String(syntheticNow - 30),
      can_send_after: '30',
      chat: JSON.stringify({ id: -100_100_000_001, type: 'supergroup', title: 'Synthetic Group' }),
      chat_join_request_query_id: 'synthetic-join-query-001',
      query_id: 'synthetic-query-001',
      signature: 'synthetic-ed25519-signature',
      user: JSON.stringify({
        id: 1_000_000_001,
        allows_write_to_pm: true,
        first_name: 'Synthetic',
        photo_url: 'https://cdn.example.invalid/synthetic.jpg',
        username: 'synthetic_user',
      }),
    });

    expect(validateTelegramWebAppInitData(raw, syntheticToken, syntheticNow)).toEqual({
      user: {
        id: 1_000_000_001,
        isBot: false,
        languageCode: null,
      },
      authDate: new Date((syntheticNow - 30) * 1_000),
      queryId: 'synthetic-query-001',
    });
  });

  it('rejects tampering, stale data, duplicate fields, and unknown fields', () => {
    const validFields = {
      auth_date: String(syntheticNow - 30),
      user: JSON.stringify({ id: 1_000_000_001, is_bot: false }),
    };
    const valid = signedInitData(validFields);

    expect(validateTelegramWebAppInitData(`${valid}&auth_date=1`, syntheticToken, syntheticNow)).toBeNull();
    expect(validateTelegramWebAppInitData(valid, syntheticToken, syntheticNow + 901)).toBeNull();
    expect(validateTelegramWebAppInitData(`${valid}&unexpected=value`, syntheticToken, syntheticNow)).toBeNull();
  });

  it('rejects malformed signed identities and signatures from another bot token', () => {
    const invalidUser = signedInitData({
      auth_date: String(syntheticNow - 30),
      user: JSON.stringify({ id: 'not-a-number', is_bot: false }),
    });
    const valid = signedInitData({
      auth_date: String(syntheticNow - 30),
      user: JSON.stringify({ id: 1_000_000_001, is_bot: false }),
    });

    expect(validateTelegramWebAppInitData(invalidUser, syntheticToken, syntheticNow)).toBeNull();
    expect(validateTelegramWebAppInitData(valid, 'another-synthetic-token', syntheticNow)).toBeNull();
  });

  it('rejects signatures produced with the HMAC key and message reversed', () => {
    const fields = {
      auth_date: String(syntheticNow - 30),
      user: JSON.stringify({ id: 1_000_000_001, is_bot: false }),
    };
    const params = new URLSearchParams(fields);
    const dataCheckString = [...params.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const reversedSecret = createHmac('sha256', syntheticToken).update('WebAppData').digest();
    params.set('hash', createHmac('sha256', reversedSecret).update(dataCheckString).digest('hex'));

    expect(validateTelegramWebAppInitData(params.toString(), syntheticToken, syntheticNow)).toBeNull();
  });
});

function signedInitData(fields: Readonly<Record<string, string>>): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(syntheticToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}
