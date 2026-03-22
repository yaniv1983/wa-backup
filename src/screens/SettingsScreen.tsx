import React, {useState, useEffect} from 'react';
import {
  View, Text, Switch, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {BackupSettings, DEFAULT_SETTINGS} from '../types';
import {getSettings, saveSettings} from '../services/backupManager';
import {startBackgroundBackup, stopBackgroundBackup} from '../services/backgroundService';
import {listDriveFolders, createDriveFolder, isSignedIn} from '../services/googleDriveService';
import {hasRootAccess} from '../services/permissionService';
import {colors, spacing, borderRadius} from '../theme';
import {DriveFolder} from '../types';
import {Modal, FlatList, TextInput, ActivityIndicator} from 'react-native';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<BackupSettings>(DEFAULT_SETTINGS);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const updateSetting = async <K extends keyof BackupSettings>(key: K, value: BackupSettings[K]) => {
    const newSettings = {...settings, [key]: value};
    setSettings(newSettings);
    await saveSettings(newSettings);

    if (key === 'autoBackupEnabled') {
      if (value) {
        await startBackgroundBackup();
        Alert.alert('Auto Backup', 'Automatic backup has been enabled.');
      } else {
        await stopBackgroundBackup();
        Alert.alert('Auto Backup', 'Automatic backup has been disabled.');
      }
    }
    if (key === 'autoBackupTime' && settings.autoBackupEnabled) {
      await startBackgroundBackup();
    }
  };

  const handleRootToggle = async (value: boolean) => {
    if (value) {
      const hasRoot = await hasRootAccess();
      if (!hasRoot) {
        Alert.alert('Root Not Available', 'Could not get root access. Make sure Magisk is installed and grant root permission when prompted.');
        return;
      }
    }
    updateSetting('useRoot', value);
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const h = selectedDate.getHours().toString().padStart(2, '0');
      const m = selectedDate.getMinutes().toString().padStart(2, '0');
      updateSetting('autoBackupTime', `${h}:${m}`);
    }
  };

  const timeDate = (() => {
    const [h, m] = settings.autoBackupTime.split(':');
    const d = new Date();
    d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    return d;
  })();

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  const openFolderPicker = async () => {
    if (!isSignedIn()) {
      Alert.alert('Not Signed In', 'Please sign in to Google Drive first from the Home screen.');
      return;
    }
    setFolderModalVisible(true);
    setLoadingFolders(true);
    try {
      setFolders(await listDriveFolders());
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load folders: ' + e.message);
    } finally {
      setLoadingFolders(false);
    }
  };

  const selectFolder = async (folder: DriveFolder) => {
    const newSettings = {...settings, driveFolderId: folder.id, driveFolderName: folder.name};
    setSettings(newSettings);
    await saveSettings(newSettings);
    setFolderModalVisible(false);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      const folder = await createDriveFolder(name);
      setFolders(prev => [folder, ...prev]);
      setNewFolderName('');
      await selectFolder(folder);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to create folder: ' + e.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Schedule Section */}
      <Text style={styles.sectionHeader}>Schedule</Text>

      <SettingRow
        icon="wifi" title="WiFi Only"
        desc="Only backup when connected to WiFi"
        right={<Switch value={settings.wifiOnly} onValueChange={v => updateSetting('wifiOnly', v)}
          trackColor={{false: '#ddd', true: '#81C784'}} thumbColor={settings.wifiOnly ? colors.primary : '#f4f3f4'} />}
      />

      <SettingRow
        icon="clock-outline" title="Automatic Backup"
        desc="Automatically backup on schedule"
        right={<Switch value={settings.autoBackupEnabled} onValueChange={v => updateSetting('autoBackupEnabled', v)}
          trackColor={{false: '#ddd', true: '#81C784'}} thumbColor={settings.autoBackupEnabled ? colors.primary : '#f4f3f4'} />}
      />

      {settings.autoBackupEnabled && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Backup Frequency</Text>
            <View style={styles.intervalButtons}>
              {(['daily', 'weekly'] as const).map(interval => (
                <TouchableOpacity
                  key={interval}
                  style={[styles.intervalBtn, settings.autoBackupInterval === interval && styles.intervalBtnActive]}
                  onPress={() => updateSetting('autoBackupInterval', interval)}>
                  <Text style={[styles.intervalBtnText, settings.autoBackupInterval === interval && styles.intervalBtnTextActive]}>
                    {interval.charAt(0).toUpperCase() + interval.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.card} onPress={() => setShowTimePicker(true)}>
            <View style={styles.cardRow}>
              <Icon name="clock-time-three" size={20} color={colors.primaryDark} />
              <View style={{flex: 1, marginLeft: spacing.sm}}>
                <Text style={styles.cardTitle}>Backup Time</Text>
                <Text style={styles.cardSubtitle}>Daily backup at {formatTime(settings.autoBackupTime)}</Text>
              </View>
              <Text style={styles.timeValue}>{formatTime(settings.autoBackupTime)}</Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {showTimePicker && (
        <DateTimePicker
          value={timeDate}
          mode="time"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      )}

      {/* Storage Section */}
      <Text style={styles.sectionHeader}>Storage</Text>

      <SettingRow
        icon="shield-key" title="Root Mode"
        desc="Use root access for direct file access (Magisk)"
        right={<Switch value={settings.useRoot} onValueChange={handleRootToggle}
          trackColor={{false: '#ddd', true: '#FF8A65'}} thumbColor={settings.useRoot ? colors.root : '#f4f3f4'} />}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>WhatsApp Version</Text>
        <View style={styles.intervalButtons}>
          {(['business', 'personal', 'both'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.intervalBtn, settings.whatsappVariant === v && styles.intervalBtnActive]}
              onPress={() => updateSetting('whatsappVariant', v)}>
              <Text style={[styles.intervalBtnText, settings.whatsappVariant === v && styles.intervalBtnTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Google Drive Section */}
      <Text style={styles.sectionHeader}>Google Drive</Text>

      <TouchableOpacity style={styles.card} onPress={openFolderPicker}>
        <View style={styles.cardRow}>
          <Icon name="folder-google-drive" size={20} color={colors.google} />
          <View style={{flex: 1, marginLeft: spacing.sm}}>
            <Text style={styles.cardTitle}>Destination Folder</Text>
            <Text style={styles.cardSubtitle}>{settings.driveFolderName || 'WA Business Backup'}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Icon name="delete-sweep" size={20} color={colors.primaryDark} />
          <View style={{flex: 1, marginLeft: spacing.sm}}>
            <Text style={styles.cardTitle}>Keep Last Backups</Text>
            <Text style={styles.cardSubtitle}>Older backups will be deleted from Drive</Text>
          </View>
        </View>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => settings.backupRetentionCount > 1 && updateSetting('backupRetentionCount', settings.backupRetentionCount - 1)}>
            <Icon name="minus" size={20} color={settings.backupRetentionCount > 1 ? colors.textPrimary : '#ccc'} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{settings.backupRetentionCount}</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => updateSetting('backupRetentionCount', settings.backupRetentionCount + 1)}>
            <Icon name="plus" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* About Section */}
      <Text style={styles.sectionHeader}>About</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>WA Backup</Text>
        <Text style={styles.cardSubtitle}>Version 1.1.0</Text>
        <Text style={[styles.cardSubtitle, {marginTop: spacing.xs}]}>
          Backup WhatsApp databases to Google Drive
        </Text>
      </View>

      {/* Folder Picker Modal */}
      <Modal visible={folderModalVisible} animationType="slide" transparent onRequestClose={() => setFolderModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Drive Folder</Text>
            <View style={styles.newFolderRow}>
              <TextInput style={styles.newFolderInput} placeholder="New folder name..." value={newFolderName} onChangeText={setNewFolderName} />
              <TouchableOpacity style={styles.newFolderBtn} onPress={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.newFolderBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
            {loadingFolders ? (
              <ActivityIndicator size="large" color={colors.google} style={{marginTop: 30}} />
            ) : (
              <FlatList
                data={folders} keyExtractor={item => item.id} style={{maxHeight: 300}}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[styles.folderItem, item.id === settings.driveFolderId && {backgroundColor: '#E3F2FD'}]}
                    onPress={() => selectFolder(item)}>
                    <Icon name="folder" size={20} color={colors.google} />
                    <Text style={styles.folderItemText}>{item.name}</Text>
                    {item.id === settings.driveFolderId && <Icon name="check" size={18} color={colors.google} />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{textAlign: 'center', color: colors.textSecondary, padding: 20}}>No folders found</Text>}
              />
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setFolderModalVisible(false)}>
              <Text style={{color: colors.textSecondary, fontSize: 15, fontWeight: '500'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{height: spacing.xl}} />
    </ScrollView>
  );
}

function SettingRow({icon, title, desc, right}: {icon: string; title: string; desc: string; right: React.ReactNode}) {
  return (
    <View style={styles.settingRow}>
      <Icon name={icon} size={20} color={colors.primaryDark} style={{marginRight: spacing.md}} />
      <View style={{flex: 1}}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDesc}>{desc}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: spacing.md},
  sectionHeader: {fontSize: 13, fontWeight: '700', color: colors.primaryDark, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm, marginLeft: spacing.xs},
  settingRow: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center', elevation: 1,
  },
  settingTitle: {fontSize: 15, fontWeight: '600', color: colors.textPrimary},
  settingDesc: {fontSize: 12, color: colors.textSecondary, marginTop: 2},
  card: {backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, elevation: 1},
  cardRow: {flexDirection: 'row', alignItems: 'center'},
  cardTitle: {fontSize: 15, fontWeight: '600', color: colors.textPrimary},
  cardSubtitle: {fontSize: 12, color: colors.textSecondary, marginTop: 2},
  timeValue: {fontSize: 16, fontWeight: '700', color: colors.primary},
  intervalButtons: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm},
  intervalBtn: {flex: 1, padding: 10, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: '#ddd', alignItems: 'center'},
  intervalBtnActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  intervalBtnText: {color: colors.textSecondary, fontWeight: '500', fontSize: 13},
  intervalBtnTextActive: {color: '#fff'},
  stepperRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, gap: spacing.lg},
  stepperBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center'},
  stepperValue: {fontSize: 24, fontWeight: '700', color: colors.textPrimary, minWidth: 40, textAlign: 'center'},
  // Modal
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20},
  modalContent: {backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 20, maxHeight: '80%'},
  modalTitle: {fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md},
  newFolderRow: {flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm},
  newFolderInput: {flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: borderRadius.sm, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14},
  newFolderBtn: {backgroundColor: colors.google, borderRadius: borderRadius.sm, paddingHorizontal: 16, justifyContent: 'center'},
  newFolderBtnText: {color: '#fff', fontWeight: '600'},
  folderItem: {flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: spacing.sm},
  folderItemText: {fontSize: 15, color: colors.textPrimary, flex: 1},
  modalCloseBtn: {marginTop: spacing.md, padding: 14, borderRadius: borderRadius.sm, backgroundColor: '#f5f5f5', alignItems: 'center'},
});
