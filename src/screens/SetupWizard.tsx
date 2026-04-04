import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  StatusBar,
  Linking,
  NativeModules,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {configureGoogleSignIn, signIn} from '../services/googleDriveService';
import {requestStoragePermission} from '../services/permissionService';
import {colors, spacing, borderRadius} from '../theme';

// Detect Xiaomi/MIUI devices that aggressively kill background processes
const {PlatformConstants} = NativeModules;
const brand = (PlatformConstants?.Brand || '').toLowerCase();
const isMIUI = brand === 'xiaomi' || brand === 'redmi' || brand === 'poco';

interface Props {
  onComplete: () => void;
}

type StepId = 'welcome' | 'google' | 'storage' | 'battery' | 'done';

const ALL_STEPS: {id: StepId; icon: string; iconColor: string}[] = [
  {id: 'welcome', icon: 'cloud-upload', iconColor: colors.primary},
  {id: 'google', icon: 'google-drive', iconColor: colors.google},
  {id: 'storage', icon: 'folder-lock', iconColor: colors.primaryDark},
  {id: 'battery', icon: 'battery-check', iconColor: '#FF9800'},
  {id: 'done', icon: 'check-circle', iconColor: colors.success},
];

const STEPS = isMIUI
  ? ALL_STEPS
  : ALL_STEPS.filter(s => s.id !== 'battery');

export default function SetupWizard({onComplete}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [googleDone, setGoogleDone] = useState(false);
  const [storageDone, setStorageDone] = useState(false);

  const currentStep = STEPS[stepIndex];
  const stepId = currentStep.id;

  const goTo = (id: StepId) => {
    const idx = STEPS.findIndex(s => s.id === id);
    if (idx >= 0) setStepIndex(idx);
  };

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  };

  const handleGoogleSignIn = async () => {
    try {
      configureGoogleSignIn();
      await signIn();
      setGoogleDone(true);
      goTo('storage');
    } catch (e: any) {
      if (e.message?.includes('cancelled')) return;
      Alert.alert('Sign In Failed', e.message || 'Please try again.');
    }
  };

  const handleStoragePermission = async () => {
    const granted = await requestStoragePermission();
    if (granted) {
      setStorageDone(true);
      goNext();
    } else {
      Alert.alert(
        'Permission Required',
        'Storage access is needed to find WhatsApp backup files. Please grant the permission to continue.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" />

      {/* Progress dots */}
      <View style={styles.dotsContainer}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === stepIndex && styles.dotActive, i < stepIndex && styles.dotCompleted]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.iconCircle, {backgroundColor: currentStep.iconColor + '15'}]}>
          <Icon name={currentStep.icon} size={64} color={currentStep.iconColor} />
        </View>

        {stepId === 'welcome' && (
          <>
            <Text style={styles.title}>Welcome to WA Backup</Text>
            <Text style={styles.subtitle}>
              Automatically back up your WhatsApp databases to Google Drive.{'\n\n'}
              Supports Business & Personal, scheduled backups, and backup retention management.
            </Text>
          </>
        )}

        {stepId === 'google' && (
          <>
            <Text style={styles.title}>Sign in to Google</Text>
            <Text style={styles.subtitle}>
              Connect your Google account to enable Drive backups. Your backup files will be stored in a dedicated folder.
            </Text>
          </>
        )}

        {stepId === 'storage' && (
          <>
            <Text style={styles.title}>Storage Access</Text>
            <Text style={styles.subtitle}>
              WA Backup needs storage access to find your WhatsApp backup files on this device.
            </Text>
          </>
        )}

        {stepId === 'battery' && (
          <>
            <Text style={styles.title}>Background Backup</Text>
            <Text style={styles.subtitle}>
              For scheduled backups to work reliably, your phone must allow WA Backup to run in the background.{'\n\n'}
              Open App Settings and:{'\n'}
              {'\u2022'} Set Battery to "No restrictions"{'\n'}
              {'\u2022'} Enable "Autostart" (Xiaomi/MIUI){'\n'}
              {'\u2022'} Disable any "Battery saver" for this app
            </Text>
          </>
        )}

        {stepId === 'done' && (
          <>
            <Text style={styles.title}>You're All Set!</Text>
            <Text style={styles.subtitle}>
              Everything is configured. You can now back up your WhatsApp databases to Google Drive.
            </Text>
            <View style={styles.summaryCard}>
              <SummaryRow icon="google-drive" label="Google Drive" done={googleDone} />
              <SummaryRow icon="folder-lock" label="Storage Access" done={storageDone} />
            </View>
          </>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {stepId === 'welcome' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => goTo('google')}>
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <Icon name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {stepId === 'google' && (
          <>
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn}>
              <Icon name="google" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Sign in with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={() => goTo('storage')}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}

        {stepId === 'storage' && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleStoragePermission}>
              <Icon name="folder-lock" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Grant Storage Access</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={goNext}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}

        {stepId === 'battery' && (
          <>
            <TouchableOpacity style={styles.batteryBtn} onPress={() => Linking.openSettings().catch(() => {})}>
              <Icon name="cog" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Open App Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => goTo('done')}>
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Icon name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {stepId === 'done' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={onComplete}>
            <Text style={styles.primaryBtnText}>Start Backing Up</Text>
            <Icon name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({icon, label, done}: {icon: string; label: string; done: boolean}) {
  return (
    <View style={styles.summaryRow}>
      <Icon name={icon} size={20} color={done ? colors.success : colors.textSecondary} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Icon
        name={done ? 'check-circle' : 'circle-outline'}
        size={20}
        color={done ? colors.success : colors.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 40,
    paddingBottom: 20,
  },
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd'},
  dotActive: {backgroundColor: colors.primary, width: 24},
  dotCompleted: {backgroundColor: colors.primary},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40},
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {fontSize: 26, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 16},
  subtitle: {fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22},
  summaryCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  summaryRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  summaryLabel: {flex: 1, fontSize: 15, color: colors.textPrimary},
  actions: {padding: 24, gap: 12},
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    elevation: 3,
  },
  googleBtn: {
    backgroundColor: colors.google,
    borderRadius: borderRadius.md,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    elevation: 3,
  },
  batteryBtn: {
    backgroundColor: '#FF9800',
    borderRadius: borderRadius.md,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    elevation: 3,
  },
  primaryBtnText: {color: '#fff', fontSize: 17, fontWeight: '700'},
  skipBtn: {alignItems: 'center', padding: 12},
  skipBtnText: {color: colors.textSecondary, fontSize: 14},
});
