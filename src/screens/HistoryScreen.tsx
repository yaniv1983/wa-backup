import React, {useState, useCallback} from 'react';
import {View, Text, StyleSheet, FlatList, RefreshControl} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {BackupRecord} from '../types';
import {getBackupHistory} from '../services/backupManager';
import {formatFileSize} from '../services/fileService';
import {colors, spacing, borderRadius} from '../theme';

export default function HistoryScreen() {
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistory(await getBackupHistory());
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const renderItem = ({item}: {item: BackupRecord}) => {
    const icon = item.status === 'completed' ? 'check-circle' : item.status === 'failed' ? 'alert-circle' : 'progress-clock';
    const iconColor = item.status === 'completed' ? colors.success : item.status === 'failed' ? colors.error : colors.warning;
    return (
      <View style={styles.item}>
        <Icon name={icon} size={24} color={iconColor} />
        <View style={styles.info}>
          <Text style={styles.fileName}>{item.fileName}</Text>
          <Text style={styles.meta}>{formatFileSize(item.fileSize)} | {new Date(item.timestamp).toLocaleString('he-IL')}</Text>
          {item.error && <Text style={styles.error}>{item.error}</Text>}
        </View>
        <View style={[styles.badge, {backgroundColor: item.status === 'completed' ? '#E8F5E9' : item.status === 'failed' ? '#FFEBEE' : '#FFF3E0'}]}>
          <Text style={[styles.badgeText, {color: iconColor}]}>
            {item.status === 'completed' ? 'Done' : item.status === 'failed' ? 'Failed' : 'Running'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container} contentContainerStyle={styles.content}
      data={history} keyExtractor={item => item.id} renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Icon name="cloud-off-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No backup history yet</Text>
          <Text style={styles.emptySubtext}>Your backups will appear here</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.md, flexGrow: 1},
  item: {backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', elevation: 1, gap: spacing.md},
  info: {flex: 1},
  fileName: {fontSize: 13, fontWeight: '600', color: colors.textPrimary},
  meta: {fontSize: 11, color: colors.textSecondary, marginTop: 2},
  error: {fontSize: 11, color: colors.error, marginTop: 4},
  badge: {borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4},
  badgeText: {fontSize: 11, fontWeight: '600'},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100},
  emptyText: {fontSize: 16, color: colors.textSecondary, marginTop: spacing.md},
  emptySubtext: {fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs},
});
