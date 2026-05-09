import { resolveFetchState, getDetailScreenView, ProgramDetailState } from '../../src/utils/program-detail-state';

describe('resolveFetchState', () => {
  it('returns loading when isLoading is true', () => {
    expect(resolveFetchState({ isLoading: true, hasProgram: false, hasError: false }))
      .toEqual({ status: 'loading' });
  });

  it('returns loading even if hasProgram is true while loading', () => {
    // Stale data from previous fetch — still show loading
    expect(resolveFetchState({ isLoading: true, hasProgram: true, hasError: false }))
      .toEqual({ status: 'loading' });
  });

  it('returns success when loading done and program exists', () => {
    expect(resolveFetchState({ isLoading: false, hasProgram: true, hasError: false }))
      .toEqual({ status: 'success' });
  });

  it('returns not_found when loading done, no error, no program', () => {
    // This is the blank-screen bug: old code kept isLoading=true
    expect(resolveFetchState({ isLoading: false, hasProgram: false, hasError: false }))
      .toEqual({ status: 'not_found' });
  });

  it('returns error when hasError is true', () => {
    expect(resolveFetchState({ isLoading: false, hasProgram: false, hasError: true, errorMessage: 'DB read failed' }))
      .toEqual({ status: 'error', errorMessage: 'DB read failed' });
  });

  it('returns error with default message when no errorMessage provided', () => {
    expect(resolveFetchState({ isLoading: false, hasProgram: false, hasError: true }))
      .toEqual({ status: 'error', errorMessage: 'Unknown error' });
  });

  it('prioritizes error over not_found', () => {
    const result = resolveFetchState({ isLoading: false, hasProgram: false, hasError: true });
    expect(result.status).toBe('error');
  });
});

describe('getDetailScreenView', () => {
  it('returns loading for idle state', () => {
    expect(getDetailScreenView({ status: 'idle' })).toBe('loading');
  });

  it('returns loading for loading state', () => {
    expect(getDetailScreenView({ status: 'loading' })).toBe('loading');
  });

  it('returns content for success state', () => {
    expect(getDetailScreenView({ status: 'success' })).toBe('content');
  });

  it('returns not_found for not_found state', () => {
    expect(getDetailScreenView({ status: 'not_found' })).toBe('not_found');
  });

  it('returns error for error state', () => {
    expect(getDetailScreenView({ status: 'error', errorMessage: 'fail' })).toBe('error');
  });
});
