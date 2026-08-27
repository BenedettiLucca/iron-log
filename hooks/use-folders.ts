import { useCallback, useState } from 'react';
import { FolderService, FolderError } from '@/services/FolderService';
import { logger } from '@/services/logger';
import type { Folder } from '@/src/types';

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);

  const fetchFolders = useCallback(async () => {
    try {
      setFolders(await FolderService.getAllFolders());
    } catch (error) {
      logger.error('Failed to fetch folders', error);
    }
  }, []);

  const createFolder = useCallback(async (name: string) => {
    try {
      const created = await FolderService.createFolder(name);
      setFolders((current) => [...current, created].sort((left, right) => left.id - right.id));
      return created;
    } catch (error) {
      if (!(error instanceof FolderError)) logger.error('Failed to create folder', error);
      throw error;
    }
  }, []);

  const renameFolder = useCallback(async (id: number, name: string) => {
    try {
      const renamed = await FolderService.renameFolder(id, name);
      setFolders((current) => current.map((folder) => folder.id === id ? renamed : folder));
      return renamed;
    } catch (error) {
      if (!(error instanceof FolderError)) logger.error('Failed to rename folder', error);
      throw error;
    }
  }, []);

  const deleteFolder = useCallback(async (id: number) => {
    try {
      await FolderService.deleteFolder(id);
      setFolders((current) => current.filter((folder) => folder.id !== id));
    } catch (error) {
      if (!(error instanceof FolderError)) logger.error('Failed to delete folder', error);
      throw error;
    }
  }, []);

  return {
    folders,
    fetchFolders,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}
