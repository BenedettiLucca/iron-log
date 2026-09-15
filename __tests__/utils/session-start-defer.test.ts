import {
  createModalCloseDeferral,
} from '../../src/utils/session-start';
describe('createModalCloseDeferral (#144)', () => {
  it('does not navigate synchronously when deferred is invoked', () => {
    const deferral = createModalCloseDeferral();
    let navigated = false;
    deferral.defer(() => { navigated = true; });
    expect(navigated).toBe(false);
  });

  it('navigates exactly once after the modal close animations settle', async () => {
    const deferral = createModalCloseDeferral();
    let navigated = 0;
    deferral.defer(() => { navigated += 1; });
    await deferral.flush();
    expect(navigated).toBe(1);
  });

  it('deduplicates multiple deferred navigations (double-tap safe)', async () => {
    const deferral = createModalCloseDeferral();
    let navigated = 0;
    deferral.defer(() => { navigated += 1; });
    deferral.defer(() => { navigated += 1; });
    await deferral.flush();
    expect(navigated).toBe(1);
  });

  it('flush resolves even when nothing was deferred', async () => {
    const deferral = createModalCloseDeferral();
    await expect(deferral.flush()).resolves.toBeUndefined();
  });
});
