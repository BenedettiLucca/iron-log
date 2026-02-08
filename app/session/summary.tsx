import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  StyleSheet
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { db } from '../../src/db/client';
import { sessions, sets, routineExercises, sessions as sessionsTable } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

interface ExerciseSummary {
  name: string;
  sets: any[];
  exId: number;
  target?: string;
}

interface SessionStats {
  totalSets: number;
  totalVolume: number;
  bestSet: { weight: number; reps: number; exercise: string } | null;
  averageIntensity: number;
}

export default function SummaryScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams();
  const [report, setReport] = useState('Gerando relatório...');
  const [sessionData, setSessionData] = useState<any>(null);
  const [stats, setStats] = useState<SessionStats>({
    totalSets: 0,
    totalVolume: 0,
    bestSet: null,
    averageIntensity: 0,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateMarkdown();
  }, []);

  const generateMarkdown = async () => {
    try {
      // 1. Buscar Sessão
      const sessionDataResult = await db.select().from(sessionsTable).where(eq(sessionsTable.id, Number(sessionId)));
      if (!sessionDataResult.length) return;
      const session = sessionDataResult[0];
      setSessionData(session);

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
      const exercisesMap = new Map<string, ExerciseSummary>();

      setsData.forEach(set => {
        const exName = set.exerciseName || `Exercício ${set.exerciseId}`;
        if (!exercisesMap.has(exName)) {
          exercisesMap.set(exName, { sets: [], exId: set.exerciseId, name: exName });
        }
        exercisesMap.get(exName)!.sets.push(set);
      });

      // Add targets to exercises
      exercisesMap.forEach((data, exName) => {
        const target = targetsMap.get(data.exId);
        if (target) data.target = target;
      });

      // 5. Calculate statistics
      let totalVolume = 0;
      let maxVolume = 0;
      let bestSet: { weight: number; reps: number; exercise: string } | null = null;

      setsData.forEach(set => {
        if (set.reps && set.weightKg) {
          const volume = set.reps * set.weightKg;
          totalVolume += volume;

          if (volume > maxVolume) {
            maxVolume = volume;
            bestSet = {
              weight: set.weightKg,
              reps: set.reps,
              exercise: set.exerciseName || 'Unknown',
            };
          }
        }
      });

      setStats({
        totalSets: setsData.length,
        totalVolume,
        bestSet,
        averageIntensity: setsData.length > 0 ? totalVolume / setsData.length : 0,
      });

      // 6. Formatar Data
      const dateObj = new Date(session.startTime);
      const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

      // 7. Montar String
      let md = `💪 TREINO ${session.routineName} - [${dateStr}]\n\n`;
      md += `⚖️ Peso: ${session.bodyWeight || 'N/A'} kg | ⏱️ Duração: ${session.durationMinutes} min | 🔥 sRPE: ${session.sRpe}\n\n`;

      exercisesMap.forEach((data) => {
        const { sets: setsList, target } = data;

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
        const header = target ? `[${data.name}] (Meta: ${target})` : `[${data.name}]`;

        md += `${header}: ${setsStr}\n`;
      });

      if (session.notes) {
        md += `\n📝 Observações: ${session.notes}`;
      }

      setReport(md);

    } catch (e) {
      console.error(e);
      setReport('Erro ao gerar relatório.');
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Copiado!', 'Relatório pronto para colar no WhatsApp/Notes.');
  };

  const nativeShare = async () => {
    try {
      await Share.share({
        message: report,
        title: `Treino ${sessionData?.routineName || 'Iron Log'}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const goHome = () => {
    router.replace('/');
  };

  const getMotivationalMessage = () => {
    const srpe = sessionData?.sRpe || 7;
    if (srpe <= 4) return '💪 Ótimo treino leve!';
    if (srpe <= 6) return '🔥 Treino consistente!';
    if (srpe <= 8) return '⚡ Trabalho duro!';
    return '🏆 Esforço hercúleo!';
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.celebration}>🎉</Text>
          <Text style={styles.headerTitle}>Treino Concluído!</Text>
          <Text style={styles.motivational}>{getMotivationalMessage()}</Text>
        </View>

        {/* Stats Dashboard */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalSets}</Text>
            <Text style={styles.statLabel}>Séries</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.totalVolume >= 1000
                ? `${(stats.totalVolume / 1000).toFixed(1)}k`
                : stats.totalVolume}
            </Text>
            <Text style={styles.statLabel}>kg Volume</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{sessionData?.sRpe || '-'}</Text>
            <Text style={styles.statLabel}>sRPE</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{sessionData?.durationMinutes || 0}</Text>
            <Text style={styles.statLabel}>Minutos</Text>
          </Card>
        </View>

        {/* Best Performance */}
        {stats.bestSet && (
          <Card style={styles.bestSetCard}>
            <Text style={styles.bestSetTitle}>🏆 Melhor Série</Text>
            <Text style={styles.bestSetValue}>
              {stats.bestSet.weight}kg × {stats.bestSet.reps} reps
            </Text>
            <Text style={styles.bestSetExercise}>{stats.bestSet.exercise}</Text>
          </Card>
        )}

        {/* Markdown Report */}
        <Card style={styles.reportCard}>
          <Text style={styles.reportTitle}>📄 Relatório Completo</Text>
          <ScrollView style={styles.reportContent}>
            <Text style={styles.reportText} selectable>
              {report}
            </Text>
          </ScrollView>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title={copied ? '✓ Copiado' : '📋 Copiar Texto'}
            onPress={copyToClipboard}
            variant="primary"
            size="lg"
            fullWidth
            style={styles.actionButton}
          />

          <Button
            title="📤 Compartilhar"
            onPress={nativeShare}
            variant="secondary"
            size="lg"
            fullWidth
            style={styles.actionButton}
          />

          <Button
            title="🏠 Voltar ao Início"
            onPress={goHome}
            variant="ghost"
            size="md"
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1DE',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 20,
  },
  celebration: {
    fontSize: 64,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3D405B',
    marginTop: 8,
  },
  motivational: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E07A5F',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3D405B',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  bestSetCard: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#FFFBF0',
    borderColor: '#F2CC8F',
  },
  bestSetTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bestSetValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3D405B',
  },
  bestSetExercise: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E07A5F',
    marginTop: 4,
  },
  reportCard: {
    marginBottom: 20,
    maxHeight: 300,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D405B',
    marginBottom: 12,
  },
  reportContent: {
    maxHeight: 240,
  },
  reportText: {
    fontSize: 12,
    lineHeight: 20,
    color: '#3D405B',
    fontFamily: 'monospace',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    minHeight: 52,
  },
});
