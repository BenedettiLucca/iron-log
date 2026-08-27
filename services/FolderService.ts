import { db } from '@/src/db/client';
import { folders, routines } from '@/src/db/schema';
import type { Folder } from '@/src/types';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_FOLDER_NAME,
  isSameFolderName,
  normalizeFolderName,
  validateFolderName,
  type FolderNameValidationError,
} from '@/src/utils/folders';

export type FolderErrorCode = FolderNameValidationError | 'protected' | 'duplicate' | 'notFound' | 'database';

export class FolderError extends Error {
  constructor(public readonly code: FolderErrorCode) {
    super(code);
    this.name = 'FolderError';
  }
}

function normalizeNewFolderName(rawName: string) {
  const name = normalizeFolderName(rawName);
  const validationError = validateFolderName(name);
  if (validationError) throw new FolderError(validationError);
  if (isSameFolderName(name, DEFAULT_FOLDER_NAME)) {
    throw new FolderError('protected');
  }
  return name;
}

async function getFolderById(id: number): Promise<Folder | null> {
  const allFolders = await getAllFolders();
  return allFolders.find((folder) => folder.id === id) ?? null;
}

export async function getAllFolders(): Promise<Folder[]> {
  const rows = await db.select().from(folders);
  return [...rows].sort((left, right) => left.id - right.id);
}

export async function createFolder(rawName: string): Promise<Folder> {
  const name = normalizeNewFolderName(rawName);
  const existingFolders = await getAllFolders();
  if (existingFolders.some((folder) => isSameFolderName(folder.name, name))) {
    throw new FolderError('duplicate');
  }

  const created = await db.insert(folders).values({ name }).returning();
  if (!created[0]) throw new FolderError('database');
  return created[0];
}

export async function renameFolder(id: number, rawName: string): Promise<Folder> {
  const current = await getFolderById(id);
  if (!current) throw new FolderError('notFound');
  if (isSameFolderName(current.name, DEFAULT_FOLDER_NAME)) {
    throw new FolderError('protected');
  }

  const name = normalizeNewFolderName(rawName);
  const existingFolders = await getAllFolders();
  if (existingFolders.some((folder) => folder.id !== id && isSameFolderName(folder.name, name))) {
    throw new FolderError('duplicate');
  }

  db.transaction((tx) => {
    tx.update(folders)
      .set({ name })
      .where(eq(folders.id, id))
      .run();
    tx.update(routines)
      .set({ folder: name })
      .where(eq(routines.folder, current.name))
      .run();
  });

  return { ...current, name };
}

export async function deleteFolder(id: number): Promise<void> {
  const current = await getFolderById(id);
  if (!current) throw new FolderError('notFound');
  if (isSameFolderName(current.name, DEFAULT_FOLDER_NAME)) {
    throw new FolderError('protected');
  }

  db.transaction((tx) => {
    tx.update(routines)
      .set({ folder: DEFAULT_FOLDER_NAME })
      .where(eq(routines.folder, current.name))
      .run();
    tx.delete(folders)
      .where(eq(folders.id, id))
      .run();
  });
}

export const FolderService = {
  getAllFolders,
  createFolder,
  renameFolder,
  deleteFolder,
};
