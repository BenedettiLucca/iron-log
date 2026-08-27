import { folders, routines } from '@/src/db/schema';
import { FolderError, FolderService } from '@/services/FolderService';

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockTransaction = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/src/db/client', () => ({
  db: {
    select: () => ({ from: (...args: unknown[]) => mockSelect(...args) }),
    insert: (...args: unknown[]) => mockInsert(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/services/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

describe('FolderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockResolvedValue([
      { id: 1, name: 'Geral' },
      { id: 2, name: 'Push' },
    ]);
    mockTransaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      update: (table: unknown) => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({ run: jest.fn() })),
        })),
      }),
      delete: (table: unknown) => ({
        where: jest.fn(() => ({ run: jest.fn() })),
      }),
    }));
  });

  it('creates a trimmed custom folder and preserves the returned row', async () => {
    const returning = jest.fn().mockResolvedValue([{ id: 3, name: 'Leg' }]);
    mockInsert.mockReturnValue({
      values: jest.fn(() => ({ returning })),
    });

    await expect(FolderService.createFolder('  Leg  ')).resolves.toEqual({ id: 3, name: 'Leg' });
    expect(mockInsert).toHaveBeenCalledWith(folders);
  });

  it('rejects case-insensitive duplicate names before writing', async () => {
    await expect(FolderService.createFolder(' push ')).rejects.toMatchObject({
      code: 'duplicate',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('protects the default folder from rename and delete', async () => {
    await expect(FolderService.renameFolder(1, 'Base')).rejects.toBeInstanceOf(FolderError);
    await expect(FolderService.deleteFolder(1)).rejects.toMatchObject({ code: 'protected' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('renames the registry row and all assigned routines in one transaction', async () => {
    const txUpdate = jest.fn();
    mockTransaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      update: (table: unknown) => {
        txUpdate(table);
        return {
          set: jest.fn(() => ({ where: jest.fn(() => ({ run: jest.fn() })) })),
        };
      },
    }));

    await FolderService.renameFolder(2, 'Upper');

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenNthCalledWith(1, folders);
    expect(txUpdate).toHaveBeenNthCalledWith(2, routines);
  });

  it('moves routines to Geral before deleting a custom folder', async () => {
    const txUpdate = jest.fn();
    const txDelete = jest.fn();
    mockTransaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      update: (table: unknown) => {
        txUpdate(table);
        return {
          set: jest.fn(() => ({ where: jest.fn(() => ({ run: jest.fn() })) })),
        };
      },
      delete: (table: unknown) => {
        txDelete(table);
        return { where: jest.fn(() => ({ run: jest.fn() })) };
      },
    }));

    await FolderService.deleteFolder(2);

    expect(txUpdate).toHaveBeenCalledWith(routines);
    expect(txDelete).toHaveBeenCalledWith(folders);
  });

});
