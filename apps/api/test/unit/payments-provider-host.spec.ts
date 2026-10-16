import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../src/config/env';
import { MpesaService } from '../../src/modules/payments/mpesa.service';
import { PesapalService } from '../../src/modules/payments/pesapal.service';

/**
 * Which host each payment provider actually calls, and what the API says about
 * it at start-up.
 *
 * `MPESA_ENV` / `PESAPAL_ENV` exist so a `NODE_ENV=production` deployment can
 * take sandbox-only payments during the testing phase. Getting the host wrong
 * either way is expensive: live rails during testing move real money, and the
 * sandbox after go-live marks unpaid orders as paid.
 */

function configWith(env: Partial<Env>): ConfigService<Env, true> {
  const values: Partial<Env> = {
    MPESA_CONSUMER_KEY: 'key',
    MPESA_CONSUMER_SECRET: 'secret',
    MPESA_SHORTCODE: '174379',
    MPESA_PASSKEY: 'passkey',
    PESAPAL_CONSUMER_KEY: 'key',
    PESAPAL_CONSUMER_SECRET: 'secret',
    ...env,
  };
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
}

/** The URL the first provider call went to; the call itself is made to fail. */
async function hostCalled(request: () => Promise<unknown>): Promise<string> {
  const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('stubbed'));
  await expect(request()).rejects.toThrow();
  return new URL(String(fetchSpy.mock.calls[0][0])).origin;
}

afterEach(() => jest.restoreAllMocks());

describe('M-Pesa host', () => {
  const host = (env: Partial<Env>) => {
    const mpesa = new MpesaService(configWith(env));
    return hostCalled(() => mpesa.getAccessToken());
  };

  it('is live Daraja in production by default', async () => {
    await expect(host({ NODE_ENV: 'production' })).resolves.toBe('https://api.safaricom.co.ke');
  });

  it('is the Daraja sandbox in production when MPESA_ENV=sandbox', async () => {
    await expect(host({ NODE_ENV: 'production', MPESA_ENV: 'sandbox' })).resolves.toBe(
      'https://sandbox.safaricom.co.ke',
    );
  });

  it('is the Daraja sandbox outside production', async () => {
    await expect(host({ NODE_ENV: 'development' })).resolves.toBe(
      'https://sandbox.safaricom.co.ke',
    );
  });
});

describe('Pesapal host', () => {
  const host = (env: Partial<Env>) => {
    const pesapal = new PesapalService(configWith(env));
    return hostCalled(() => pesapal.getAccessToken());
  };

  it('is live Pesapal in production by default', async () => {
    await expect(host({ NODE_ENV: 'production' })).resolves.toBe('https://pay.pesapal.com');
  });

  it('is the Pesapal sandbox in production when PESAPAL_ENV=sandbox', async () => {
    await expect(host({ NODE_ENV: 'production', PESAPAL_ENV: 'sandbox' })).resolves.toBe(
      'https://cybqa.pesapal.com',
    );
  });

  it('is unaffected by MPESA_ENV', async () => {
    await expect(host({ NODE_ENV: 'production', MPESA_ENV: 'sandbox' })).resolves.toBe(
      'https://pay.pesapal.com',
    );
  });
});

describe('start-up warning', () => {
  it('warns when a production deployment is pinned to a sandbox', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    new MpesaService(configWith({ NODE_ENV: 'production', MPESA_ENV: 'sandbox' })).onModuleInit();
    new PesapalService(
      configWith({ NODE_ENV: 'production', PESAPAL_ENV: 'sandbox' }),
    ).onModuleInit();

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toMatch(/M-Pesa is using its SANDBOX in production.*MPESA_ENV/);
    expect(warn.mock.calls[1][0]).toMatch(/Pesapal is using its SANDBOX.*PESAPAL_ENV/);
  });

  it('stays quiet when the sandbox is the default anyway, or production is live', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    new MpesaService(configWith({ NODE_ENV: 'development' })).onModuleInit();
    new MpesaService(configWith({ NODE_ENV: 'development', MPESA_ENV: 'sandbox' })).onModuleInit();
    new MpesaService(configWith({ NODE_ENV: 'production' })).onModuleInit();
    new PesapalService(configWith({ NODE_ENV: 'production' })).onModuleInit();

    expect(warn).not.toHaveBeenCalled();
  });
});
