/**
 * Standard screen states
 */
export type ScreenStatus = 'loading' | 'error' | 'empty' | 'content';

export interface ScreenStateInput {
  isLoading: boolean;
  hasError: boolean;
  hasContent: boolean;
  errorMessage?: string;
}

export interface ScreenStateResult {
  status: ScreenStatus;
  errorMessage?: string;
}

/**
 * Pure helper to resolve screen state from common flags.
 * Priority: Loading > Error > Empty > Content
 */
export function resolveScreenState({
  isLoading,
  hasError,
  hasContent,
  errorMessage,
}: ScreenStateInput): ScreenStateResult {
  if (isLoading) {
    return { status: 'loading' };
  }

  if (hasError) {
    return {
      status: 'error',
      errorMessage: errorMessage || 'Unknown error',
    };
  }

  if (!hasContent) {
    return { status: 'empty' };
  }

  return { status: 'content' };
}
