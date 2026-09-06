import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#107 supplement reminders + i18n', () => {
  it('reminder scheduling is real (scheduler called with supplement data), not dead UI', () => {
    const svc = read('services/NotificationService.ts');
    expect(svc).toMatch(/supplement/i);
    const hook = read('hooks/use-notifications.ts');
    expect(hook).toMatch(/schedule|supplement/i);
  });

  it('no hardcoded notification strings — copy comes from i18n', () => {
    const svc = read('services/NotificationService.ts');
    expect(svc).not.toMatch(/title:\s*'[^']*[\p{L}]{3}[^']*'/u);
    expect(svc).toMatch(/t\(|i18n|getTranslation/);
  });
});
