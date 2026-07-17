import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

function sourceSection(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing source section: ${start} → ${end}`);
  return source.slice(startIndex, endIndex);
}

const aboutSource = readSource('../../app/about.tsx');
const settingsSource = readSource('../../app/(tabs)/settings.tsx');
const weeklyReportSource = readSource('../../app/reports/weekly.tsx');
const indexSource = readSource('../../app/(tabs)/index.tsx');
const historySource = readSource('../../app/(tabs)/history.tsx');
const incompleteSessionSection = sourceSection(indexSource, '{/* Incomplete Session Banner */}', '{/* Active Program / Dashboard */}');
const activeProgramSection = sourceSection(indexSource, '{/* Active Program / Dashboard */}', '{/* Key Lifts Dashboard */}');
const availableRoutinesSection = sourceSection(indexSource, 'home.availableRoutines', '</ScrollView>');
const historyRowsSection = sourceSection(historySource, 'renderItem={({ item, index })', '<Dialog');
const historyRetrySection = sourceSection(historySource, 'if (dayError)', 'return renderEmpty()');

describe('Sprint 3 information hierarchy', () => {
  it('flattens static About sections and keeps the root-owned header', () => {
    expect(aboutSource).not.toMatch(/import\s+\{[^}]*\bCard\b[^}]*\}\s+from/);
    expect(aboutSource).not.toContain('<Card');
    expect(aboutSource).not.toContain('<Stack.Screen');
  });

  it('renders Settings as flat sections rather than ornamental cards', () => {
    expect(settingsSource).not.toMatch(/import\s+\{[^}]*\bCard\b[^}]*\}\s+from/);
    expect(settingsSource).not.toContain('<Card');
  });

  it('keeps language selections at the 44dp touch-target floor', () => {
    expect(settingsSource).toMatch(/setLanguage\(lang\)[\s\S]{0,220}min-h-\[44px\]/);
  });

  it('uses theme roles for the native settings switch', () => {
    expect(settingsSource).toContain('trackColor={{ false: theme.border, true: theme.primary }}');
    expect(settingsSource).toContain('thumbColor={theme.onPrimary}');
    expect(settingsSource).not.toContain('Colors.white');
  });

  it('keeps only the period banner as the Weekly Report card anchor', () => {
    expect(weeklyReportSource.match(/<Card\b/g) ?? []).toHaveLength(1);
  });

  it('does not duplicate the root-owned Weekly Report title', () => {
    expect(weeklyReportSource).not.toMatch(/\{t\(['"]reports\.title['"]\)\}/);
  });

  it('neither index nor history contains local Stack.Screen or manual pt-16 compensation', () => {
    expect(indexSource).not.toContain('<Stack.Screen');
    expect(indexSource).not.toContain('pt-16');
    expect(historySource).not.toContain('<Stack.Screen');
    expect(historySource).not.toContain('pt-16');
  });

  it('uses direct pressable Cards for the two Home anchors', () => {
    expect(incompleteSessionSection).toMatch(/<Card[\s\S]{0,180}\bpressable\b[\s\S]{0,180}onPress=\{handleResumeSession\}/);
    expect(incompleteSessionSection).not.toContain('<TouchableOpacity');
    expect(activeProgramSection).toMatch(/<Card[\s\S]{0,180}\bpressable\b[\s\S]{0,180}\/programs\/detail/);
    expect(activeProgramSection).not.toContain('<TouchableOpacity');
  });

  it('Home routine names explicitly allow two lines', () => {
    expect(availableRoutinesSection).toMatch(/numberOfLines=\{2\}>\{routine\.name\}<\/Text>/);
  });

  it('Home no longer contains the nested stat-tile signature', () => {
    expect(indexSource).not.toContain('bg-background border border-border/60 rounded-xl');
  });

  it('Home no longer contains the key-lift card signature', () => {
    expect(indexSource).not.toContain('bg-card border border-border rounded-xl');
  });

  it('maps every Home phase badge branch to matching semantic roles', () => {
    expect(activeProgramSection).toContain("isDeloadWeek ? 'bg-successSurface' : isNearDeload ? 'bg-warningSurface' : 'bg-primarySurface'");
    expect(activeProgramSection).toContain("isDeloadWeek ? 'text-successText' : isNearDeload ? 'text-warningText' : 'text-primaryText'");
    expect(activeProgramSection).toContain('${badgeBg} px-2.5 py-1 rounded-full');
    expect(activeProgramSection).toContain('${badgeText} text-xs font-semibold capitalize');
  });

  it('describes the active-session action in its accessibility label', () => {
    expect(incompleteSessionSection).toMatch(/accessibilityLabel=\{`\$\{t\(["']home\.continue["']\)\}/);
  });

  it('translated Home CTAs are sentence case and keep the 44dp touch-target floor', () => {
    expect(indexSource).not.toMatch(/className="[^"]*\buppercase\b[^"]*"[\s\S]{0,120}home\.continue/);
    expect(indexSource).not.toMatch(/className="[^"]*\buppercase\b[^"]*"[\s\S]{0,120}home\.viewCalendar/);
    expect(indexSource).not.toMatch(/className="[^"]*\buppercase\b[^"]*"[\s\S]{0,120}home\.manage/);
    expect(indexSource).toMatch(/router\.push\('\/history'\)[\s\S]{0,100}min-h-\[44px\]/);
    expect(indexSource).toMatch(/router\.push\('\/routines'\)[\s\S]{0,100}min-h-\[44px\]/);
  });

  it('History contains no explicit Card after session rows are flattened', () => {
    expect(historySource).not.toContain('<Card');
    expect(historySource).not.toMatch(/import\s+\{[^}]*\bCard\b[^}]*\}\s+from/);
  });

  it('History exercise names are not rendered as tinted badge/chip surfaces', () => {
    expect(historyRowsSection).not.toMatch(/className="[^"]*bg-[^"]*Surface[^"]*"[\s\S]{0,100}exerciseNames/);
  });

  it('History uses existing getLocaleForLanguage(language) when formatting session time', () => {
    expect(historySource).toContain('getLocaleForLanguage(language)');
    expect(historySource).not.toContain('toLocaleTimeString([],');
  });

  it('History action labels are sentence case and every action keeps the 44dp floor', () => {
    expect(historyRowsSection).not.toMatch(/className="[^"]*\buppercase\b[^"]*"[\s\S]{0,120}common\.view/);
    expect(historyRowsSection).not.toMatch(/className="[^"]*\buppercase\b[^"]*"[\s\S]{0,120}common\.delete/);
    expect(historyRetrySection).not.toContain('uppercase');
    expect(historyRowsSection).toMatch(/className="[^"]*min-h-\[44px\][^"]*"[\s\S]{0,180}pathname: '\/session\/summary'/);
    expect(historyRowsSection).toMatch(/className="[^"]*min-h-\[44px\][^"]*"[\s\S]{0,180}setDeleteDialog/);
    expect(historyRetrySection).toContain('min-h-[44px]');
  });

  it('History uses dividers without stacking an additional FlatList gap', () => {
    expect(historySource).not.toContain('contentContainerStyle={{ gap: 12, padding: 16, paddingTop: 0 }}');
  });

  it('Home preserves required hook, fetch and route patterns', () => {
    expect(indexSource).toContain('useFocusEffect');
    expect(indexSource).toContain('RefreshControl');
    expect(indexSource).toContain('Promise.all([fetchRoutines(), fetchHomeData(), fetchActiveProgram()])');
    expect(indexSource).toContain('/session/exercise');
    expect(indexSource).toContain('sessionId');
    expect(indexSource).toContain('routineId');
    expect(indexSource).toContain('exerciseId');
    expect(indexSource).toContain('exerciseName');
    expect(indexSource).toContain('target');
    expect(indexSource).toContain('notes');
    expect(indexSource).toContain('/programs/detail');
    expect(indexSource).toContain('/history');
    expect(indexSource).toContain('/routines');
    expect(indexSource).toContain('/routine/[routineId]');
    expect(indexSource).toContain('/session/summary');
  });

  it('History preserves database queries and interface components', () => {
    expect(historySource).toContain('isNull(sessions.deletedAt)');
    expect(historySource).toContain('inArray(sets.sessionId, sessionIds)');
    expect(historySource).toContain('isNull(sets.deletedAt)');
    expect(historySource).toContain('.set({ deletedAt: Date.now() })');
    expect(historySource).toContain('setSelectedDate(\'\')');
    expect(historySource).toContain('Calendar');
    expect(historySource).toContain('RefreshControl');
    expect(historySource).toContain('Dialog');
    expect(historySource).toContain('/session/summary');
  });
});
