import {NativeModules} from 'react-native';

const {AlarmScheduler} = NativeModules;

export async function scheduleBackup(hour: number, minute: number): Promise<void> {
  await AlarmScheduler.scheduleDaily(hour, minute);
}

export async function cancelScheduledBackup(): Promise<void> {
  await AlarmScheduler.cancel();
}

export async function getScheduledTime(): Promise<{hour: number; minute: number} | null> {
  return await AlarmScheduler.getScheduledTime();
}
