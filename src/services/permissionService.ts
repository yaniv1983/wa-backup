import {Platform, PermissionsAndroid, NativeModules, Alert, AppState} from 'react-native';

const {StorageModule} = NativeModules;

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Platform.Version;

  if (apiLevel >= 30) {
    const isGranted = await StorageModule.isExternalStorageManager();
    if (isGranted) return true;

    return new Promise((resolve) => {
      Alert.alert(
        'Storage Permission Required',
        'This app needs "All Files Access" to read WhatsApp Business backup files.\n\nTap "Open Settings" and enable the toggle for WA Backup.',
        [
          {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await StorageModule.requestManageStoragePermission();
                // Wait for user to come back to the app
                const subscription = AppState.addEventListener('change', async (state) => {
                  if (state === 'active') {
                    subscription.remove();
                    const granted = await StorageModule.isExternalStorageManager();
                    resolve(granted);
                  }
                });
              } catch {
                resolve(false);
              }
            },
          },
        ],
      );
    });
  } else {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'WA Backup needs access to read WhatsApp Business backup files.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
}

export async function hasStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Platform.Version;

  if (apiLevel >= 30) {
    return await StorageModule.isExternalStorageManager();
  } else {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
  }
}

export async function hasRootAccess(): Promise<boolean> {
  try {
    return await StorageModule.hasRootAccess();
  } catch {
    return false;
  }
}
