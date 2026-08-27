import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const readSource = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Sprint 11 Settings and Supplements fixes', () => {
  const settingsSource = readSource('app/(tabs)/settings.tsx');
  const supplementsSource = readSource('app/supplements/index.tsx');

  describe('Settings vertical rhythm normalization', () => {
    it('does not contain one-off mt-3 wrapper around actions in Settings', () => {
      expect(settingsSource).not.toMatch(/<View\s+className=["']mt-3["']>\s*<Button/);
      expect(settingsSource).not.toContain('mt-3');
    });

    it('renders Test Notification as a RowButton following the row spacing grammar', () => {
      expect(settingsSource).toMatch(
        /<RowButton[\s\S]*?label=\{t\(["']settings\.testNotification["']\)\}[\s\S]*?onPress=\{sendTestNotification\}[\s\S]*?loading=\{loading\}[\s\S]*?noBorder/,
      );
    });

    it('uses BellIcon with theme.primaryText in Test Notification RowButton', () => {
      expect(settingsSource).toMatch(
        /<BellIcon\s+color=\{theme\.primaryText\}\s*\/>/,
      );
    });

    it('matches row vertical rhythm between Switch row and RowButton with py-3.5', () => {
      expect(settingsSource).toContain('py-3.5');
      // Switch row should use py-3.5 and conditional border
      expect(settingsSource).toMatch(
        /flex-row items-center justify-between py-3\.5[\s\S]*?notificationSettings\.enabled/,
      );
    });

    it('avoids unused Button import in settings screen when all actions use RowButton', () => {
      expect(settingsSource).not.toMatch(/import\s+\{[^}]*\bButton\b[^}]*\}\s+from/);
      expect(settingsSource).not.toContain('<Button');
    });

    it('keeps Import Data and Export Alexandria as noBorder RowButtons', () => {
      expect(settingsSource).toMatch(
        /<RowButton[\s\S]*?label=\{t\(["']settings\.importData["']\)\}[\s\S]*?noBorder/,
      );
      expect(settingsSource).toMatch(
        /<RowButton[\s\S]*?label=\{t\(["']settings\.exportAlexandriaJson["']\)\}[\s\S]*?noBorder/,
      );
    });
  });

  describe('Supplements nighttime Switch theme & thumb color', () => {
    it('uses theme roles for nighttime Switch trackColor and explicit thumbColor', () => {
      expect(supplementsSource).toContain('trackColor={{ false: theme.border, true: theme.primary }}');
      expect(supplementsSource).toContain('thumbColor={theme.onPrimary}');
      expect(supplementsSource).not.toContain('trackColor={{ false: theme.border, true: Colors.primary }}');
    });
  });

  describe('Supplements modal close button affordance', () => {
    it('uses themed variant="secondary" for the modal close action', () => {
      expect(supplementsSource).toMatch(
        /<Button[\s\S]*?title=\{t\(['"]common\.close['"]\)\}[\s\S]*?variant=["']secondary["'][\s\S]*?size=["']sm["']/,
      );
    });

    it('preserves close modal accessibility and disabled state', () => {
      expect(supplementsSource).toMatch(
        /<Button[\s\S]*?title=\{t\(['"]common\.close['"]\)\}[\s\S]*?onPress=\{requestCloseModal\}[\s\S]*?disabled=\{isSaving \|\| isDeleting\}/,
      );
    });
  });
});
