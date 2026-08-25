import { supportsNativeNotifications } from '../../src/utils/runtime-environment';

describe('runtime environment capabilities', () => {
  it('disables native notifications inside Expo Go', () => {
    expect(supportsNativeNotifications('storeClient')).toBe(false);
  });

  it.each(['bare', 'standalone'])('keeps native notifications enabled in %s builds', (environment) => {
    expect(supportsNativeNotifications(environment)).toBe(true);
  });
});
