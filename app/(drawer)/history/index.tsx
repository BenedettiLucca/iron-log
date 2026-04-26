import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, useColorScheme, RefreshControl, ScrollView } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter, Stack } from 'expo-router';
import { db } from '../../../src/db/client';
import { sessions } from '../../../src/db/schema';
import { desc } from 'drizzle-orm';
import { Card } from '../../../components/Card';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, { marked: boolean; dotColor: string }>>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [daySessions, setDaySessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Theme Colors
  const colors = {
    background: isDark ? '#2A2422' : '#FFFFFF',
    calendarBackground: isDark ? '#2A2422' : '#FFFFFF',
    text: isDark ? '#F4F1DE' : '#3D405B',
    subtext: isDark ? '#9CA3AF' : '#818185',
    primary: '#E07A5F',
    secondary: '#3D5A80',
    border: isDark ? '#605050' : '#E0E0E0',
  };

  const loadSessions = useCallback(async () => {
    try {
      const result = await db.select().from(sessions).where(isNull(sessions.deletedAt)).orderBy(desc(sessions.startTime));
      setAllSessions(result);

      const marks: any = {};
      result.forEach(s => {
        const dateStr = new Date(s.startTime).toISOString().split('T')[0];
        marks[dateStr] = {
            marked: true,
            dotColor: colors.primary,
        };
      });
      setMarkedDates(marks);
    } catch (e) {
      logger.error('Operation failed', e);
    }
  }, [colors.primary]);

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

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Histórico' }} />

      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor="#E07A5F"
        colors={['#E07A5F']}
      >
      <ScrollView
        className="flex-1"
        scrollEnabled={false}
      >
      <View className="p-4 pb-0">
        <View className="rounded-2xl overflow-hidden border border-border shadow-sm bg-card">
            <Calendar
            onDayPress={handleDayPress}
            markedDates={{
                ...markedDates,
                [selectedDate]: {
                    selected: true,
                    disableTouchEvent: true,
                    selectedColor: colors.primary,
                    selectedTextColor: '#FFFFFF',
                    marked: markedDates[selectedDate]?.marked,
                    dotColor: '#FFFFFF'
                }
            }}
            enableSwipeMonths={true}
            theme={{
                backgroundColor: colors.calendarBackground,
                calendarBackground: colors.calendarBackground,
                textSectionTitleColor: colors.subtext,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: colors.secondary,
                dayTextColor: colors.text,
                textDisabledColor: isDark ? '#444' : '#D1D5DB',
                dotColor: colors.primary,
                selectedDotColor: '#FFFFFF',
                arrowColor: colors.primary,
                monthTextColor: colors.text,
                indicatorColor: colors.primary,
                textDayFontWeight: '600',
                textMonthFontWeight: '900',
                textDayHeaderFontWeight: '800',
                textDayFontSize: 14,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 10,
                // Custom spacing
                'stylesheet.calendar.header': {
                    week: {
                        marginTop: 10,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingHorizontal: 10,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        paddingTop: 10
                    }
                }
            }}
            />
        </View>
      </View>

      <View className="p-4">
        <Text className="text-subtext font-black uppercase text-[10px] mb-3 tracking-widest pl-1">
            {selectedDate ? `Treinos em ${selectedDate.split('-').reverse().join('/')}` : 'Selecione um dia'}
        </Text>

        <FlatList
          data={daySessions}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          style={{ maxHeight: 400 }}
          scrollEnabled={true}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center mt-10 opacity-50">
                <Text className="text-4xl mb-2">📅</Text>
                <Text className="text-subtext font-bold text-center">Nenhum treino</Text>
                <Text className="text-subtext text-xs text-center">Nenhum registro para esta data.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card 
              pressable
              onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: item.id } })}
            >
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-text font-black text-lg mb-1 tracking-tight">{item.routineName}</Text>
                  <Text className="text-subtext text-xs font-bold uppercase tracking-wider">
                      {new Date(item.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {item.durationMinutes} min
                  </Text>
                </View>
                <View className="bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                    <Text className="text-primary font-black text-[10px] uppercase tracking-wider">Ver</Text>
                </View>
              </View>
            </Card>
          )}
        />
      </View>
      </ScrollView>
      </RefreshControl>
    </View>
  );
}
