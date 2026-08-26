import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, useColorScheme } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { sessions, sets } from '../../src/db/schema';
import { desc, isNull, eq, and, inArray } from 'drizzle-orm';
import { Dialog } from '../../components/Dialog';
import { SkeletonList } from '../../components/Skeleton';
import { ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';
import { Colors } from '@/constants/colors';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { toLocalDateKey } from '@/src/utils/date-key';
import { SectionHeader } from '@/components/SectionHeader';

// Configuração de Locale multilíngue
const localeConfigs = {
  pt: {
    monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'],
    today: 'Hoje',
  },
  en: {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today',
  },
  es: {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy',
  },
  zh: {
    monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
    today: '今天',
  },
};

// Set default locale (must be set before Calendar renders)
LocaleConfig.defaultLocale = 'pt';

['pt', 'en', 'es', 'zh'].forEach(lang => {
  LocaleConfig.locales[lang] = localeConfigs[lang as keyof typeof localeConfigs];
});

interface SessionWithExercises extends Session {
  exerciseNames: string[];
  totalSets: number;
}

export default function HistoryScreen() {
  const { t, language } = useI18n();
  const theme = useThemeColors();
  const router = useRouter();

  // Update calendar locale when language changes
  useEffect(() => {
    if (LocaleConfig.locales[language]) {
      LocaleConfig.defaultLocale = language;
    }
  }, [language]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, { marked: boolean; dotColor: string }>>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [daySessions, setDaySessions] = useState<SessionWithExercises[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDayLoading, setIsDayLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, sessionId: 0, sessionName: '' });

  const loadSessions = useCallback(async (dotColor: string = theme.primaryText) => {
    setPageError(null);
    try {
      setIsLoading(true);
      const result = await db.select().from(sessions).where(isNull(sessions.deletedAt)).orderBy(desc(sessions.startTime));
      setAllSessions(result);

      const marks: Record<string, { marked: boolean; dotColor: string }> = {};
      result.forEach(s => {
        const dateStr = toLocalDateKey(s.startTime);
        marks[dateStr] = {
          marked: true,
          dotColor,
        };
      });
      setMarkedDates(marks);
    } catch (e) {
      logger.error('Erro inesperado', e);
      setPageError(t('states.errorBody'));
    } finally {
      setIsLoading(false);
    }
  }, [t, theme.primaryText]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }, [loadSessions]);

  const handleDeleteSession = useCallback(async () => {
    try {
      await db.update(sessions)
        .set({ deletedAt: Date.now() })
        .where(eq(sessions.id, deleteDialog.sessionId));
      setDeleteDialog({ visible: false, sessionId: 0, sessionName: '' });
      await loadSessions();
      // Clear day sessions to force re-filter
      setDaySessions([]);
      setSelectedDate('');
    } catch (e) {
      logger.error('Failed to delete session', e);
    }
  }, [deleteDialog.sessionId, loadSessions]);

  const handleDayPress = useCallback(async (day: any) => {
    setSelectedDate(day.dateString);
    setDayError(null);
    setDaySessions([]);
    setIsDayLoading(true);
    const filtered = allSessions.filter(s => {
      const sDate = toLocalDateKey(s.startTime);
      return sDate === day.dateString;
    });

    // Load exercise info for all filtered sessions in a single batch query
    if (filtered.length === 0) {
      setIsDayLoading(false);
      return;
    }

    try {
      const sessionIds = filtered.map(s => s.id);
      const allSets = await db
        .select({ sessionId: sets.sessionId, exerciseName: sets.exerciseName })
        .from(sets)
        .where(and(
          inArray(sets.sessionId, sessionIds),
          isNull(sets.deletedAt),
        ));

      // Group sets by session
      const setsBySession = new Map<number, { names: Set<string>; count: number }>();
      for (const row of allSets) {
        if (!setsBySession.has(row.sessionId)) {
          setsBySession.set(row.sessionId, { names: new Set(), count: 0 });
        }
        const entry = setsBySession.get(row.sessionId)!;
        entry.count++;
        if (row.exerciseName) entry.names.add(row.exerciseName);
      }

      const enriched: SessionWithExercises[] = filtered.map(session => {
        const data = setsBySession.get(session.id);
        return {
          ...session,
          exerciseNames: data ? Array.from(data.names) : [],
          totalSets: data?.count ?? 0,
        };
      });

      setDaySessions(enriched);
    } catch (e) {
      logger.error('Failed to load day session details', e);
      setDayError(t('states.errorBody'));
    } finally {
      setIsDayLoading(false);
    }
  }, [allSessions, t]);

  const colorScheme = useColorScheme();
  const cardBg = colorScheme === 'dark' ? Colors.darkCard : Colors.lightCard;
  const textPrimary = colorScheme === 'dark' ? Colors.darkText : Colors.lightText;
  const textMuted = colorScheme === 'dark' ? Colors.darkSubtext : Colors.lightSubtext;
  const borderBg = colorScheme === 'dark' ? Colors.darkBorder : Colors.lightBorder;

  const calendarTheme = {
    backgroundColor: cardBg,
    calendarBackground: cardBg,
    textSectionTitleColor: textMuted,
    selectedDayBackgroundColor: Colors.primary,
    selectedDayTextColor: Colors.onPrimary,
    todayTextColor: theme.primaryText,
    dayTextColor: textPrimary,
    textDisabledColor: textMuted,
    dotColor: theme.primaryText,
    selectedDotColor: Colors.onPrimary,
    arrowColor: theme.primaryText,
    monthTextColor: textPrimary,
    indicatorColor: theme.primaryText,
    textDayFontWeight: '600' as const,
    textMonthFontWeight: '900' as const,
    textDayHeaderFontWeight: '800' as const,
    textDayFontSize: 14,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 10,
    'stylesheet.calendar.header': {
      week: {
        marginTop: 10,
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: borderBg,
        paddingTop: 10,
      }
    }
  };

  const renderHeader = () => (
    <View>
      <View className="pt-4 pb-0">
        <View className="rounded-2xl overflow-hidden border border-border bg-card">
          <Calendar
            onDayPress={handleDayPress}
            markedDates={{
              ...markedDates,
              [selectedDate]: {
                selected: true,
                disableTouchEvent: true,
                selectedColor: Colors.primary,
                selectedTextColor: Colors.onPrimary,
                marked: markedDates[selectedDate]?.marked,
                dotColor: Colors.onPrimary,
              }
            }}
            enableSwipeMonths={true}
            theme={calendarTheme}
          />
        </View>
      </View>

      <View className="pt-4">
        <SectionHeader
          label={selectedDate ? `${t('history.workoutsOn')} ${selectedDate.split('-').reverse().join('/')}` : t('history.selectDay')}
          className="mb-3"
        />
      </View>
    </View>
  );

  const renderDayContent = () => {
    if (isDayLoading) {
      return (
        <View className="py-4">
          <SkeletonList count={2} />
        </View>
      );
    }
    if (dayError) {
      return (
        <View className="py-4">
          <View className="border border-dashed border-border rounded-2xl p-6 bg-card items-center">
            <Text className="text-4xl mb-2" accessible={false}>⚠️</Text>
            <Text className="text-subtext font-bold text-center">{t('states.errorTitle')}</Text>
            <Text className="text-subtext text-xs text-center mt-1">{dayError}</Text>
            <TouchableOpacity
              className="mt-4 min-h-[44px] bg-primarySurface px-4 rounded-xl border border-primary/20 items-center justify-center"
              onPress={() => selectedDate && handleDayPress({ dateString: selectedDate })}
              accessibilityRole="button"
            >
              <Text className="text-primaryText font-bold text-xs">{t('states.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return renderEmpty();
  };

  function renderEmpty() {
    return (
      <View className="py-4">
        <View className="border border-dashed border-border rounded-2xl p-6 bg-card items-center">
          <Text className="text-4xl mb-2" accessibilityLabel={t("history.calendarIcon")}>📅</Text>
          <Text className="text-subtext font-bold text-center">
            {!selectedDate ? t('history.selectDay') : t('history.noWorkouts')}
          </Text>
          <Text className="text-subtext text-xs text-center mt-1">
            {!selectedDate ? t('history.selectDayPrompt') : t('history.noWorkoutsDesc')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {isLoading ? (
        <View className="flex-1 p-4">
          <SkeletonList count={3} />
        </View>
      ) : pageError ? (
        <ErrorState
          message={pageError}
          onRetry={loadSessions}
        />
      ) : (
        <FlatList
          data={daySessions}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primaryText}
              colors={[theme.primaryText]}
            />
          }
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderDayContent}
          renderItem={({ item, index }) => (
            <View className="py-1">
              {index > 0 && <View className="h-px bg-border/60 mb-3" />}
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-lg font-extrabold text-text tracking-tight mb-1">{item.routineName}</Text>
                  <Text className="text-xs text-subtext mb-2">
                    {new Date(item.startTime).toLocaleTimeString(getLocaleForLanguage(language), { hour: '2-digit', minute: '2-digit' })} • {item.durationMinutes || 0} min • {item.totalSets} {t('session.series')}
                  </Text>
                  {item.exerciseNames.length > 0 && (
                    <Text className="text-subtext text-xs font-medium">
                      {item.exerciseNames.slice(0, 3).join(', ')}
                      {item.exerciseNames.length > 3 ? ` +${item.exerciseNames.length - 3}` : ''}
                    </Text>
                  )}
                </View>
                <View className="flex-col gap-1.5 ml-2 justify-center">
                  <TouchableOpacity
                    className="bg-primarySurface px-2.5 py-1.5 rounded-lg border border-primary/20 items-center justify-center min-w-[52px] min-h-[44px]"
                    onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: item.id } })}
                    accessibilityLabel={`${t('history.view')} ${item.routineName}`}
                    accessibilityRole="button"
                  >
                    <Text className="text-primaryText font-black text-2xs">{t("common.view")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-dangerSurface px-2.5 py-1.5 rounded-lg border border-danger/20 items-center justify-center min-w-[52px] min-h-[44px]"
                    onPress={() => setDeleteDialog({ visible: true, sessionId: item.id, sessionName: item.routineName ?? '' })}
                    accessibilityLabel={`${t('common.delete')} ${item.routineName}`}
                    accessibilityRole="button"
                  >
                    <Text className="text-dangerText font-black text-2xs">{t("common.delete")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Dialog
        visible={deleteDialog.visible}
        title={t('history.deleteConfirm')}
        message={t('history.deleteDesc', { name: deleteDialog.sessionName })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        type="destructive"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteDialog({ visible: false, sessionId: 0, sessionName: '' })}
      />
    </View>
  );
}
