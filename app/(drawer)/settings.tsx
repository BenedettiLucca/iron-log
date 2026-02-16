import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { DatabaseBackupService } from '../../services/DatabaseBackupService';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Toast } from '../../components/Toast';
import { Dialog } from '../../components/Dialog';
import { useNotifications } from '@/hooks/use-notifications';

WebBrowser.maybeCompleteAuthSession();

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '', type: 'default' as 'default' | 'destructive', onConfirm: () => {} });
  const { settings: notificationSettings, loading: notificationsLoading, toggleEnabled, sendTestNotification } = useNotifications();

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
    } catch (e: any) {
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
        } catch (e: any) {
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
    <ScrollView className="flex-1 bg-background p-4" contentContainerStyle={{ gap: 16 }}>
      <Stack.Screen options={{ title: 'Configurações' }} />

      <Card>
        <Text className="text-text font-bold text-lg mb-2">Lembretes de Check-in</Text>
        <Text className="text-subtext text-sm mb-6 leading-5">
          Receba lembretes mensais para registrar suas métricas corporais e acompanhar seu progresso.
        </Text>

        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <Text className="text-text font-semibold">Ativar Lembretes</Text>
            <Text className="text-subtext text-xs mt-1">
              Dia {notificationSettings.checkinDay} às {notificationSettings.checkinHour}:00
            </Text>
          </View>
          <Switch
            value={notificationSettings.enabled}
            onValueChange={toggleEnabled}
            disabled={notificationsLoading}
            trackColor={{ false: '#3e3e3e', true: '#E07A5F' }}
            thumbColor="#fff"
          />
        </View>

        {notificationSettings.enabled && (
          <Button
            title="TESTAR NOTIFICAÇÃO"
            onPress={sendTestNotification}
            variant="ghost"
            loading={loading}
            fullWidth
          />
        )}
      </Card>

      <Card>
        <Text className="text-text font-bold text-lg mb-2">Backup Local</Text>
        <Text className="text-subtext text-sm mb-6 leading-5">
          Exporte seus dados para um arquivo seguro ou restaure um backup anterior.
          Ideal para trocar de aparelho ou manter uma cópia offline.
        </Text>

        <View className="gap-3">
          <Button
            title="EXPORTAR DADOS"
            onPress={handleExport}
            variant="secondary"
            loading={loading}
            fullWidth
          />
          
          <Button
            title="IMPORTAR DADOS"
            onPress={handleImport}
            variant="danger"
            loading={loading}
            fullWidth
          />
        </View>
      </Card>

      <Card>
        <Text className="text-text font-bold text-lg mb-2">Backup em Nuvem (Google Drive)</Text>
        <Text className="text-subtext text-sm mb-6 leading-5">
          Sincronize seus dados com sua conta Google para nunca perder seu progresso.
        </Text>

        {!accessToken ? (
          <Button
            title="CONECTAR GOOGLE DRIVE"
            onPress={initiateGoogleAuth}
            variant="primary"
            fullWidth
            disabled={!request}
          />
        ) : (
          <View className="gap-3">
            <View className="bg-success/10 p-3 rounded-xl border border-success/20 mb-2">
              <Text className="text-success text-center font-bold">✓ Conectado ao Google Drive</Text>
            </View>
            <Button
              title="FAZER BACKUP AGORA"
              onPress={handleCloudBackup}
              variant="success"
              loading={loading}
              fullWidth
            />
          </View>
        )}
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
