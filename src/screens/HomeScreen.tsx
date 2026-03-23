import React, {useState, useEffect, useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {BackupFile, BackupRecord, UploadProgress} from '../types';
import {findBackupFiles, formatFileSize} from '../services/fileService';
import {isSignedIn, signIn, signOut, configureGoogleSignIn} from '../services/googleDriveService';
import {performBackup, getBackupHistory, getSettings} from '../services/backupManager';
import {isWifiConnected} from '../services/networkService';
import {requestStoragePermission, hasStoragePermission} from '../services/permissionService';
import {colors, spacing, borderRadius} from '../theme';

export default function HomeScreen() {
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [wifiStatus, setWifiStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storageGranted, setStorageGranted] = useState(false);
  const [rootMode, setRootMode] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const settings = await getSettings();
      setRootMode(settings.useRoot);
      const [foundFiles, backupHistory, wifi, storage] = await Promise.all([
        findBackupFiles(settings.useRoot, settings.whatsappVariant),
        getBackupHistory(),
        isWifiConnected(),
        hasStoragePermission(),
      ]);
      setFiles(foundFiles);
      setHistory(backupHistory);
      setWifiStatus(wifi);
      setIsLoggedIn(isSignedIn());
      setStorageGranted(storage || settings.useRoot);
    } catch (_e) {}
  }, []);

  useEffect(() => {
    // Configure Google Sign-In with custom client ID if set
    getSettings().then(s => configureGoogleSignIn(s.customWebClientId));
    // Request notification permission (Android 13+)
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
      ).catch(() => {});
    }
    requestStoragePermission().then((granted) => {
      setStorageGranted(granted);
      loadData();
    });
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSignIn = async () => {
    try {
      await signIn();
      setIsLoggedIn(true);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsLoggedIn(false);
  };

  const handleBackup = async () => {
    if (!isLoggedIn) {
      Alert.alert('Not Signed In', 'Please sign in to Google Drive first.');
      return;
    }
    if (!wifiStatus) {
      const settings = await getSettings();
      if (settings.wifiOnly) {
        Alert.alert('No WiFi', 'Please connect to WiFi or disable WiFi-only mode.');
        return;
      }
    }

    setUploading(true);
    setProgress(null);
    try {
      await performBackup((p) => setProgress(p));
      Alert.alert('Success', 'Backup completed successfully!');
      await loadData();
    } catch (e: any) {
      Alert.alert('Backup Failed', e.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const latestFile = files[0];
  const lastBackup = history.find(r => r.status === 'completed');
  const lastBackupAgo = lastBackup
    ? getTimeAgo(lastBackup.timestamp)
    : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <StatusRow
          icon="wifi"
          label="WiFi"
          value={wifiStatus ? 'Connected' : 'Not Connected'}
          ok={wifiStatus}
        />
        <StatusRow
          icon="google-drive"
          label="Google Drive"
          value={isLoggedIn ? 'Connected' : 'Not Connected'}
          ok={isLoggedIn}
        />
        <StatusRow
          icon="folder-lock"
          label="Storage"
          value={rootMode ? 'Root Access' : storageGranted ? 'Granted' : 'Not Granted'}
          ok={storageGranted || rootMode}
          action={
            !storageGranted && !rootMode
              ? async () => {
                  const granted = await requestStoragePermission();
                  setStorageGranted(granted);
                  if (granted) loadData();
                }
              : undefined
          }
        />
      </View>

      {/* Last Backup Info */}
      {lastBackupAgo && (
        <View style={styles.lastBackupCard}>
          <Icon name="check-circle" size={20} color={colors.success} />
          <Text style={styles.lastBackupText}>Last backup: {lastBackupAgo}</Text>
        </View>
      )}

      {/* Google Sign In */}
      {!isLoggedIn ? (
        <TouchableOpacity style={styles.googleBtn} onPress={handleSignIn}>
          <Icon name="google" size={20} color="#fff" />
          <Text style={styles.googleBtnText}>Sign in with Google</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      )}

      {/* Latest Backup File */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest Backup File</Text>
        {latestFile ? (
          <View style={styles.fileCard}>
            <Icon name="file-lock" size={24} color={colors.primaryDark} />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>{latestFile.name}</Text>
              <Text style={styles.fileMeta}>
                {formatFileSize(latestFile.size)} | {new Date(latestFile.lastModified).toLocaleDateString('he-IL')}
                {latestFile.source === 'personal' ? ' | Personal' : ''}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No WhatsApp backup files found</Text>
        )}
      </View>

      {/* Backup Button */}
      <TouchableOpacity
        style={[styles.backupBtn, uploading && styles.backupBtnDisabled]}
        onPress={handleBackup}
        disabled={uploading}>
        <Icon name={uploading ? 'cloud-sync' : 'cloud-upload'} size={24} color="#fff" />
        <Text style={styles.backupBtnText}>
          {uploading ? 'Uploading...' : 'Backup Now'}
        </Text>
      </TouchableOpacity>

      {/* Progress Bar */}
      {progress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {width: `${progress.percentage}%`}]} />
          </View>
          <Text style={styles.progressText}>
            {progress.percentage}% ({formatFileSize(progress.bytesUploaded)} / {formatFileSize(progress.totalBytes)})
          </Text>
        </View>
      )}

      {/* Recent History */}
      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Backups</Text>
          {history.slice(0, 3).map((record) => (
            <View key={record.id} style={styles.historyItem}>
              <Icon
                name={record.status === 'completed' ? 'check-circle' : record.status === 'failed' ? 'alert-circle' : 'progress-clock'}
                size={18}
                color={record.status === 'completed' ? colors.success : record.status === 'failed' ? colors.error : colors.warning}
              />
              <View style={styles.historyInfo}>
                <Text style={styles.historyFile}>{record.fileName}</Text>
                <Text style={styles.historyDate}>{new Date(record.timestamp).toLocaleString('he-IL')}</Text>
              </View>
              <Text style={[styles.historyStatus, {color: record.status === 'completed' ? colors.success : record.status === 'failed' ? colors.error : colors.warning}]}>
                {record.status === 'completed' ? 'Done' : record.status === 'failed' ? 'Failed' : 'Running'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{height: spacing.xl}} />
    </ScrollView>
  );
}

function StatusRow({icon, label, value, ok, action}: {
  icon: string; label: string; value: string; ok: boolean; action?: () => void;
}) {
  return (
    <View style={styles.statusRow}>
      <Icon name={icon} size={18} color={ok ? colors.success : colors.error} />
      <Text style={styles.statusLabel}>{label}:</Text>
      <Text style={[styles.statusValue, {color: ok ? colors.success : colors.error}]}>{value}</Text>
      {action && (
        <TouchableOpacity onPress={action} style={styles.grantBtn}>
          <Text style={styles.grantBtnText}>Grant</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.md},
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  statusLabel: {fontSize: 14, color: colors.textSecondary, width: 80},
  statusValue: {fontSize: 14, fontWeight: '500', flex: 1},
  lastBackupCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lastBackupText: {fontSize: 14, color: colors.primaryDark, fontWeight: '500'},
  googleBtn: {
    backgroundColor: colors.google,
    borderRadius: borderRadius.sm,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  googleBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  signOutBtn: {
    backgroundColor: '#eee',
    borderRadius: borderRadius.sm,
    padding: 14,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  signOutBtnText: {color: colors.textSecondary, fontSize: 14},
  section: {marginBottom: spacing.md},
  sectionTitle: {fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm},
  fileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fileInfo: {flex: 1},
  fileName: {fontSize: 13, fontWeight: '600', color: colors.textPrimary},
  fileMeta: {fontSize: 12, color: colors.textSecondary, marginTop: 2},
  emptyText: {fontSize: 14, color: colors.textSecondary, textAlign: 'center', padding: 20},
  backupBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    elevation: 3,
    gap: spacing.sm,
  },
  backupBtnDisabled: {backgroundColor: '#a5d6a7'},
  backupBtnText: {color: '#fff', fontSize: 18, fontWeight: '700'},
  progressContainer: {marginBottom: spacing.md},
  progressBar: {height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden'},
  progressFill: {height: '100%', backgroundColor: colors.primary, borderRadius: 4},
  progressText: {fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 4},
  historyItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: 14,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    gap: spacing.sm,
  },
  historyInfo: {flex: 1},
  historyFile: {fontSize: 13, fontWeight: '500', color: colors.textPrimary},
  historyDate: {fontSize: 11, color: colors.textSecondary, marginTop: 2},
  historyStatus: {fontSize: 12, fontWeight: '600'},
  grantBtn: {
    backgroundColor: colors.google,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  grantBtnText: {color: '#fff', fontSize: 12, fontWeight: '600'},
});
