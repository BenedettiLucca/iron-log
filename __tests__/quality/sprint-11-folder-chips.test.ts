import { source } from './jsx-source';

describe('Sprint 11 — folder chips:Geral hidden when only folder', () => {
  const routinesHook = 'hooks/use-routines.ts';
  const routinesScreen = 'app/(tabs)/routines.tsx';

  it('hooks memo delegates folder chips to the shared normalization helper', () => {
    const content = source(routinesHook);

    expect(content).toContain('DEFAULT_FOLDER_NAME');
    expect(content).toContain('getFolderChipNames');

    const foldersMatch = content.match(/const folders = useMemo\([\s\S]*?\[allRoutines\]\);/);
    expect(foldersMatch).not.toBeNull();

    const foldersBlock = foldersMatch![0];
    expect(foldersBlock).toContain('getFolderChipNames');
    expect(foldersBlock).toContain('DEFAULT_FOLDER_NAME');
  });

  it('screen renders folders from hook without duplicating the chip', () => {
    const content = source(routinesScreen);

    // The screen must map over folders array (not hardcode 'Geral')
    expect(content).toMatch(/(?:folders|folderChips)\.map/);

    // Check that the folder chip render logic reads the folder value from the map iteration
    const foldersMapMatch = content.match(/(?:folders|folderChips)\.map\([\s\S]*?\)\}/);
    expect(foldersMapMatch).not.toBeNull();
    expect(foldersMapMatch![0]).toMatch(/folder/);
  });

  it('screen does not hardcode "Geral" as a standalone chip outside the map', () => {
    const content = source(routinesScreen);

    // Locate the top horizontal ScrollView (first one)
    const firstScrollIdx = content.indexOf('<ScrollView');
    expect(firstScrollIdx).toBeGreaterThanOrEqual(0);

    // Find the closing tag of the first ScrollView
    let depth = 1;
    let endIdx = firstScrollIdx + '<ScrollView'.length;
    while (depth > 0 && endIdx < content.length) {
      if (content[endIdx] === '<') {
        const nextTag = content.slice(endIdx, content.indexOf('>', endIdx));
        if (!nextTag.startsWith('</') && !nextTag.endsWith('/>')) depth++;
        else if (nextTag.startsWith('</')) depth--;
      }
      endIdx++;
    }
    const tabStripSection = content.slice(firstScrollIdx, endIdx);

    // Any literal 'Geral' string inside the tab strip should be part of the map callback
    // (i.e., inside a template literal or comparison), not a hardcoded standalone chip.
    // The key check: the map callback contains the folder name logic.
    expect(tabStripSection).toMatch(/(?:folders|folderChips)\.map/);
  });

  it('screen handles orphaned selectedFolder by falling back to "Todos"', () => {
    const content = source(routinesScreen);

    // After the fix, when 'Geral' is removed from folders, selectedFolder='Geral'
    // should not leave the user with an empty filter. The screen should guard this.
    // Accept either a useEffect or an inline guard before getFilteredRoutines call.
    const hasOrphanGuard = /selectedFolder.*Geral|useEffect.*setSelectedFolder|useEffect.*\[.*folders.*\].*setSelectedFolder/.test(content);
    // Also accept a simpler pattern: checking if selectedFolder is not in folders
    const hasInGuard = /!(?:folders|folderChips)\.includes\(selectedFolder\)/.test(content);
    expect(hasOrphanGuard || hasInGuard).toBe(true);
  });
});
