import { useState, useCallback } from 'react';
import type { DialogState } from '@/src/types';

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<DialogState>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, type?: 'default' | 'destructive') => {
    setDialog({ visible: true, title, message, onConfirm, type });
  }, []);

  const hideDialog = useCallback(() => {
    setDialog(prev => ({ ...prev, visible: false }));
  }, []);

  return { dialog, setDialog, showConfirm, hideDialog };
}
