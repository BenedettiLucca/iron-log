import {
  consumePendingToast,
  setPendingToast,
} from '@/src/utils/flash-toast';

describe('flash toast', () => {
  it('delivers a pending message exactly once on the destination screen', () => {
    const toast = { message: 'Rotina salva', type: 'success' as const };

    setPendingToast(toast);

    expect(consumePendingToast()).toEqual(toast);
    expect(consumePendingToast()).toBeNull();
  });

  it('replaces an older pending message with the latest navigation result', () => {
    setPendingToast({ message: 'Antiga', type: 'info' });
    setPendingToast({ message: 'Nova', type: 'success' });

    expect(consumePendingToast()).toEqual({ message: 'Nova', type: 'success' });
  });
});
