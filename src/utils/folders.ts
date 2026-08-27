export const DEFAULT_FOLDER_NAME = 'Geral';
export const FOLDER_NAME_MAX_LENGTH = 50;

export type FolderNameValidationError = 'empty' | 'tooLong';

export function normalizeFolderName(name: string) {
  return name.trim();
}

export function validateFolderName(name: string): FolderNameValidationError | null {
  const normalized = normalizeFolderName(name);
  if (!normalized) return 'empty';
  if (normalized.length > FOLDER_NAME_MAX_LENGTH) return 'tooLong';
  return null;
}

export function isSameFolderName(left: string, right: string) {
  return normalizeFolderName(left).toLowerCase() === normalizeFolderName(right).toLowerCase();
}

export function getFolderChipNames(folderNames: string[]) {
  const uniqueNames: string[] = [];
  for (const folderName of folderNames.map(normalizeFolderName).filter(Boolean)) {
    const canonicalName = isSameFolderName(folderName, DEFAULT_FOLDER_NAME)
      ? DEFAULT_FOLDER_NAME
      : folderName;
    if (!uniqueNames.some((name) => isSameFolderName(name, canonicalName))) {
      uniqueNames.push(canonicalName);
    }
  }

  if (
    uniqueNames.length === 0 ||
    (uniqueNames.length === 1 && isSameFolderName(uniqueNames[0], DEFAULT_FOLDER_NAME))
  ) {
    return ['Todos'];
  }

  return ['Todos', ...uniqueNames];
}
