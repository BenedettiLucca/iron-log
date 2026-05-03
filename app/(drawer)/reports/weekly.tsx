import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Toast } from '../../../components/Toast';
import { NotionExportService } from '../../../services/NotionExportService';
import { useI18n } from '../../../src/i18n/index';
import { logger } from '@/services/logger';

export default function WeeklyReportScreen() {
  const { t } = useI18n();
  const [markdown, setMarkdown] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [avgSRPE, setAvgSRPE] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const generateReport = useCallback(async () => {
    try {
      setLoading(true);
      const result = await NotionExportService.exportWeeklyReport();
      setMarkdown(result.markdown);
      setSessionCount(result.sessionCount);
      setTotalVolume(result.totalVolume);
      setAvgSRPE(result.avgSRPE);
    } catch (e) {
      logger.error('Failed to generate weekly report', e);
      setToastMessage(t('reports.exportError'));
      setShowToast(true);
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
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#E07A5F" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5">
        {/* Header */}
        <Text className="text-text text-2xl font-bold mb-4">{t('reports.title')}</Text>

        {/* Summary Cards */}
        {sessionCount > 0 && (
          <View className="flex-row flex-wrap gap-3 mb-5">
            <Card className="flex-1 min-w-[45%] items-center py-5">
              <Text className="text-text text-3xl font-bold">{sessionCount}</Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">{t('reports.sessions')}</Text>
            </Card>
            <Card className="flex-1 min-w-[45%] items-center py-5">
              <Text className="text-text text-3xl font-bold">
                {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
              </Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">{t('reports.volume')}</Text>
            </Card>
            <Card className="flex-1 min-w-[45%] items-center py-5">
              <Text className="text-text text-3xl font-bold">{avgSRPE || '-'}</Text>
              <Text className="text-subtext text-xs font-semibold mt-1 uppercase">{t('reports.avgSrpe')}</Text>
            </Card>
          </View>
        )}

        {/* Markdown Preview */}
        <Card className="mb-5">
          <Text className="text-text text-sm font-semibold mb-3">📄 {t('reports.summary')}</Text>
          <View className="bg-background rounded-xl p-3 border border-border">
            <Text className="text-text text-xs leading-5 font-mono select-text">
              {markdown}
            </Text>
          </View>
        </Card>

        {/* Copy Button */}
        <Button
          title={t('reports.copyNotion')}
          onPress={handleCopy}
          variant="primary"
          size="lg"
          fullWidth
        />
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
