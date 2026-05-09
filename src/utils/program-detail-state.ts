/**
 * Program detail fetch state machine.
 *
 * Encapsulates the loading/error/not-found state transitions
 * for fetching program details, ensuring no infinite blank-screen states.
 */

export type FetchStatus = 'idle' | 'loading' | 'success' | 'not_found' | 'error';

export interface ProgramDetailState {
  status: FetchStatus;
  errorMessage?: string;
}

/**
 * Computes the next state after a fetch attempt.
 * Pure function — easy to test without React/DB dependencies.
 */
export function resolveFetchState(params: {
  isLoading: boolean;
  hasProgram: boolean;
  hasError: boolean;
  errorMessage?: string;
}): ProgramDetailState {
  const { isLoading, hasProgram, hasError, errorMessage } = params;

  if (isLoading) {
    return { status: 'loading' };
  }

  if (hasError) {
    return { status: 'error', errorMessage: errorMessage || 'Unknown error' };
  }

  if (hasProgram) {
    return { status: 'success' };
  }

  // Not loading, no error, no program → not found
  return { status: 'not_found' };
}

/**
 * Returns the component to render based on fetch state.
 * Used by the detail screen to decide between loading/error/not-found/content.
 */
export function getDetailScreenView(state: ProgramDetailState): 'loading' | 'error' | 'not_found' | 'content' {
  switch (state.status) {
    case 'loading':
      return 'loading';
    case 'error':
      return 'error';
    case 'not_found':
      return 'not_found';
    case 'success':
      return 'content';
    case 'idle':
    default:
      return 'loading';
  }
}
