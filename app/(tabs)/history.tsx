import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Dialog } from '@/components/Dialog';
import { Toast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { ErrorState } from '@/components/ScreenState';
import { logger } from '@/services/logger';
import { SessionLifecycleService } from '@/services/SessionLifecycleService';
import {
  HistoryQueryService,
  SessionWithExercises,
  MonthMark,
  isValidDateKey,
  HistoryPaginationCursor,
} from '@/services/HistoryQueryService';
import { Colors } from '@/constants/colors';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useToast } from '@/hooks/use-toast';
import { getLocaleForLanguage, useI18n } from '@/src/i18n/index';
import { SectionHeader } from '@/components/SectionHeader';
import { DatePicker } from '@/components/DatePicker';
import { toLocalDateKey } from '@/src/utils/date-key';

// Multi-language calendar locale configuration
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

LocaleConfig.defaultLocale = 'pt';
['pt', 'en', 'es', 'zh'].forEach((lang) => {
  LocaleConfig.locales[lang] = localeConfigs[lang as keyof typeof localeConfigs];
});

export default function HistoryScreen() {
  const { t, language } = useI18n();
  const theme = useThemeColors();
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ date?: string }>();

  useEffect(() => {
    if (LocaleConfig.locales[language]) {
      LocaleConfig.defaultLocale = language;
    }
  }, [language]);

  const now = new Date();
  const [visibleMonth, setVisibleMonth] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const [markedDates, setMarkedDates] = useState<Record<string, MonthMark>>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [daySessions, setDaySessions] = useState<SessionWithExercises[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDayLoading, setIsDayLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, sessionId: 0, sessionName: '' });

  // Search and discovery filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SessionWithExercises[]>([]);
  const [searchCursor, setSearchCursor] = useState<HistoryPaginationCursor | undefined>(undefined);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isSearchMode = searchQuery.trim().length > 0 || !!startDate || !!endDate;

  const loadMonthMarks = useCallback(
    async (year: number, month: number, dotColor: string = theme.primaryText) => {
      process.stdout.write(`[DEBUG] loadMonthMarks START for ${year}-${month}\n`);
      setPageError(null);
      try {
        const marks = await HistoryQueryService.getMonthMarkedDates({
          year,
          month,
          dotColor,
        });
        process.stdout.write(`[DEBUG] loadMonthMarks GOT MARKS: ${Object.keys(marks).length}\n`);
        setMarkedDates(marks);
      } catch (e) {
        process.stdout.write(`[DEBUG] loadMonthMarks ERROR: ${e}\n`);
        logger.error('Erro ao carregar marcas do mês', e);
        setPageError(t('states.errorBody'));
      }
    },
    [t, theme.primaryText]
  );

  const loadDaySessions = useCallback(
    async (dateKey: string) => {
      if (!isValidDateKey(dateKey)) return;
      setDayError(null);
      setDaySessions([]);
      setIsDayLoading(true);

      try {
        const sessions = await HistoryQueryService.getDaySessions({ dateKey });
        setDaySessions(sessions);
      } catch (e) {
        logger.error('Failed to load day session details', e);
        setDayError(t('states.errorBody'));
      } finally {
        setIsDayLoading(false);
      }
    },
    [t]
  );

  const incomingDate = typeof rawParams?.date === 'string'
    ? rawParams.date
    : Array.isArray(rawParams?.date)
    ? rawParams.date[0]
    : undefined;

  const initialMountRef = useRef(false);

  // Initial load and navigation handling from Heatmap or deep link
  useEffect(() => {
    let active = true;

    async function init() {
      process.stdout.write(`[DEBUG] init START incomingDate=${incomingDate} initialMount=${initialMountRef.current}\n`);
      if (incomingDate && isValidDateKey(incomingDate)) {
        const [y, m] = incomingDate.split('-').map(Number);
        if (active) {
          setVisibleMonth((prev) => (prev.year === y && prev.month === m ? prev : { year: y, month: m }));
          setSelectedDate(incomingDate);
          setSearchQuery('');
          setStartDate(undefined);
          setEndDate(undefined);
          setIsLoading(true);
        }
        await loadMonthMarks(y, m);
        if (active) {
          setIsLoading(false);
        }
        await loadDaySessions(incomingDate);
      } else if (!initialMountRef.current) {
        initialMountRef.current = true;
        if (active) {
          setIsLoading(true);
        }
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        await loadMonthMarks(currentYear, currentMonth);
        if (active) {
          setIsLoading(false);
          process.stdout.write(`[DEBUG] init FINISHED setIsLoading(false)\n`);
        }
      }
    }

    init();

    return () => {
      process.stdout.write(`[DEBUG] init CLEANUP\n`);
      active = false;
    };
  }, [incomingDate, loadDaySessions, loadMonthMarks]);

  const handleMonthChange = useCallback(
    async (month: DateData) => {
      setVisibleMonth({ year: month.year, month: month.month });
      await loadMonthMarks(month.year, month.month);
    },
    [loadMonthMarks]
  );

  const handleDayPress = useCallback(
    async (day: Pick<DateData, 'dateString'>) => {
      if (!isValidDateKey(day.dateString)) return;
      setSelectedDate(day.dateString);
      await loadDaySessions(day.dateString);
    },
    [loadDaySessions]
  );

  // Search execution
  const executeSearch = useCallback(
    async (filters: { query?: string; startDate?: string; endDate?: string }) => {
      setSearchError(null);
      setIsSearching(true);
      try {
        const result = await HistoryQueryService.searchSessions({
          query: filters.query,
          startDate: filters.startDate,
          endDate: filters.endDate,
          limit: 20,
        });
        setSearchResults(result.sessions);
        setSearchCursor(result.nextCursor);
        setHasMoreSearchResults(result.hasMore);
      } catch (e) {
        logger.error('Failed to search sessions', e);
        setSearchError(t('states.errorBody'));
      } finally {
        setIsSearching(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!isSearchMode) {
      setSearchResults((prev) => (prev.length === 0 ? prev : []));
      setSearchCursor(undefined);
      setHasMoreSearchResults(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch({ query: searchQuery, startDate, endDate });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, startDate, endDate, isSearchMode, executeSearch]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setIsFilterPanelOpen(false);
    setSearchResults([]);
    setSearchCursor(undefined);
    setHasMoreSearchResults(false);
    setSelectedDate('');
  }, []);

  const handleLoadMoreSearchResults = useCallback(async () => {
    if (!hasMoreSearchResults || isLoadingMore || !searchCursor) return;
    setIsLoadingMore(true);
    try {
      const result = await HistoryQueryService.searchSessions({
        query: searchQuery,
        startDate,
        endDate,
        limit: 20,
        cursor: searchCursor,
      });
      setSearchResults((prev) => [...prev, ...result.sessions]);
      setSearchCursor(result.nextCursor);
      setHasMoreSearchResults(result.hasMore);
    } catch (e) {
      logger.error('Failed to load more search results', e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreSearchResults, isLoadingMore, searchCursor, searchQuery, startDate, endDate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isSearchMode) {
      await executeSearch({ query: searchQuery, startDate, endDate });
    } else {
      await loadMonthMarks(visibleMonth.year, visibleMonth.month);
      if (selectedDate) {
        await loadDaySessions(selectedDate);
      }
    }
    setRefreshing(false);
  }, [isSearchMode, executeSearch, searchQuery, startDate, endDate, loadMonthMarks, visibleMonth.year, visibleMonth.month, selectedDate, loadDaySessions]);

  const [undoSnackbar, setUndoSnackbar] = useState<{
    visible: boolean;
    sessionId: number;
    sessionName: string;
    dateString: string;
  }>({
    visible: false,
    sessionId: 0,
    sessionName: '',
    dateString: '',
  });
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast, setToast } = useToast();

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteSession = useCallback(async () => {
    const sId = deleteDialog.sessionId;
    const sName = deleteDialog.sessionName;
    const sDate = selectedDate;
    setDeleteDialog({ visible: false, sessionId: 0, sessionName: '' });

    try {
      await SessionLifecycleService.deleteSession({ sessionId: sId });
      await loadMonthMarks(visibleMonth.year, visibleMonth.month);

      setDaySessions((prev) => prev.filter((s) => s.id !== sId));
      setSearchResults((prev) => prev.filter((s) => s.id !== sId));

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      setUndoSnackbar({
        visible: true,
        sessionId: sId,
        sessionName: sName,
        dateString: sDate,
      });

      undoTimeoutRef.current = setTimeout(() => {
        setUndoSnackbar((prev) => ({ ...prev, visible: false }));
        undoTimeoutRef.current = null;
      }, 10000);
    } catch (e) {
      logger.error('Failed to delete session', e);
      setToast({ visible: true, message: t('states.errorBody'), type: 'error' });
    }
  }, [deleteDialog.sessionId, deleteDialog.sessionName, selectedDate, visibleMonth.year, visibleMonth.month, loadMonthMarks, t, setToast]);

  const handleUndoDelete = useCallback(async () => {
    if (!undoSnackbar.sessionId) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    const sId = undoSnackbar.sessionId;
    const sDate = undoSnackbar.dateString;
    setUndoSnackbar((prev) => ({ ...prev, visible: false }));

    try {
      await SessionLifecycleService.restoreSession({ sessionId: sId });
      await loadMonthMarks(visibleMonth.year, visibleMonth.month);
      if (sDate) {
        await loadDaySessions(sDate);
      }
      if (isSearchMode) {
        await executeSearch({ query: searchQuery, startDate, endDate });
      }
      setToast({ visible: true, message: t('history.undoSuccess'), type: 'success' });
    } catch (e) {
      logger.error('Failed to restore session', e);
      setToast({ visible: true, message: t('history.undoError'), type: 'error' });
    }
  }, [undoSnackbar.sessionId, undoSnackbar.dateString, visibleMonth.year, visibleMonth.month, loadMonthMarks, loadDaySessions, isSearchMode, executeSearch, searchQuery, startDate, endDate, t, setToast]);

  const cardBg = theme.card;
  const textPrimary = theme.text;
  const textMuted = theme.subtext;
  const borderBg = theme.border;

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
      },
    },
  };

  const currentMonthDateString = `${visibleMonth.year}-${String(visibleMonth.month).padStart(2, '0')}-01`;

  const calendarMarkedDates = {
    ...markedDates,
    ...(selectedDate
      ? {
          [selectedDate]: {
            selected: true,
            disableTouchEvent: true,
            selectedColor: Colors.primary,
            selectedTextColor: Colors.onPrimary,
            marked: markedDates[selectedDate]?.marked,
            dotColor: Colors.onPrimary,
          },
        }
      : {}),
  };

  const renderHeader = () => (
    <View>
      {/* Search Bar & Date Filter Affordance */}
      <View className="pt-3 pb-2">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-card border border-border rounded-xl px-3 min-h-[44px]">
            <Text className="text-subtext mr-2" accessible={false}>
              🔍
            </Text>
            <TextInput
              className="flex-1 text-text text-sm py-2"
              placeholder={t('history.searchPlaceholder')}
              placeholderTextColor={textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('history.searchPlaceholder')}
              accessibilityRole="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                className="min-h-[44px] min-w-[44px] items-center justify-center"
                accessibilityLabel={t('common.clear')}
                accessibilityRole="button"
              >
                <Text className="text-subtext text-base font-bold">×</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setIsFilterPanelOpen((prev) => !prev)}
            className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border items-center justify-center flex-row gap-1 ${
              startDate || endDate || isFilterPanelOpen
                ? 'bg-primarySurface border-primary/40'
                : 'bg-card border-border'
            }`}
            accessibilityRole="button"
            accessibilityLabel={t('history.filterDateRange')}
          >
            <Text className="text-base" accessible={false}>
              📅
            </Text>
            {(startDate || endDate) && (
              <View className="w-2 h-2 rounded-full bg-primary" />
            )}
          </TouchableOpacity>
        </View>

        {/* Collapsible Date Range Picker */}
        {isFilterPanelOpen && (
          <View className="mt-3 p-3 bg-card border border-border rounded-xl">
            <Text className="text-text text-xs font-semibold uppercase tracking-wider mb-2">
              {t('history.filterDateRange')}
            </Text>
            <View className="flex-col gap-2">
              <DatePicker
                label={t('history.startDate')}
                value={startDate ? new Date(startDate + 'T00:00:00') : null}
                onChange={(date) => setStartDate(toLocalDateKey(date.getTime()))}
              />
              <DatePicker
                label={t('history.endDate')}
                value={endDate ? new Date(endDate + 'T00:00:00') : null}
                onChange={(date) => setEndDate(toLocalDateKey(date.getTime()))}
              />
            </View>
          </View>
        )}

        {/* Active Filter Chips */}
        {isSearchMode && (
          <View className="flex-row flex-wrap items-center gap-1.5 mt-2.5">
            {searchQuery.trim().length > 0 && (
              <View className="flex-row items-center bg-card border border-border rounded-full px-3 py-1">
                <Text className="text-xs text-text mr-1">
                  {`"${searchQuery.trim()}"`}
                </Text>
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  className="min-h-[44px] min-w-[44px] items-center justify-center -mr-2"
                  accessibilityLabel={t('common.clear')}
                  accessibilityRole="button"
                >
                  <Text className="text-subtext text-xs font-bold">×</Text>
                </TouchableOpacity>
              </View>
            )}

            {startDate && (
              <View className="flex-row items-center bg-card border border-border rounded-full px-3 py-1">
                <Text className="text-xs text-text mr-1">
                  {t('history.startDate')}: {startDate}
                </Text>
                <TouchableOpacity
                  onPress={() => setStartDate(undefined)}
                  className="min-h-[44px] min-w-[44px] items-center justify-center -mr-2"
                  accessibilityLabel={t('common.clear')}
                  accessibilityRole="button"
                >
                  <Text className="text-subtext text-xs font-bold">×</Text>
                </TouchableOpacity>
              </View>
            )}

            {endDate && (
              <View className="flex-row items-center bg-card border border-border rounded-full px-3 py-1">
                <Text className="text-xs text-text mr-1">
                  {t('history.endDate')}: {endDate}
                </Text>
                <TouchableOpacity
                  onPress={() => setEndDate(undefined)}
                  className="min-h-[44px] min-w-[44px] items-center justify-center -mr-2"
                  accessibilityLabel={t('common.clear')}
                  accessibilityRole="button"
                >
                  <Text className="text-subtext text-xs font-bold">×</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={handleClearFilters}
              className="bg-dangerSurface px-3 py-1.5 rounded-full border border-danger/20 items-center justify-center min-h-[44px]"
              accessibilityRole="button"
              accessibilityLabel={t('history.clearFilters')}
            >
              <Text className="text-dangerText font-bold text-xs">
                {t('history.clearFilters')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Calendar Mode: Calendar + Day Section Header */}
      {!isSearchMode && (
        <>
          <View className="pt-2 pb-0">
            <View className="rounded-2xl overflow-hidden border border-border bg-card">
              <Calendar
                current={currentMonthDateString}
                onDayPress={handleDayPress}
                onMonthChange={handleMonthChange}
                markedDates={calendarMarkedDates}
                enableSwipeMonths={true}
                theme={calendarTheme}
              />
            </View>
          </View>

          <View className="pt-4">
            <SectionHeader
              label={
                selectedDate
                  ? `${t('history.workoutsOn')} ${selectedDate.split('-').reverse().join('/')}`
                  : t('history.selectDay')
              }
              className="mb-3"
            />
          </View>
        </>
      )}

      {/* Search Mode: Results Count Header */}
      {isSearchMode && (
        <View className="pt-2">
          <SectionHeader
            label={t('history.searchResultsCount', { count: searchResults.length })}
            className="mb-3"
          />
        </View>
      )}
    </View>
  );

  const renderEmptyContent = () => {
    if (isSearchMode) {
      if (isSearching) {
        return (
          <View className="py-4">
            <SkeletonList count={2} />
          </View>
        );
      }
      if (searchError) {
        return (
          <View className="py-4">
            <View className="border border-dashed border-border rounded-2xl p-6 bg-card items-center">
              <Text className="text-4xl mb-2" accessible={false}>
                ⚠️
              </Text>
              <Text className="text-subtext font-bold text-center">{t('states.errorTitle')}</Text>
              <Text className="text-subtext text-xs text-center mt-1">{searchError}</Text>
              <TouchableOpacity
                className="mt-4 min-h-[44px] bg-primarySurface px-4 rounded-xl border border-primary/20 items-center justify-center"
                onPress={() => executeSearch({ query: searchQuery, startDate, endDate })}
                accessibilityRole="button"
              >
                <Text className="text-primaryText font-bold text-xs">{t('states.retry')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      return (
        <View className="py-4">
          <View className="border border-dashed border-border rounded-2xl p-6 bg-card items-center">
            <Text className="text-4xl mb-2" accessible={false}>
              🔍
            </Text>
            <Text className="text-subtext font-bold text-center">
              {t('history.noSearchResults')}
            </Text>
            <Text className="text-subtext text-xs text-center mt-1">
              {t('history.noSearchResultsDesc')}
            </Text>
            <TouchableOpacity
              className="mt-4 min-h-[44px] bg-primarySurface px-4 rounded-xl border border-primary/20 items-center justify-center"
              onPress={handleClearFilters}
              accessibilityRole="button"
            >
              <Text className="text-primaryText font-bold text-xs">{t('history.clearFilters')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Calendar Mode Empty
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
            <Text className="text-4xl mb-2" accessible={false}>
              ⚠️
            </Text>
            <Text className="text-subtext font-bold text-center">{t('states.errorTitle')}</Text>
            <Text className="text-subtext text-xs text-center mt-1">{dayError}</Text>
            <TouchableOpacity
              className="mt-4 min-h-[44px] bg-primarySurface px-4 rounded-xl border border-primary/20 items-center justify-center"
              onPress={() => selectedDate && loadDaySessions(selectedDate)}
              accessibilityRole="button"
            >
              <Text className="text-primaryText font-bold text-xs">{t('states.retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View className="py-4">
        <View className="border border-dashed border-border rounded-2xl p-6 bg-card items-center">
          <Text className="text-4xl mb-2" accessibilityLabel={t('history.calendarIcon')}>
            📅
          </Text>
          <Text className="text-subtext font-bold text-center">
            {!selectedDate ? t('history.selectDay') : t('history.noWorkouts')}
          </Text>
          <Text className="text-subtext text-xs text-center mt-1">
            {!selectedDate ? t('history.selectDayPrompt') : t('history.noWorkoutsDesc')}
          </Text>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isSearchMode || !isLoadingMore) return null;
    return (
      <View className="py-4 items-center justify-center">
        <ActivityIndicator color={theme.primaryText} />
      </View>
    );
  };

  const renderSessionItem = ({ item, index }: { item: SessionWithExercises; index: number }) => {
    const formattedDate = new Date(item.startTime).toLocaleDateString(getLocaleForLanguage(language), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const formattedTime = new Date(item.startTime).toLocaleTimeString(getLocaleForLanguage(language), {
      hour: '2-digit',
      minute: '2-digit',
    });

    const timeDetail = isSearchMode
      ? `${formattedDate} • ${formattedTime} • ${item.durationMinutes ?? 0} min • ${item.totalSets ?? 0} ${t('session.series')}`
      : `${formattedTime} • ${item.durationMinutes ?? 0} min • ${item.totalSets ?? 0} ${t('session.series')}`;

    return (
      <View className="py-1">
        {index > 0 && <View className="h-px bg-border/60 mb-3" />}
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-text tracking-tight mb-1">{item.routineName}</Text>
            <Text className="text-xs text-subtext mb-2">{timeDetail}</Text>
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
              <Text className="text-primaryText font-black text-2xs">{t('common.view')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-dangerSurface px-2.5 py-1.5 rounded-lg border border-danger/20 items-center justify-center min-w-[52px] min-h-[44px]"
              onPress={() => setDeleteDialog({ visible: true, sessionId: item.id, sessionName: item.routineName ?? '' })}
              accessibilityLabel={`${t('common.delete')} ${item.routineName}`}
              accessibilityRole="button"
            >
              <Text className="text-dangerText font-black text-2xs">{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  process.stdout.write(`RENDER HistoryScreen: isLoading=${isLoading}\n`);
  return (
    <View className="flex-1 bg-background">
      {isLoading ? (
        <View className="flex-1 p-4">
          <SkeletonList count={3} />
        </View>
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadMonthMarks(visibleMonth.year, visibleMonth.month)} />
      ) : (
        <FlatList
          data={isSearchMode ? searchResults : daySessions}
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
          ListEmptyComponent={renderEmptyContent}
          ListFooterComponent={renderFooter}
          onEndReached={isSearchMode ? handleLoadMoreSearchResults : undefined}
          onEndReachedThreshold={0.3}
          renderItem={renderSessionItem}
        />
      )}

      <Dialog
        visible={deleteDialog.visible}
        title={t('history.deleteConfirm')}
        message={t('history.deleteDesc', { name: deleteDialog.sessionName })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        type="destructive"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteDialog({ visible: false, sessionId: 0, sessionName: '' })}
      />

      {undoSnackbar.visible && (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="absolute bottom-6 left-4 right-4 bg-card border border-border rounded-xl p-4 shadow-lg flex-row items-center justify-between z-50"
        >
          <Text className="text-text font-semibold text-sm flex-1 mr-3" numberOfLines={2}>
            {t('history.workoutDeleted')}
          </Text>
          <TouchableOpacity
            className="bg-primary px-4 py-2.5 rounded-lg min-h-[44px] min-w-[44px] items-center justify-center"
            onPress={handleUndoDelete}
            accessibilityRole="button"
            accessibilityLabel={`${t('history.undo')} ${undoSnackbar.sessionName}`}
          >
            <Text className="text-onPrimary font-bold text-sm">{t('history.undo')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}
