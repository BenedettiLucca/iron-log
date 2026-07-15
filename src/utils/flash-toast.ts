import type { ToastState } from '@/src/types';

type PendingToast = Pick<ToastState, 'message' | 'type'>;

let pendingToast: PendingToast | null = null;

export function setPendingToast(toast: PendingToast) {
  pendingToast = toast;
}

export function consumePendingToast() {
  const toast = pendingToast;
  pendingToast = null;
  return toast;
}
