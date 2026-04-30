import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter, Stack } from 'expo-router';
import { db } from '../../../src/db/client';
import { sessions, sets } from '../../../src/db/schema';
import { desc, isNull, eq, and, inArray } from 'drizzle-orm';
import { Card } from '../../../components/Card';
import { Dialog } from '../../../components/Dialog';
import { SkeletonList } from '../../../components/Skeleton';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';
import { Colors } from '@/constants/colors';
import { useI18n } from '../../../src/i18n/index';

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
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, sessionId: 0, sessionName: '' });

  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await db.select().from(sessions).where(isNull(sessions.deletedAt)).orderBy(desc(sessions.startTime));
      setAllSessions(result);

      const marks: Record<string, { marked: boolean; dotColor: string }> = {};
      result.forEach(s => {
        const dateStr = new Date(s.startTime).toISOString().split('T')[0];
        marks[dateStr] = {
          marked: true,
          dotColor: Colors.primary,
        };
      });
      setMarkedDates(marks);
    } catch (e) {
      logger.error('Erro inesperado', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    const filtered = allSessions.filter(s => {
      const sDate = new Date(s.startTime).toISOString().split('T')[0];
      return sDate === day.dateString;
    });

    // Load exercise info for all filtered sessions in a single batch query
    if (filtered.length === 0) {
      setDaySessions([]);
      return;
    }

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
  }, [allSessions]);

  const calendarTheme = {
    backgroundColor: Colors.darkCard,
    calendarBackground: Colors.darkCard,
    textSectionTitleColor: Colors.darkSubtext,
    selectedDayBackgroundColor: Colors.primary,
    selectedDayTextColor: Colors.white,
    todayTextColor: Colors.primary,
    dayTextColor: Colors.darkText,
    textDisabledColor: Colors.darkSubtext,
    dotColor: Colors.primary,
    selectedDotColor: Colors.white,
    arrowColor: Colors.primary,
    monthTextColor: Colors.darkText,
    indicatorColor: Colors.primary,
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
        borderTopColor: Colors.darkBorder,
        paddingTop: 10,
      }
    }
  };

  const renderHeader = () => (
    <View>
      <View className="p-4 pb-0">
        <View className="rounded-2xl overflow-hidden border border-border shadow-sm bg-card">
          <Calendar
            onDayPress={handleDayPress}
            markedDates={{
              ...markedDates,
              [selectedDate]: {
                selected: true,
                disableTouchEvent: true,
                selectedColor: Colors.primary,
                selectedTextColor: Colors.white,
                marked: markedDates[selectedDate]?.marked,
                dotColor: Colors.white,
              }
            }}
            enableSwipeMonths={true}
            theme={calendarTheme}
          />
        </View>
      </View>

      <View className="px-4 pt-4">
        <Text className="text-subtext font-black uppercase text-xs mb-3 tracking-widest pl-1">
          {selectedDate ? `${t('history.workoutsOn')} ${selectedDate.split('-').reverse().join('/')}` : t('history.selectDay')}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="justify-center items-center mt-10 opacity-50">
      <Text className="text-4xl mb-2" accessibilityLabel={t("history.calendarIcon")}>📅</Text>
      <Text className="text-subtext font-bold text-center">{t('history.noWorkouts')}</Text>
      <Text className="text-subtext text-xs text-center">{t('history.noWorkoutsDesc')}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('history.title') }} />

      {isLoading ? (
        <View className="flex-1 p-4">
          <SkeletonList count={3} />
        </View>
      ) : (
        <FlatList
          data={daySessions}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 12, padding: 16, paddingTop: 0 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-text font-black text-lg mb-1 tracking-tight">{item.routineName}</Text>
                  <Text className="text-subtext text-xs font-bold uppercase tracking-wider mb-2">
                    {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.durationMinutes || 0} min • {item.totalSets} {t('session.series')}
                  </Text>
                  {item.exerciseNames.length > 0 && (
                    <View className="flex-row flex-wrap gap-1">
                      {item.exerciseNames.slice(0, 3).map((name, idx) => (
                        <View key={idx} className="bg-primary/10 px-2 py-0.5 rounded-md">
                          <Text className="text-primary text-xs font-semibold">{name}</Text>
                        </View>
                      ))}
                      {item.exerciseNames.length > 3 && (
                        <Text className="text-subtext text-xs font-semibold">+{item.exerciseNames.length - 3}</Text>
                      )}
                    </View>
                  )}
                </View>
                <View className="flex-col gap-1.5 ml-2 justify-center">
                  <TouchableOpacity
                    className="bg-primary/10 px-2.5 py-1.5 rounded-lg border border-primary/20 items-center min-w-[52px]"
                    onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: item.id } })}
                    accessibilityLabel={`${t('history.view')} ${item.routineName}`}
                    accessibilityRole="button"
                  >
                    <Text className="text-primary font-black text-2xs uppercase tracking-wider">{t("common.view")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-danger/10 px-2.5 py-1.5 rounded-lg border border-danger/20 items-center min-w-[52px]"
                    onPress={() => setDeleteDialog({ visible: true, sessionId: item.id, sessionName: item.routineName ?? '' })}
                    accessibilityLabel={`${t('common.delete')} ${item.routineName}`}
                    accessibilityRole="button"
                  >
                    <Text className="text-danger font-black text-2xs uppercase tracking-wider">{t("common.delete")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
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
