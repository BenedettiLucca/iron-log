import { resolveScreenState } from '../../src/utils/screen-state';

describe('resolveScreenState', () => {
  it('returns loading while a fetch is in flight, even with stale content', () => {
    expect(resolveScreenState({ isLoading: true, hasError: false, hasContent: true }))
      .toEqual({ status: 'loading' });
  });

  it('returns error after loading fails and exposes the message for retry UI', () => {
    expect(resolveScreenState({ isLoading: false, hasError: true, hasContent: false, errorMessage: 'DB failed' }))
      .toEqual({ status: 'error', errorMessage: 'DB failed' });
  });

  it('returns empty only after loading completes without content or errors', () => {
    expect(resolveScreenState({ isLoading: false, hasError: false, hasContent: false }))
      .toEqual({ status: 'empty' });
  });

  it('returns content only after loading completes with content and no errors', () => {
    expect(resolveScreenState({ isLoading: false, hasError: false, hasContent: true }))
      .toEqual({ status: 'content' });
  });

  it('prioritizes errors over empty states once loading is complete', () => {
    expect(resolveScreenState({ isLoading: false, hasError: true, hasContent: false }))
      .toEqual({ status: 'error', errorMessage: 'Unknown error' });
  });
});
