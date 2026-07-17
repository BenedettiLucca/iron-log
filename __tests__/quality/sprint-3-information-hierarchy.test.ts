import fs from 'node:fs';
import path from 'node:path';
import { pt } from '../../src/i18n/translations/pt';
import { en } from '../../src/i18n/translations/en';
import { es } from '../../src/i18n/translations/es';
import { zh } from '../../src/i18n/translations/zh';

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
const programsIndexSource = readSource('../../app/programs/index.tsx');
const programsDetailSource = readSource('../../app/programs/detail.tsx');
const programsWeekDetailSource = readSource('../../app/programs/week-detail.tsx');
const routineDetailSource = readSource('../../app/routine/[routineId].tsx');
const incompleteSessionSection = sourceSection(indexSource, '{/* Incomplete Session Banner */}', '{/* Active Program / Dashboard */}');
const activeProgramSection = sourceSection(indexSource, '{/* Active Program / Dashboard */}', '{/* Key Lifts Dashboard */}');
const availableRoutinesSection = sourceSection(indexSource, 'home.availableRoutines', '</ScrollView>');
const historyRowsSection = sourceSection(historySource, 'renderItem={({ item, index })', '<Dialog');
const historyRetrySection = sourceSection(historySource, 'if (dayError)', 'return renderEmpty()');
const programDetailSummary = sourceSection(programsDetailSource, '{/* Program Info Card */}', '{/* Weeks List */}');
const programWeekExerciseSection = sourceSection(programsWeekDetailSource, '{/* Exercise List */}', "SectionHeader label={t('programs.dashboard.sessions')");
const programWeekSelectorSection = sourceSection(programsWeekDetailSource, '{/* Week Grid */}', '<ScrollView className="flex-1 px-4"');
const routineSummarySection = sourceSection(routineDetailSource, '{/* Summary Card */}', '{/* PRs Section */}');
const routineExerciseSection = sourceSection(routineDetailSource, '{/* Exercise List */}', '{/* Floating Bottom Actions */}');
const settingsLanguageSection = sourceSection(settingsSource, '{/* Language Selector Section */}', '{/* About Section */}');

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

  it('keeps language selections at 44dp and exposes button/selected semantics', () => {
    expect(settingsLanguageSection).toMatch(/setLanguage\(lang\)[\s\S]{0,220}min-h-\[44px\]/);
    expect(settingsLanguageSection).toContain('accessibilityRole="button"');
    expect(settingsLanguageSection).toContain('accessibilityState={{ selected: language === lang }}');
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

  it('prohibits manual pt-16 compensation in the program screens', () => {
    expect(programsIndexSource).not.toContain('pt-16');
    expect(programsDetailSource).not.toContain('pt-16');
    expect(programsWeekDetailSource).not.toContain('pt-16');
  });

  it('Programs list relies on the native Stack title and wraps user names', () => {
    expect(programsIndexSource).not.toMatch(/\{t\(['"]programs\.title['"]\)\}/);
    expect(programsIndexSource).toMatch(/numberOfLines=\{2\}[\s\S]{0,80}\{activeProgram\.name\}/);
    expect(programsIndexSource).toMatch(/numberOfLines=\{2\}[\s\S]{0,80}\{program\.name\}/);
  });

  it('archived programs use flat TouchableOpacity rows rather than Card', () => {
    const archivedSection = sourceSection(programsIndexSource, '{/* Archived Programs */}', '{/* Bottom Action Bar */}');
    expect(archivedSection).not.toContain('<Card');
    expect(archivedSection).toContain('<TouchableOpacity');
  });

  it('Program Detail uses the native title and does not repeat page identity in the summary', () => {
    expect(programsDetailSource).toMatch(/<Stack\.Screen[\s\S]{0,100}options=\{\{\s*title:\s*program\.name/);
    expect(programDetailSummary).not.toContain("t('programs.title')");
    expect(programDetailSummary).not.toContain('{program.name}');
    expect(programDetailSummary).not.toContain('uppercase');
    expect(programsDetailSource).not.toContain('{/* Header */}');
  });

  it('Program Detail validates a positive integer only after declaring every hook', () => {
    const invalidGuard = "if (!Number.isInteger(programIdNum) || programIdNum <= 0)";
    const guardIndex = programsDetailSource.indexOf(invalidGuard);
    const errorIndex = programsDetailSource.indexOf("return <ErrorState message={t('programs.invalidRoute')} />", guardIndex);

    expect(guardIndex).toBeGreaterThan(0);
    expect(errorIndex).toBeGreaterThan(guardIndex);
    for (const hook of ['useFocusEffect(', 'useEffect(', 'const onRefresh = useCallback(']) {
      const hookIndex = programsDetailSource.indexOf(hook);
      expect(hookIndex).toBeGreaterThan(0);
      expect(hookIndex).toBeLessThan(guardIndex);
    }
  });

  it('Week Detail does not render a custom programs.weekDetail header inside content', () => {
    expect(programsWeekDetailSource).not.toContain('programs.weekDetail');
  });

  it('Week Detail selector exposes accessibility labels, role button, and selected state', () => {
    expect(programsWeekDetailSource).toContain('accessibilityLabel');
    expect(programsWeekDetailSource).toContain('accessibilityRole="button"');
    expect(programsWeekDetailSource).toContain('accessibilityState');
  });

  it('planned exercises in Week Detail are genuinely flat rows', () => {
    expect(programWeekExerciseSection).not.toContain('<Card');
    expect(programWeekExerciseSection).not.toContain('rounded-2xl');
    expect(programWeekExerciseSection).not.toContain('bg-card');
  });

  it('status display logic preserves terminal states before current and styles the selector from resolved status', () => {
    expect(programsDetailSource).toMatch(/status\s*!==\s*['"]future['"]\s*\?\s*status\s*:\s*isCurrent\s*\?\s*['"]current['"]\s*:\s*['"]future['"]/);
    expect(programsWeekDetailSource).toMatch(/status\s*!==\s*['"]future['"]\s*\?\s*status\s*:\s*isCurrent\s*\?\s*['"]current['"]\s*:\s*['"]future['"]/);
    expect(programsWeekDetailSource).not.toContain('badgeStyle.split');
    expect(programWeekSelectorSection).toContain("resolvedWStatus === 'current'");
    expect(programWeekSelectorSection).toContain("resolvedWStatus === 'done'");
    expect(programWeekSelectorSection).not.toMatch(/else if \(wStatus ===/);
    expect(programWeekSelectorSection).toContain('getStatusEmoji(resolvedWStatus)');
  });

  it('Program Detail and Week Detail do not contain hardcoded strings', () => {
    const forbidden = [
      'Programa',
      'Semanas',
      'Pendente',
      'Atual',
      'Concluída',
      'Perdida',
      'Até',
      'Nenhuma semana configurada',
      'Voltar',
      'Programa não encontrado',
      'Semana não encontrada',
      'Metas da Semana',
      'RIR Alvo',
      'Intensidade',
      'Fase do Bloco',
      'Acumulação',
      'Exercícios Planejados',
      'Meta:',
      'Rest:',
      'Obs:',
      'Nenhuma rotina ou exercício planejado para esta semana',
      'Nenhum treino realizado nesta semana'
    ];
    for (const str of forbidden) {
      expect(programsDetailSource).not.toContain(str);
      expect(programsWeekDetailSource).not.toContain(str);
    }
  });

  it('preserves list, detail, and week detail functional logic', () => {
    // list keeps navigation
    expect(programsIndexSource).toContain('/programs/create');
    expect(programsIndexSource).toContain('/programs/detail');

    // detail keeps useFocusEffect, dashboard effect, refresh, delete, Dialog/Toast, week-detail path
    expect(programsDetailSource).toContain('useFocusEffect');
    expect(programsDetailSource).toContain('fetchDashboardData');
    expect(programsDetailSource).toContain('onRefresh');
    expect(programsDetailSource).toContain('deleteProgram');
    expect(programsDetailSource).toContain('Dialog');
    expect(programsDetailSource).toContain('Toast');
    expect(programsDetailSource).toContain('/programs/week-detail');

    // week detail keeps weekDetailParamsSchema, safeParseParams, request-id guards, routineExercises query, sessions, retry, summary navigation
    expect(programsWeekDetailSource).toContain('weekDetailParamsSchema');
    expect(programsWeekDetailSource).toContain('safeParseParams');
    expect(programsWeekDetailSource).toContain('sessionsRequestRef');
    expect(programsWeekDetailSource).toContain('exercisesRequestRef');
    expect(programsWeekDetailSource).toContain('routineExercises');
    expect(programsWeekDetailSource).toContain('getSessionsForWeek');
    expect(programsWeekDetailSource).toContain('/session/summary');
    expect(programsWeekDetailSource).toContain('sessionId');
  });

  it('uses the native Routine title and keeps one static summary anchor', () => {
    const stackScreenIndex = routineDetailSource.indexOf('<Stack.Screen');
    const scrollViewIndex = routineDetailSource.indexOf('<ScrollView');

    expect(routineDetailSource).toContain("<Stack.Screen options={{ title: routineName || t('routineDetail.title') }} />");
    expect(stackScreenIndex).toBeGreaterThan(-1);
    expect(stackScreenIndex).toBeLessThan(scrollViewIndex);
    expect(routineSummarySection).not.toContain("{routineName || t('routineDetail.title')}");
    expect(routineSummarySection).not.toContain('Resumo da Rotina');
    expect(routineSummarySection.match(/<Card\b/g) ?? []).toHaveLength(1);
    expect(routineDetailSource).not.toContain('{/* Last Session */}');
  });

  it('uses direct pressable exercise Cards without target or metric pill soup', () => {
    const targetBlock = routineExerciseSection.match(/\{ex\.target\s*&&\s*\([\s\S]+?<\/Text>\s*\)\}/)?.[0];
    const metricsBlock = routineExerciseSection.match(/\{ex\.sessionCount\s*>\s*0\s*&&\s*\([\s\S]+?<\/View>\s*\)\}/)?.[0];

    expect(routineExerciseSection).toMatch(/<Card[\s\S]{0,100}\bpressable\b/);
    expect(routineExerciseSection).toContain('onPress={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}');
    expect(routineExerciseSection).toContain("t('routineDetail.collapseDetails')");
    expect(routineExerciseSection).toContain("t('routineDetail.expandDetails')");
    expect(routineExerciseSection).not.toContain('<TouchableOpacity');
    expect(targetBlock).toBeDefined();
    expect(targetBlock).not.toMatch(/bg-primarySurface|rounded|border/);
    expect(metricsBlock).toBeDefined();
    expect(metricsBlock).not.toMatch(/rounded-full|bg-(?:accent|primary|secondary)Surface|border-(?:accent|primary|secondary)Text/);
  });

  it('localizes Routine copy and both date paths', () => {
    expect(routineDetailSource).not.toMatch(/Recordes Pessoais|Resumo da Rotina|\{ex\.lastReps\} reps/);
    expect(routineDetailSource).not.toContain("toLocaleDateString('pt-BR'");
    expect(routineDetailSource.match(/getLocaleForLanguage\(language\)/g) ?? []).toHaveLength(2);
    expect(routineSummarySection).toContain('routineDetail.exerciseCountSingle');
    expect(routineSummarySection).toContain('routineDetail.workoutCountSingle');
  });

  it('uses the real bottom safe area for Routine content and actions', () => {
    expect(routineDetailSource).toContain('const insets = useSafeAreaInsets()');
    expect(routineDetailSource).toContain('paddingBottom: 96 + insets.bottom');
    expect(routineDetailSource).toContain('paddingBottom: Math.max(insets.bottom, 12)');
    expect(routineDetailSource).not.toContain('paddingBottom: 24');
    expect(routineDetailSource).not.toContain('className="h-24"');
  });

  it('preserves Routine data, route, state, and action contracts', () => {
    for (const pattern of [
      'routinePreviewParamsSchema',
      'consumePendingToast',
      'routineExercises.orderIndex',
      'isNull(sets.deletedAt)',
      'isNull(sessions.deletedAt)',
      '/routines/editor',
      '/session/[routineId]',
      '_ts: Date.now().toString()',
      "disabled={!params || screenState !== 'content'}",
    ]) {
      expect(routineDetailSource).toContain(pattern);
    }
  });

  it('checks new user-visible copy represented in all four locales', () => {
    const requiredKeys = [
      'personalRecords',
      'exerciseCount',
      'exerciseCountSingle',
      'workoutCount',
      'workoutCountSingle',
      'estimatedMinutes',
      'repsCount',
      'personalRecordWeight',
      'estimatedOneRepMax',
      'expandDetails',
      'collapseDetails'
    ];

    for (const key of requiredKeys) {
      expect(pt.routineDetail).toHaveProperty(key);
      expect(en.routineDetail).toHaveProperty(key);
      expect(es.routineDetail).toHaveProperty(key);
      expect(zh.routineDetail).toHaveProperty(key);
    }
  });

  it('keeps ordinary Routine labels in sentence case', () => {
    expect(pt.routineDetail).toMatchObject({
      lastWorkout: 'Último treino',
      weightEvolution: 'Evolução de carga',
      recentHistory: 'Histórico recente',
      startWorkout: 'Iniciar treino',
      title: 'Detalhe da rotina',
    });
    expect(en.routineDetail).toMatchObject({
      lastWorkout: 'Last workout',
      weightEvolution: 'Weight evolution',
      recentHistory: 'Recent history',
      startWorkout: 'Start workout',
      title: 'Routine detail',
    });
    expect(es.routineDetail).toMatchObject({
      lastWorkout: 'Último entreno',
      weightEvolution: 'Evolución de carga',
      recentHistory: 'Historial reciente',
      startWorkout: 'Iniciar entreno',
      title: 'Detalle de rutina',
    });
  });
});
