import { View, Text, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { db } from '../../src/db/client';
import { sessions, sets, routineExercises } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as Clipboard from 'expo-clipboard';

export default function SummaryScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams();
  const [report, setReport] = useState('Gerando relatório...');

  useEffect(() => {
    generateMarkdown();
  }, []);

  const generateMarkdown = async () => {
    try {
      // 1. Buscar Sessão
      const sessionData = await db.select().from(sessions).where(eq(sessions.id, Number(sessionId)));
      if (!sessionData.length) return;
      const session = sessionData[0];

      // 2. Buscar Sets
      const setsData = await db.select().from(sets).where(eq(sets.sessionId, Number(sessionId)));

      // 3. Buscar Targets da Rotina (Se houver routineId)
      const targetsMap = new Map<number, string>();
      if (session.routineId) {
          const reData = await db.select({
              exId: routineExercises.exerciseId,
              target: routineExercises.target
          })
          .from(routineExercises)
          .where(eq(routineExercises.routineId, session.routineId));
          
          reData.forEach(r => {
              if (r.exId && r.target) targetsMap.set(r.exId, r.target);
          });
      }

      // 4. Agrupar por Exercício
      const exercisesMap = new Map<string, { sets: any[], exId: number }>();
      
      setsData.forEach(set => {
        const exName = set.exerciseName || `Exercício ${set.exerciseId}`;
        if (!exercisesMap.has(exName)) {
          exercisesMap.set(exName, { sets: [], exId: set.exerciseId });
        }
        exercisesMap.get(exName)?.sets.push(set);
      });

      // 5. Formatar Data
      const dateObj = new Date(session.startTime);
      const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

      // 6. Montar String
      let md = `TREINO ${session.routineName} - [${dateStr}]\n\n`;
      md += `Peso: ${session.bodyWeight || 'N/A'} kg | Duração: ${session.durationMinutes} min | sRPE: ${session.sRpe}\n\n`;

      exercisesMap.forEach((data, exName) => {
        const { sets: setsList, exId } = data;
        
        // Ordenar sets
        setsList.sort((a, b) => a.setNumber - b.setNumber);
        
        // Formatar cada set
        const setsStr = setsList.map(s => {
          let coreStr = "";
          if (s.durationSeconds) {
              coreStr = `${s.durationSeconds}s`;
              if (s.weightKg > 0) coreStr += `x${s.weightKg}kg`;
          } else {
              coreStr = `${s.reps}x${s.weightKg}kg`;
          }
          return `S${s.setNumber}: ${coreStr}${s.rir !== null ? `xRIR${s.rir}` : ''}`;
        }).join(" | ");

        // Header com Meta
        const target = targetsMap.get(exId);
        const header = target ? `[${exName}] (Meta: ${target})` : `[${exName}]`;

        md += `${header}: ${setsStr}\n`;
      });

      if (session.notes) {
        md += `\nObservações: ${session.notes}`;
      }

      setReport(md);

    } catch (e) {
      console.error(e);
      setReport('Erro ao gerar relatório.');
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(report);
    Alert.alert('Copiado!', 'Relatório pronto para colar no WhatsApp/Notes.');
  };

  const goHome = () => {
    // Reseta a navegação para Home
    router.replace('/');
  };

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-text text-2xl font-bold mb-4 mt-8">Resumo do Treino</Text>

      <View className="flex-1 bg-card p-4 rounded-xl border border-border mb-6">
        <ScrollView>
          <Text className="text-text font-mono text-sm leading-6 select-text">
            {report}
          </Text>
        </ScrollView>
      </View>

      <View className="gap-3">
        <TouchableOpacity 
          className="bg-primary p-4 rounded-xl items-center flex-row justify-center gap-2"
          onPress={copyToClipboard}
        >
          <Text className="text-white font-bold text-lg uppercase">Copiar Texto</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-card p-4 rounded-xl items-center border border-border"
          onPress={goHome}
        >
          <Text className="text-subtext font-bold text-lg">Voltar ao Início</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}