import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter, Stack } from 'expo-router';
import { db } from '../../../src/db/client';
import { sessions } from '../../../src/db/schema';
import { desc } from 'drizzle-orm';
import { Card } from '../../../components/Card';
import { SkeletonList } from '../../../components/Skeleton';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';
import { Colors } from '@/constants/colors';

// Configuração de Locale PT-BR
LocaleConfig.locales['br'] = {
  monthNames: ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'],
  monthNamesShort: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'],
  today: 'HOJE'
};
LocaleConfig.defaultLocale = 'br';

export default function HistoryScreen() {
  const router = useRouter();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, { marked: boolean; dotColor: string }>>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [daySessions, setDaySessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
      logger.error('Operation failed', e);
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

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    const filtered = allSessions.filter(s => {
      const sDate = new Date(s.startTime).toISOString().split('T')[0];
      return sDate === day.dateString;
    });
    setDaySessions(filtered);
  };

  const calendarTheme = {
    backgroundColor: Colors.lightCard,
    calendarBackground: Colors.lightCard,
    textSectionTitleColor: Colors.lightSubtext,
    selectedDayBackgroundColor: Colors.primary,
    selectedDayTextColor: Colors.white,
    todayTextColor: Colors.secondary,
    dayTextColor: Colors.lightText,
    textDisabledColor: Colors.gray300,
    dotColor: Colors.primary,
    selectedDotColor: Colors.white,
    arrowColor: Colors.primary,
    monthTextColor: Colors.lightText,
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
        borderTopColor: Colors.lightBorder,
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
          {selectedDate ? `Treinos em ${selectedDate.split('-').reverse().join('/')}` : 'Selecione um dia'}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="justify-center items-center mt-10 opacity-50">
      <Text className="text-4xl mb-2" accessibilityLabel="Ícone de calendário">📅</Text>
      <Text className="text-subtext font-bold text-center">Nenhum treino</Text>
      <Text className="text-subtext text-xs text-center">Nenhum registro para esta data.</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Histórico' }} />

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
            <Card
              pressable
              onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: item.id } })}
              accessibilityLabel={`Ver resumo do treino ${item.routineName}`}
              accessibilityRole="button"
            >
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-text font-black text-lg mb-1 tracking-tight">{item.routineName}</Text>
                  <Text className="text-subtext text-xs font-bold uppercase tracking-wider">
                    {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.durationMinutes} min
                  </Text>
                </View>
                <View className="bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                  <Text className="text-primary font-black text-xs uppercase tracking-wider">Ver</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
