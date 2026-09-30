import { parseClientInfo } from '../../src/common/client-info';

/**
 * Unit tests for the client-identity header parser (SPEC-11 B-2 / §9).
 *
 * The header is caller-controlled and ends up in the request log and a database
 * column, so the interesting cases are the hostile ones.
 */
describe('parseClientInfo', () => {
  it('reads the app headers', () => {
    expect(
      parseClientInfo({ 'x-optex-client': 'ios', 'x-optex-client-version': '1.0.0+3' }),
    ).toEqual({ channel: 'ios', client: 'ios', version: '1.0.0+3' });

    expect(parseClientInfo({ 'x-optex-client': 'android' })).toEqual({
      channel: 'android',
      client: 'android',
      version: null,
    });
  });

  it('treats a request that says nothing as web — the storefront has never sent the header', () => {
    expect(parseClientInfo({})).toEqual({ channel: 'web', client: null, version: null });
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(parseClientInfo({ 'x-optex-client': '  IOS ' })).toMatchObject({ channel: 'ios' });
  });

  it('keeps an unrecognised client for the log but attributes it to web', () => {
    // `curl` and a pre-release build's `flutter` are real values worth seeing in
    // the log; neither is an app we can attribute an order to.
    expect(parseClientInfo({ 'x-optex-client': 'curl' })).toEqual({
      channel: 'web',
      client: 'curl',
      version: null,
    });
    expect(parseClientInfo({ 'x-optex-client': 'flutter' })).toMatchObject({ channel: 'web' });
  });

  it.each([
    ['whitespace inside', 'i os'],
    ['a shell-ish injection', 'ios; rm -rf /'],
    ['a newline (log injection)', 'ios\nlevel=fatal'],
    ['a leading dash', '-ios'],
    ['non-ASCII', 'ïos'],
    ['an oversized value', 'a'.repeat(33)],
    ['an empty value', ''],
  ])('drops a client value with %s', (_label, value) => {
    expect(parseClientInfo({ 'x-optex-client': value })).toEqual({
      channel: 'web',
      client: null,
      version: null,
    });
  });

  it('never lets a hostile value through to become a channel', () => {
    // Only two values may ever leave this function as a mobile channel.
    for (const value of ['ios ', 'ios;', 'ios/../', 'IOS\n', 'ios\0']) {
      const { channel } = parseClientInfo({ 'x-optex-client': value });
      expect(['web', 'ios']).toContain(channel);
    }
    expect(parseClientInfo({ 'x-optex-client': 'ios;' }).channel).toBe('web');
    expect(parseClientInfo({ 'x-optex-client': 'ios\0' }).channel).toBe('web');
  });

  it.each([
    ['1.0.0+1', '1.0.0+1'],
    ['2.14.3', '2.14.3'],
    ['1.0.0-beta.2+45', '1.0.0-beta.2+45'],
  ])('accepts the version %s', (input, expected) => {
    expect(parseClientInfo({ 'x-optex-client-version': input }).version).toBe(expected);
  });

  it.each([
    ['whitespace', '1.0 .0'],
    ['a newline', '1.0.0\nX'],
    ['a quote', '1.0.0"'],
    ['an oversized value', '1'.repeat(33)],
  ])('drops a version with %s', (_label, value) => {
    expect(parseClientInfo({ 'x-optex-client-version': value }).version).toBeNull();
  });

  it('takes the first value when a header arrives more than once', () => {
    expect(parseClientInfo({ 'x-optex-client': ['android', 'ios'] })).toMatchObject({
      channel: 'android',
    });
  });
});
