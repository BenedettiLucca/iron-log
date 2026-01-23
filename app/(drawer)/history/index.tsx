import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter, Stack } from 'expo-router';
import { db } from '../../../src/db/client';
import { sessions } from '../../../src/db/schema';
import { desc } from 'drizzle-orm';

// Configuração de Locale PT-BR
LocaleConfig.locales['br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'br';

export default function HistoryScreen() {
  const router = useRouter();
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [daySessions, setDaySessions] = useState<any[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const result = await db.select().from(sessions).orderBy(desc(sessions.startTime));
      setAllSessions(result);
      
      const marks: any = {};
      result.forEach(s => {
        const dateStr = new Date(s.startTime).toISOString().split('T')[0];
        marks[dateStr] = { 
            marked: true, 
            dotColor: '#E07A5F', 
        };
      });
      setMarkedDates(marks);
    } catch (e) {
      console.error(e);
    }
  };

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

      <View className="bg-card border-b border-border pb-2">
        <Calendar
          onDayPress={handleDayPress}
          markedDates={{
            ...markedDates,
            [selectedDate]: { 
                selected: true, 
                disableTouchEvent: true, 
                selectedColor: '#E07A5F', 
                selectedTextColor: '#fff' 
            }
          }}
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            textSectionTitleColor: '#3D405B',
            selectedDayBackgroundColor: '#E07A5F',
            selectedDayTextColor: '#fff',
            todayTextColor: '#E07A5F',
            dayTextColor: '#3D405B',
            textDisabledColor: '#9CA3AF',
            dotColor: '#E07A5F',
            selectedDotColor: '#fff',
            arrowColor: '#E07A5F',
            monthTextColor: '#3D405B',
            indicatorColor: '#E07A5F',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 14
          }}
        />
      </View>

      <View className="flex-1 p-4">
        <Text className="text-subtext font-bold uppercase text-xs mb-4 tracking-widest">
            {selectedDate ? `Treinos em ${selectedDate.split('-').reverse().join('/')}` : 'Selecione um dia'}
        </Text>

        <FlatList
          data={daySessions}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            selectedDate ? 
            <Text className="text-subtext text-center italic">Nenhum treino neste dia.</Text> : 
            <Text className="text-subtext text-center italic">Toque no calendário para ver os detalhes.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="bg-card p-4 rounded-xl border border-border mb-3 flex-row justify-between items-center shadow-sm"
              onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: item.id } })}
            >
              <View>
                <Text className="text-text font-bold text-lg">{item.routineName}</Text>
                <Text className="text-subtext text-sm">
                    {new Date(item.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {item.durationMinutes} min
                </Text>
              </View>
              <View className="bg-primary px-3 py-1 rounded">
                  <Text className="text-white font-bold text-xs uppercase">Ver</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}
