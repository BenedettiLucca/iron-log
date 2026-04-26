import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../src/db/client';
import { sessions, bodyMetrics, sets, personalRecords } from '../../src/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import Slider from '@react-native-community/slider';
import { Button } from '../../components/Button';
import { Stopwatch } from '../../components/Stopwatch';
import { Dialog } from '../../components/Dialog';
import { logger } from '@/services/logger';
import { Colors } from '@/constants/colors';
import { safeParseParams, finishParamsSchema } from '@/src/validators/routes';
import { rpeSchema } from '@/src/validators/forms';

interface NoteTemplate {
  label: string;
  emoji: string;
  text: string;
}

const NOTE_TEMPLATES: NoteTemplate[] = [
  { label: 'Jejum', emoji: '🍽️', text: 'Treino feito em jejum' },
  { label: 'Ruim', emoji: '😴', text: 'Dia ruim, baixa energia' },
  { label: 'PR!', emoji: '🏆', text: 'Recorde pessoal batido!' },
  { label: 'Cardio', emoji: '❤️', text: 'Incluí cardio extra' },
];

const SRPE_DESCRIPTIONS: Record<number, string> = {
  1: 'Recuperação',
  2: 'Muito Leve',
  3: 'Leve',
  4: 'Moderado',
  5: 'Moderado',
  6: 'Intenso',
  7: 'Muito Intenso',
  8: 'Extremo',
  9: 'Máximo',
  10: 'Falha',
};

export default function FinishSessionScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const validated = safeParseParams(finishParamsSchema, rawParams, 'FinishScreen');
  const sessionId = validated?.sessionId ?? 0;
  const startTime = validated?.startTime ?? Date.now();

  const [weight, setWeight] = useState('');
  const [previousWeight, setPreviousWeight] = useState<number | null>(null);
  const [lastWeightDate, setLastWeightDate] = useState<string>('');
  const [sRpe, setSRpe] = useState<number>(7);
  const [notes, setNotes] = useState('');
  const [sessionStats, setSessionStats] = useState({
    totalSets: 0,
    totalVolume: 0,
    totalExercises: 0,
    completedExercises: 0,
    prCount: 0,
  });
  const [isFinishing, setIsFinishing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Pré-carregar peso da Bio e calcular estatísticas
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load last weight
        const lastMetrics = await db.select({ weight: bodyMetrics.weight, date: bodyMetrics.date })
          .from(bodyMetrics)
          .where(eq(bodyMetrics.type, 'daily'))
          .orderBy(desc(bodyMetrics.date))
          .limit(1);

        if (lastMetrics.length > 0 && lastMetrics[0].weight) {
          setWeight(lastMetrics[0].weight.toString());
          setPreviousWeight(lastMetrics[0].weight);

          const date = new Date(lastMetrics[0].date);
          setLastWeightDate(date.toLocaleDateString());
        }

        // Calculate session statistics
        const sessionIdNum = Number(sessionId);

        // Get all sets for this session
        const sessionSets = await db.select()
          .from(sets)
          .where(and(eq(sets.sessionId, sessionIdNum), isNull(sets.deletedAt)));

        // Calculate total volume (weight × reps for strength exercises)
        let totalVolume = 0;
        let totalSets = sessionSets.length;

        for (const set of sessionSets) {
          if (set.reps && set.weightKg) {
            totalVolume += set.reps * set.weightKg;
          }
        }

        // Count unique exercises
        const uniqueExercises = new Set(sessionSets.map(s => s.exerciseId)).size;

        // Count PRs from this session
        const prs = await db.select({ count: sql<number>`count(*)` })
          .from(personalRecords)
          .where(eq(personalRecords.sessionId, sessionId));
        const prCount = prs[0]?.count ?? 0;

        setSessionStats({
          totalSets,
          totalVolume,
          totalExercises: uniqueExercises,
          completedExercises: uniqueExercises,
          prCount,
        });

      } catch (e) {
        logger.error('Operation failed', "Erro ao carregar dados:", e);
      }
    };
    loadData();
  }, [sessionId]);

  const adjustWeight = useCallback((delta: number) => {
    const current = parseFloat(weight) || 0;
    const newValue = Math.max(0, current + delta);
    setWeight(newValue.toString());
  }, [weight]);

  const insertTemplate = useCallback((template: NoteTemplate) => {
    const currentText = notes.trim();
    const newText = currentText ? `${currentText}\n${template.text}` : template.text;
    setNotes(newText);
  }, [notes]);

  const handleFinish = () => {
    if (isFinishing) return;
    setShowConfirmDialog(true);
  };

  const confirmFinish = async () => {
    setIsFinishing(true);
    setShowConfirmDialog(false);

    try {
      const endTimestamp = Date.now();
      const startTimestamp = Number(startTime);
      const durationMinutes = Math.round((endTimestamp - startTimestamp) / 60000);

      // 1. Atualizar Sessão
      await db.update(sessions)
        .set({
          endTime: endTimestamp,
          durationMinutes: durationMinutes > 0 ? durationMinutes : 1,
          bodyWeight: weight ? Number(weight) : null,
          sRpe: (() => { const r = rpeSchema.safeParse(sRpe); return r.success ? r.data : 7; })(),
          notes: notes
        })
        .where(eq(sessions.id, Number(sessionId)));

      // 2. Salvar Peso na Bio (Sincronização)
      if (weight) {
        await db.insert(bodyMetrics).values({
          date: endTimestamp,
          type: 'daily',
          weight: Number(weight)
        });
      }

      // 3. Clear incomplete session marker
      await AsyncStorage.removeItem('incomplete_session');

      // Navegar para o resumo
      router.replace({
        pathname: '/session/summary',
        params: { sessionId }
      });

    } catch (e) {
      logger.error('Operation failed', e);
      setShowConfirmDialog(false);
      setIsFinishing(false);
    }
  };

  const getWeightDiff = useCallback(() => {
    if (!previousWeight || !weight) return null;
    const current = parseFloat(weight);
    const diff = current - previousWeight;
    if (Math.abs(diff) < 0.1) return null;
    return diff;
  }, [previousWeight, weight]);

  const weightDiff = getWeightDiff();

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="text-text text-3xl font-bold mb-2">Finalizar Treino</Text>
        <Text className="text-subtext mb-6">Revise seus dados antes de salvar</Text>

        {/* Session Statistics Card */}
        <View className="bg-card p-4 rounded-xl border border-border mb-6">
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">Estatísticas da Sessão</Text>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-text text-3xl font-bold">{sessionStats.totalSets}</Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">Séries</Text>
            </View>
            <View className="items-center">
              <Text className="text-text text-3xl font-bold">{sessionStats.totalExercises}</Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">Exercícios</Text>
            </View>
            <View className="items-center">
              <Text className="text-text text-3xl font-bold">
                {sessionStats.totalVolume >= 1000
                  ? `${(sessionStats.totalVolume / 1000).toFixed(1)}k`
                  : sessionStats.totalVolume}
              </Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">kg Volume</Text>
            </View>
          </View>
        </View>

        {/* Session Duration */}
        <View className="bg-card p-4 rounded-xl border border-border mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-1">Duração</Text>
            <View className="flex-row items-center gap-2">
              <Stopwatch startTime={Number(startTime)} />
            </View>
          </View>
        </View>

        {/* Peso Corporal */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-subtext font-bold uppercase text-sm tracking-wider">Peso Corporal (KG)</Text>
            {lastWeightDate && (
              <Text className="text-subtext text-xs">Último: {lastWeightDate}</Text>
            )}
          </View>

          <View className="flex-row items-center gap-3">
            <TextInput
              className="flex-1 bg-card text-text text-4xl font-bold py-4 px-5 rounded-xl border border-border text-center"
              keyboardType="numeric"
              placeholder="82.5"
              placeholderTextColor={Colors.darkSubtext}
              value={weight}
              onChangeText={setWeight}
              textAlign="center"
            />

            <View className="gap-2">
              <TouchableOpacity
                className="bg-background px-4 py-3 rounded-lg border border-border min-w-[60px] items-center"
                onPress={() => adjustWeight(-0.5)}
                accessibilityLabel="Diminuir peso 0.5kg"
                accessibilityRole="button"
              >
                <Text className="text-text text-sm font-semibold">-0.5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-background px-4 py-3 rounded-lg border border-border min-w-[60px] items-center"
                onPress={() => adjustWeight(0.5)}
                accessibilityLabel="Aumentar peso 0.5kg"
                accessibilityRole="button"
              >
                <Text className="text-text text-sm font-semibold">+0.5</Text>
              </TouchableOpacity>
            </View>
          </View>

          {weightDiff !== null && (
            <Text className={`text-xs font-semibold mt-2 ${weightDiff > 0 ? 'text-success' : 'text-danger'}`}>
              {weightDiff > 0 ? '↑' : '↓'} {Math.abs(weightDiff).toFixed(1)}kg vs. anterior
            </Text>
          )}
        </View>

        {/* sRPE Selector */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-subtext font-bold uppercase text-sm tracking-wider">Esforço Percebido (sRPE)</Text>
            <View className="bg-primary px-4 py-1.5 rounded-full">
              <Text className="text-white font-bold text-xl">{sRpe}</Text>
            </View>
          </View>

          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={sRpe}
            onValueChange={setSRpe}
            minimumTrackTintColor={Colors.primary}
            maximumTrackTintColor={Colors.gray300}
            thumbTintColor={Colors.primary}
          />

          <View className="flex-row justify-between px-1 mt-1">
            <Text className="text-subtext text-xs">REGENERATIVO</Text>
            <Text className="text-subtext text-xs">MÁXIMO</Text>
          </View>

          <View className="bg-background mt-4 p-4 rounded-xl border border-border">
            <Text className="text-text text-center font-semibold text-lg">
              {SRPE_DESCRIPTIONS[sRpe] || 'Moderado'}
            </Text>
            <Text className="text-subtext text-center text-xs mt-1">
              {sRpe <= 4 ? 'Treino leve, pode treinar novamente amanhã' :
                sRpe <= 6 ? 'Treino moderado, recuperação normal' :
                  sRpe <= 8 ? 'Treino intenso, precisa de descanso' :
                    'Treino extremo, descanse bem'}
            </Text>
          </View>
        </View>

        {/* Note Templates */}
        <View className="mb-6">
          <Text className="text-subtext font-bold mb-2 uppercase text-sm tracking-wider">Notas Rápidas</Text>
          <View className="flex-row flex-wrap gap-2">
            {NOTE_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.label}
                className="bg-card px-3 py-2.5 rounded-lg border border-border flex-row items-center gap-1.5"
                onPress={() => insertTemplate(template)}
              >
                <Text className="text-base">{template.emoji}</Text>
                <Text className="text-text text-sm font-semibold">{template.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notas */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-subtext font-bold uppercase text-sm tracking-wider">Observações</Text>
            {notes.length > 0 && (
              <Text className="text-subtext text-xs">{notes.length} caracteres</Text>
            )}
          </View>
          <TextInput
            className="bg-card text-text text-base p-4 rounded-xl border border-border min-h-[120px]"
            multiline
            placeholder="Como você se sentiu? Dores, ajustes de carga, energia..."
            placeholderTextColor={Colors.darkSubtext}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </View>

        <Button
          title={isFinishing ? 'FINALIZANDO...' : 'GERAR RELATÓRIO'}
          onPress={handleFinish}
          variant="success"
          size="lg"
          fullWidth
          disabled={isFinishing}
          style={{ marginTop: 8 }}
        />

      </ScrollView>

      <Dialog
        visible={showConfirmDialog}
        title="Finalizar Treino?"
        message={`Confira os dados antes de finalizar:\n\n` +
          `• ${sessionStats.totalSets} séries\n` +
          `• ${sessionStats.totalExercises} exercícios\n` +
          `• ${(sessionStats.totalVolume / 1000).toFixed(1)} toneladas de volume\n` +
          `• Peso: ${weight || 'N/A'} kg\n` +
          `• sRPE: ${sRpe}`}
        confirmText="Confirmar"
        cancelText="Voltar"
        onConfirm={confirmFinish}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </View>
  );
}
