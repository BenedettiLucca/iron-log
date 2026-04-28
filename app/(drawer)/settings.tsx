import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { DatabaseBackupService } from '../../services/DatabaseBackupService';
import { CsvExportService } from '../../services/CsvExportService';
import { AlexandriaExportService } from '../../services/AlexandriaExportService';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Toast } from '../../components/Toast';
import { Dialog } from '../../components/Dialog';
import { useNotifications } from '@/hooks/use-notifications';
import { useI18n } from '../../src/i18n/index';
import { Colors } from '@/constants/colors';

WebBrowser.maybeCompleteAuthSession();

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', type: 'default' as 'default' | 'destructive', onConfirm: () => {} });
  const { settings: notificationSettings, loading: notificationsLoading, toggleEnabled, sendTestNotification } = useNotifications();
  const { language, setLanguage, t } = useI18n();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'DUMMY_ID_FOR_DEV', // Fallback to avoid crash
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      setAccessToken(response.authentication?.accessToken || null);
      setToast({ visible: true, message: 'Conectado ao Google Drive!', type: 'success' });
    }
  }, [response]);

  const handleExport = async () => {
    setLoading(true);
    try {
      await DatabaseBackupService.exportDb();
      setToast({ visible: true, message: 'Backup exportado com sucesso!', type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e.message || 'Falha ao exportar.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setDialog({
      visible: true,
      title: 'Importar Backup',
      message: 'Isso substituirá TODOS os dados atuais pelos do backup. Essa ação é irreversível. Deseja continuar?',
      type: 'destructive',
      onConfirm: async () => {
        setDialog(prev => ({ ...prev, visible: false }));
        setLoading(true);
        try {
          const success = await DatabaseBackupService.importDb();
          if (success) {
            setDialog({
              visible: true,
              title: 'Sucesso!',
              message: 'Backup importado. O app será reiniciado para aplicar as alterações.',
              type: 'default',
              onConfirm: () => Updates.reloadAsync()
            });
          }
        } catch (e) {
          setToast({ visible: true, message: e.message || 'Falha ao importar.', type: 'error' });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCloudBackup = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await DatabaseBackupService.uploadToDrive(accessToken);
      setToast({ visible: true, message: 'Backup salvo no Google Drive!', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Falha no backup em nuvem.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCsvExport = async () => {
    setLoading(true);
    try {
      await CsvExportService.exportAllAndShare();
      setToast({ visible: true, message: 'Dados exportados em CSV!', type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e.message || 'Falha ao exportar CSV.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAlexandriaExport = async () => {
    setLoading(true);
    try {
      await AlexandriaExportService.exportAndShare();
      setToast({ visible: true, message: 'Dados exportados para Alexandria!', type: 'success' });
    } catch (e) {
      setToast({ visible: true, message: e.message || 'Falha ao exportar para Alexandria.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const initiateGoogleAuth = () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
      setDialog({
        visible: true,
        title: 'Configuração Necessária',
        message: 'Adicione EXPO_PUBLIC_GOOGLE_CLIENT_ID ao seu arquivo .env para usar o Google Drive.',
        type: 'default',
        onConfirm: () => setDialog(prev => ({ ...prev, visible: false }))
      });
      return;
    }
    promptAsync();
  };

  return (
    <ScrollView className="flex-1 bg-background p-4" contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: t('settings.title') }} />

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">Lembretes de Check-in</Text>
          <Text className="text-subtext text-sm mb-4 leading-5">
            Receba lembretes mensais para registrar suas métricas corporais e acompanhar seu progresso.
          </Text>

          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <Text className="text-text font-semibold text-sm">Ativar Lembretes</Text>
              <Text className="text-subtext text-xs mt-0.5">
                Dia {notificationSettings.checkinDay} às {notificationSettings.checkinHour}:00
              </Text>
            </View>
            <Switch
              value={notificationSettings.enabled}
              onValueChange={toggleEnabled}
              disabled={notificationsLoading}
              trackColor={{ false: Colors.darkButton, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {notificationSettings.enabled && (
            <Button
              title="TESTAR NOTIFICAÇÃO"
              onPress={sendTestNotification}
              variant="ghost"
              size="sm"
              loading={loading}
              fullWidth
            />
          )}
        </View>
      </Card>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">Backup Local</Text>
          <Text className="text-subtext text-sm mb-4 leading-5">
            Exporte seus dados para um arquivo seguro ou restaure um backup anterior.
            Ideal para trocar de aparelho ou manter uma cópia offline.
          </Text>

          <View className="gap-2">
            <Button
              title="EXPORTAR DADOS"
              onPress={handleExport}
              variant="secondary"
              size="sm"
              loading={loading}
              fullWidth
            />
            
            <Button
              title="IMPORTAR DADOS"
              onPress={handleImport}
              variant="danger"
              size="sm"
              loading={loading}
              fullWidth
            />
          </View>
        </View>
      </Card>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">Backup em Nuvem (Google Drive)</Text>
          <Text className="text-subtext text-sm mb-4 leading-5">
            Sincronize seus dados com sua conta Google para nunca perder seu progresso.
          </Text>

          {!accessToken ? (
            <Button
              title="CONECTAR GOOGLE DRIVE"
              onPress={initiateGoogleAuth}
              variant="primary"
              size="sm"
              fullWidth
              disabled={!request}
            />
          ) : (
            <View className="gap-2">
              <View className="bg-success/10 p-2.5 rounded-xl border border-success/20">
                <Text className="text-success text-center font-bold text-sm">✓ Conectado ao Google Drive</Text>
              </View>
              <Button
                title="FAZER BACKUP AGORA"
                onPress={handleCloudBackup}
                variant="success"
                size="sm"
                loading={loading}
                fullWidth
              />
            </View>
          )}
        </View>
      </Card>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">Exportar para Alexandria</Text>
          <Text className="text-subtext text-sm mb-4 leading-5">
            Exporte seus dados em JSON estruturado para o servidor de contexto pessoal Alexandria.
            Inclui treinos, métricas corporais, recordes pessoais e metas.
          </Text>
          <Button
            title="EXPORTAR ALEXANDRIA JSON"
            onPress={handleAlexandriaExport}
            variant="primary"
            size="sm"
            loading={loading}
            fullWidth
          />
        </View>
      </Card>

      {/* Language Selector */}
      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">{t('settings.language')}</Text>
          <Text className="text-subtext text-sm mb-3 leading-5">
            {t('settings.languageDesc')}
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            {(['pt', 'en', 'es', 'zh'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                onPress={() => setLanguage(lang)}
                className={`px-3 py-2 rounded-lg border ${
                  language === lang
                    ? 'bg-primary border-primary'
                    : 'bg-background border-border'
                }`}
              >
                <Text
                  className={`text-xs font-bold uppercase ${
                    language === lang ? 'text-white' : 'text-subtext'
                  }`}
                >
                  {t(`settings.${lang}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Card>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">Exportar como CSV</Text>
          <Text className="text-subtext text-sm mb-4 leading-5">
            Exporte seus dados em formato CSV para análise em planilhas (Excel, Google Sheets).
            Inclui histórico completo de treinos e métricas corporais.
          </Text>
          <Button
            title="EXPORTAR CSV"
            onPress={handleCsvExport}
            variant="secondary"
            size="sm"
            loading={loading}
            fullWidth
          />
        </View>
      </Card>

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
