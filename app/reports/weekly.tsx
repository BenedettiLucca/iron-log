import {
  View,
  Text,
  ScrollView,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Toast } from '@/components/Toast';
import { StatTile } from '@/components/StatTile';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState, LoadingState } from '@/components/ScreenState';
import { NotionExportService } from '@/services/NotionExportService';
import { useI18n } from '@/src/i18n/index';
import { logger } from '@/services/logger';
import { formatDateShort, getWeekNumber } from '@/src/utils/date-utils';

export default function WeeklyReportScreen() {
  const { t } = useI18n();
  const theme = useThemeColors();
  const [markdown, setMarkdown] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [avgSRPE, setAvgSRPE] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const generateReport = useCallback(async () => {
    setHasError(false);
    try {
      setLoading(true);
      const result = await NotionExportService.exportWeeklyReport(t);
      setMarkdown(result.markdown);
      setSessionCount(result.sessionCount);
      setTotalVolume(result.totalVolume);
      setAvgSRPE(result.avgSRPE);
    } catch (e) {
      logger.error('Failed to generate weekly report', e);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const handleCopy = async () => {
    try {
      await NotionExportService.copyToClipboard(markdown);
      setToastMessage(t('reports.copied'));
      setShowToast(true);
    } catch (e) {
      logger.error('Failed to copy', e);
      setToastMessage(t('reports.copyError'));
      setShowToast(true);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <LoadingState />
      </View>
    );
  }

  if (hasError) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          message={t('reports.exportError')}
          onRetry={generateReport}
        />
      </View>
    );
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const dateRange = `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
  const weekNum = getWeekNumber(now);
  const periodLabel = `${t('reports.md.week') || 'Semana'} ${weekNum}`;

  const volumeDisplay = totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume;

  if (sessionCount === 0) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon="📋"
          title={t('reports.noSessions')}
        />
        <Toast
          visible={showToast}
          message={toastMessage}
          type="error"
          onHide={() => setShowToast(false)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5 gap-4">
        {/* Header */}
        <Text className="text-text text-2xl font-bold">{t('reports.title')}</Text>

        {/* Period Banner */}
        <Card
          contentPadding={false}
          className="overflow-hidden"
          style={{ borderTopWidth: 3, borderTopColor: theme.primaryText }}
        >
          <View className="p-3.5 flex-row justify-between items-center">
            <View>
              <Text className="text-2xs font-extrabold text-primaryText uppercase tracking-wider">{periodLabel}</Text>
              <Text className="text-sm font-bold text-text mt-0.5">{dateRange}</Text>
            </View>
            {sessionCount > 0 && (
              <View className="flex-row items-center gap-1.5 bg-successSurface px-2.5 py-1 rounded-full border border-success/15">
                <View className="w-1.5 h-1.5 rounded-full bg-success" />
                <Text className="text-2xs font-bold text-successText">{t('reports.completed') || 'Concluído'}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Stats Grid */}
        {sessionCount > 0 && (
          <View className="flex-row gap-2.5">
            <StatTile value={sessionCount} label={t('reports.sessions')} accentColor="secondary" className="flex-1" />
            <StatTile value={volumeDisplay} label={t('reports.volume')} accentColor="primary" className="flex-1" />
            <StatTile value={avgSRPE || '—'} label={t('reports.avgSrpe')} accentColor="warning" className="flex-1" />
          </View>
        )}

        {/* Markdown Preview */}
        <Card>
          <Text className="text-sm font-bold text-text mb-3">📄 {t('reports.summary')}</Text>
          <View className="bg-primary/5 rounded-xl p-3 border border-border/50">
            <Text className="text-text text-xs leading-5 font-mono select-text">
              {markdown}
            </Text>
          </View>
        </Card>

        {/* Copy Button */}
        {markdown.length > 0 && (
          <Button
            title={t('reports.copyNotion')}
            onPress={handleCopy}
            variant="primary"
            size="lg"
            fullWidth
          />
        )}
      </ScrollView>

      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastMessage === t('reports.copied') ? 'success' : 'error'}
        onHide={() => setShowToast(false)}
      />
    </View>
  );
}
