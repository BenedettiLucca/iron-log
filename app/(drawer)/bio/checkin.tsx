import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { db } from '../../../src/db/client';
import { bodyMetrics } from '../../../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { BodyMetric } from '@/src/types';
import { MonthlyCheckinComparison } from '../../../components/MonthlyCheckinComparison';
import { CheckinGallery } from '../../../components/CheckinGallery';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState, ErrorState } from '../../../components/ScreenState';
import { logger } from '@/services/logger';
import { useI18n } from '../../../src/i18n/index';
import { resolveScreenState } from '../../../src/utils/screen-state';
import { processCheckinData } from '@/src/utils/checkin-screen';

export default function CheckinScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [monthlyMetrics, setMonthlyMetrics] = useState<BodyMetric[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setHasError(false);
      const data = await db.select().from(bodyMetrics)
        .where(eq(bodyMetrics.type, 'monthly'))
        .orderBy(desc(bodyMetrics.date));
      setMonthlyMetrics((data || []) as BodyMetric[]);
    } catch (e) {
      logger.error('Failed to load monthly metrics', e);
      setHasError(true);
      setErrorMessage(t('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const { status } = resolveScreenState({
    isLoading: loading,
    hasError,
    hasContent: monthlyMetrics.length > 0,
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return <ErrorState message={errorMessage} onRetry={loadMetrics} />;
  }

  const { current, previous, hasData } = processCheckinData(monthlyMetrics);

  if (!hasData || !current) {
    return (
      <View className="flex-1 bg-background px-4">
        <Stack.Screen options={{ title: t('bio.monthlyCheckin') }} />
        <View className="flex-1 justify-center">
          <EmptyState
            icon="📸"
            title={t('checkin.emptyTitle')}
            description={t('checkin.emptyDesc')}
          />
          <Button
            title={t('checkin.takePhotos')}
            onPress={() => router.push('/bio?checkin=open')}
            variant="primary"
            fullWidth
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('bio.monthlyCheckin') }} />

      {/* Header actions */}
      <View className="px-4 pt-4 pb-2 flex-row gap-3">
        <TouchableOpacity
          onPress={() => setShowGallery(s => !s)}
          className="flex-1 bg-card border border-border py-3 rounded-xl items-center"
        >
          <Text className="text-text font-bold text-sm">
            {showGallery ? t('checkin.hideGallery') : t('checkin.showGallery')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/bio?checkin=open')}
          className="flex-1 bg-primary py-3 rounded-xl items-center"
        >
          <Text className="text-white font-bold text-sm">{t('checkin.takePhotos')}</Text>
        </TouchableOpacity>
      </View>

      {showGallery && (
        <View className="px-4 pb-2">
          <CheckinGallery metrics={monthlyMetrics} onSelectMonth={() => {}} />
        </View>
      )}

      <MonthlyCheckinComparison current={current} previous={previous} />
    </View>
  );
}
