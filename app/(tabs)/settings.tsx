import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { DatabaseBackupService } from '../../services/DatabaseBackupService';
import { CsvExportService } from '../../services/CsvExportService';
import { AlexandriaExportService } from '../../services/AlexandriaExportService';
import { Toast } from '../../components/Toast';
import { Dialog } from '../../components/Dialog';
import { useNotifications } from '@/hooks/use-notifications';
import { useI18n } from '../../src/i18n/index';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useToast } from '../../hooks/use-toast';
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg';
import { SectionHeader } from '@/components/SectionHeader';

WebBrowser.maybeCompleteAuthSession();

const ChevronRight = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

const DownloadIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="7 10 12 15 17 10" />
    <Line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
);

const UploadIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="17 8 12 3 7 8" />
    <Line x1="12" y1="3" x2="12" y2="15" />
  </Svg>
);

const CloudIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </Svg>
);

const DriveIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2L2 18h20L12 2z" />
  </Svg>
);

const BellIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);

const InfoIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Line x1="12" y1="16" x2="12" y2="12" />
    <Line x1="12" y1="8" x2="12.01" y2="8" />
  </Svg>
);

const FileIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Polyline points="14 2 14 8 20 8" />
    <Line x1="16" y1="13" x2="8" y2="13" />
    <Line x1="16" y1="17" x2="8" y2="17" />
  </Svg>
);

const ExportIcon = ({ color }: { color: string }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <Polyline points="15 3 21 3 21 9" />
    <Line x1="10" y1="14" x2="21" y2="3" />
  </Svg>
);

const SuccessIcon = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

interface RowButtonProps {
  label: string;
  onPress: () => void;
  icon: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  noBorder?: boolean;
}

function RowButton({ label, onPress, icon, loading = false, disabled = false, noBorder = false }: RowButtonProps) {
  const theme = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      className={`flex-row items-center justify-between py-3.5 ${noBorder ? '' : 'border-b border-border/40'}`}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="text-text text-sm font-semibold">{label}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.primaryText} />
      ) : (
        <ChevronRight color={theme.subtext} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { t, setLanguage, language } = useI18n();
  const theme = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const { toast, setToast } = useToast();
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', type: 'default' as 'default' | 'destructive', onConfirm: () => {} });
  const { settings: notificationSettings, loading: notificationsLoading, toggleEnabled, sendTestNotification } = useNotifications();

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId || '', // Empty string prevents silent auth with dummy values
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      setAccessToken(response.authentication?.accessToken || null);
      // Google access tokens expire in ~1 hour; store the expiry time
      const expiresIn = response.authentication?.expiresIn;
      const issuedAt = response.authentication?.issuedAt ?? Date.now();
      setTokenExpiresAt(expiresIn ? issuedAt + expiresIn * 1000 : Date.now() + 3600 * 1000);
      setToast({ visible: true, message: t('settings.googleConnected'), type: 'success' });
    }
  }, [response, t, setToast]);

  const handleExport = async () => {
    setLoading(true);
    try {
      await DatabaseBackupService.exportDb();
      setToast({ visible: true, message: t('settings.localExportSuccess'), type: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast({ visible: true, message: (msg?.startsWith('services.') ? t(msg) : msg) || t('settings.exportError'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setDialog({
      visible: true,
      title: t('settings.importBackup'),
      message: t('settings.importBackupWarning'),
      type: 'destructive',
      onConfirm: async () => {
        setDialog(prev => ({ ...prev, visible: false }));
        setLoading(true);
        try {
          const success = await DatabaseBackupService.importDb();
          if (success) {
            setDialog({
              visible: true,
              title: t('common.success'),
              message: t('settings.backupImported'),
              type: 'default',
              onConfirm: () => Updates.reloadAsync()
            });
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setToast({ visible: true, message: (msg?.startsWith('services.') ? t(msg) : msg) || t('settings.importError'), type: 'error' });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCloudBackup = async () => {
    if (!accessToken) return;

    // Check if token is expired or about to expire (5 min buffer)
    if (tokenExpiresAt && Date.now() > tokenExpiresAt - 5 * 60 * 1000) {
      setAccessToken(null);
      setTokenExpiresAt(null);
      setDialog({
        visible: true,
        title: t('settings.tokenExpired'),
        message: t('settings.tokenExpiredDesc'),
        type: 'default',
        onConfirm: () => {
          setDialog(prev => ({ ...prev, visible: false }));
          initiateGoogleAuth();
        },
      });
      return;
    }

    setLoading(true);
    try {
      await DatabaseBackupService.uploadToDrive(accessToken);
      setToast({ visible: true, message: t('settings.cloudBackupSuccess'), type: 'success' });
    } catch {
      setToast({ visible: true, message: t('settings.cloudBackupError'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCsvExport = async () => {
    setLoading(true);
    try {
      await CsvExportService.exportAllAndShare();
      setToast({ visible: true, message: t('settings.csvExportSuccess'), type: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast({ visible: true, message: (msg?.startsWith('services.') ? t(msg) : msg) || t('settings.csvExportError'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAlexandriaExport = async () => {
    setLoading(true);
    try {
      await AlexandriaExportService.exportAndShare();
      setToast({ visible: true, message: t('settings.alexandriaExportSuccess'), type: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast({ visible: true, message: (msg?.startsWith('services.') ? t(msg) : msg) || t('settings.alexandriaExportError'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const initiateGoogleAuth = () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
      setDialog({
        visible: true,
        title: t('settings.configRequired'),
        message: t('dialog.googleConfigDesc'),
        type: 'default',
        onConfirm: () => setDialog(prev => ({ ...prev, visible: false }))
      });
      return;
    }
    promptAsync();
  };

  return (
    <ScrollView className="flex-1 bg-background p-4" contentContainerStyle={{ gap: 20, paddingBottom: 32 }}>
      {/* Reminders Section */}
      <View className="py-2">
        <SectionHeader label={t("settings.checkinReminders")} className="mb-1.5" />
        <Text className="text-subtext text-sm mb-3 leading-5">
          {t("settings.reminderDescription")}
        </Text>

        <View className={`flex-row items-center justify-between py-3.5 ${notificationSettings.enabled ? 'border-b border-border/40' : ''}`}>
          <View className="flex-1">
            <Text className="text-text font-semibold text-sm">{t("settings.enableReminders")}</Text>
            <Text className="text-subtext text-xs mt-0.5">
              {t('settings.dayAt', { day: notificationSettings.checkinDay, hour: notificationSettings.checkinHour })}
            </Text>
          </View>
          <Switch
            value={notificationSettings.enabled}
            onValueChange={toggleEnabled}
            disabled={notificationsLoading}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={theme.onPrimary}
          />
        </View>

        {notificationSettings.enabled && (
          <RowButton
            label={t("settings.testNotification")}
            onPress={sendTestNotification}
            icon={<BellIcon color={theme.primaryText} />}
            loading={loading}
            noBorder
          />
        )}
      </View>

      <View className="border-b border-border/40" />

      {/* Local Backup Section */}
      <View className="py-2">
        <SectionHeader label={t("settings.localBackup")} className="mb-1.5" />
        <Text className="text-subtext text-sm mb-3 leading-5">{t('settings.localBackupDesc')}</Text>

        <View>
          <RowButton
            label={t("settings.exportData")}
            onPress={handleExport}
            icon={<DownloadIcon color={theme.primaryText} />}
            loading={loading}
          />

          <RowButton
            label={t("settings.importData")}
            onPress={handleImport}
            icon={<UploadIcon color={theme.primaryText} />}
            loading={loading}
            noBorder
          />
        </View>
      </View>

      <View className="border-b border-border/40" />

      {/* Cloud Backup Section */}
      <View className="py-2">
        <SectionHeader label={t("settings.cloudBackup")} className="mb-1.5" />
        <Text className="text-subtext text-sm mb-3 leading-5">{t('settings.cloudBackupDesc')}</Text>

        {!accessToken ? (
          <RowButton
            label={t("settings.connectGoogle")}
            onPress={initiateGoogleAuth}
            icon={<DriveIcon color={theme.primaryText} />}
            disabled={!request}
            noBorder
          />
        ) : (
          <View>
            <View className="flex-row items-center gap-3 bg-successSurface p-3 rounded-lg border border-success/20 mb-3">
              <SuccessIcon color={theme.successText} />
              <Text className="text-successText text-sm font-semibold">{t("settings.connectedGoogle")}</Text>
            </View>
            <RowButton
              label={t("settings.backupNow")}
              onPress={handleCloudBackup}
              icon={<CloudIcon color={theme.primaryText} />}
              loading={loading}
              noBorder
            />
          </View>
        )}
      </View>

      <View className="border-b border-border/40" />

      {/* Data Export Section */}
      <View className="py-2">
        <SectionHeader label={t("settings.exportData")} className="mb-1.5" />
        <Text className="text-subtext text-sm mb-3 leading-5">
          {t("settings.csvDesc")}
        </Text>

        <View>
          <RowButton
            label={t("settings.exportCsvBtn")}
            onPress={handleCsvExport}
            icon={<FileIcon color={theme.primaryText} />}
            loading={loading}
          />
          <RowButton
            label={t("settings.exportAlexandriaJson")}
            onPress={handleAlexandriaExport}
            icon={<ExportIcon color={theme.primaryText} />}
            loading={loading}
            noBorder
          />
        </View>
      </View>

      <View className="border-b border-border/40" />

      {/* Language Selector Section */}
      <View className="py-2">
        <SectionHeader label={t('settings.language')} className="mb-1.5" />
        <Text className="text-subtext text-sm mb-3 leading-5">
          {t('settings.languageDesc')}
        </Text>
        <View className="flex-row gap-2 flex-wrap">
          {(['pt', 'en', 'es', 'zh'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              onPress={() => setLanguage(lang)}
              accessibilityRole="button"
              accessibilityLabel={t(`settings.${lang}`)}
              accessibilityState={{ selected: language === lang }}
              className={`min-h-[44px] min-w-[44px] items-center justify-center px-3 rounded-full border ${
                language === lang
                  ? 'bg-primary border-transparent'
                  : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-xs font-bold uppercase ${
                  language === lang ? 'text-onPrimary' : 'text-subtext'
                }`}
              >
                {t(`settings.${lang}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="border-b border-border/40" />

      {/* About Section */}
      <View className="py-2">
        <SectionHeader label={t("settings.about") !== "settings.about" ? t("settings.about") : t("drawer.about")} className="mb-1.5" />
        <Text className="text-subtext text-sm mb-3 leading-5">
          {t("about.philosophyText")}
        </Text>
        <RowButton
          label={t("common.view")}
          onPress={() => router.push('/about')}
          icon={<InfoIcon color={theme.primaryText} />}
          noBorder
        />
      </View>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <Dialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
        onCancel={() => setDialog(prev => ({ ...prev, visible: false }))}
      />
    </ScrollView>
  );
}
