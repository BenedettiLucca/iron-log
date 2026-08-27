import fs from 'node:fs';
import path from 'node:path';
import { source } from './jsx-source';

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { all: () => unknown[] };
  close: () => void;
};

// Node 22 is the project's supported test runtime; node:sqlite keeps this test portable.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (filename: string) => SqliteDatabase;
};

describe('folder management wiring', () => {
  const root = path.resolve(__dirname, '../..');

  it('ships a persistent folder registry and backfills existing assignments', () => {
    const schema = fs.readFileSync(path.join(root, 'src/db/schema.ts'), 'utf8');
    const migration = fs.readFileSync(path.join(root, 'drizzle/0020_low_microchip.sql'), 'utf8');

    expect(schema).toContain("sqliteTable('folders'");
    expect(schema).toContain("name: text('name').notNull().unique()");
    expect(migration).toContain("INSERT OR IGNORE INTO `folders` (`name`) VALUES ('Geral')");
    expect(migration).toContain('SET `folder` = trim(`folder`)');
    expect(migration).toContain("lower(`folder`) = lower('Geral')");
    expect(migration).toContain('SELECT MIN(`candidate`.`folder`)');
    expect(migration).toContain('SELECT DISTINCT `folder`');
  });

  it('canonicalizes case variants while backfilling legacy assignments', () => {
    const migration = fs.readFileSync(path.join(root, 'drizzle/0020_low_microchip.sql'), 'utf8');
    const sqlite = new DatabaseSync(':memory:');

    try {
      sqlite.exec(`
        CREATE TABLE routines (id INTEGER PRIMARY KEY, folder TEXT);
        INSERT INTO routines (id, folder) VALUES
          (1, '  Push  '),
          (2, 'push'),
          (3, 'geral'),
          (4, NULL),
          (5, ''),
          (6, 'Leg');
      `);
      sqlite.exec(migration.replaceAll('--> statement-breakpoint', ''));

      expect(sqlite.prepare('SELECT folder FROM routines ORDER BY id').all()).toEqual([
        { folder: 'Push' },
        { folder: 'Push' },
        { folder: 'Geral' },
        { folder: 'Geral' },
        { folder: 'Geral' },
        { folder: 'Leg' },
      ]);
      expect(sqlite.prepare('SELECT name FROM folders ORDER BY id').all()).toEqual([
        { name: 'Geral' },
        { name: 'Push' },
        { name: 'Leg' },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('exposes folder management from the routines screen', () => {
    const routinesScreen = source('app/(tabs)/routines.tsx');

    expect(routinesScreen).toContain('FolderManagerModal');
    expect(routinesScreen).toContain("`+ ${t('routines.newFolder')}`");
    expect(routinesScreen).toContain('onRename={handleRenameFolder}');
    expect(routinesScreen).toContain('onDelete={handleDeleteFolder}');
  });

  it('lets the editor choose a folder and treats it as dirty form state', () => {
    const editor = source('app/routines/editor.tsx');

    expect(editor).toContain('const [folder, setFolder]');
    expect(editor).toContain('folderOptions.map');
    expect(editor).toContain('.set({ name: normalizedName, description, folder })');
    expect(editor).toContain('.values({ name: normalizedName, description, folder })');
    expect(editor).toContain('loadedFolder');
    expect(editor).toContain('currentSnapshot = [name, description, folder');
  });

  it('keeps the folder when a template becomes a routine', () => {
    const templates = source('app/routines/templates.tsx');

    expect(templates).toContain('folder: routine.folder || DEFAULT_FOLDER_NAME');
    expect(templates).toContain('folder: template.folder');
  });
});
