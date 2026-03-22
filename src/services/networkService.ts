import NetInfo, {NetInfoState} from '@react-native-community/netinfo';

export async function isWifiConnected(): Promise<boolean> {
  const state: NetInfoState = await NetInfo.fetch();
  return state.isConnected === true && state.type === 'wifi';
}

export function onConnectivityChange(
  callback: (isWifi: boolean) => void,
): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    callback(state.isConnected === true && state.type === 'wifi');
  });
  return unsubscribe;
}
