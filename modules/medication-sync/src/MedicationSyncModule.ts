import { NativeModule, requireNativeModule } from 'expo';
import { MedicationSyncModuleEvents, ScheduleAlarmParams } from './MedicationSync.types';

declare class MedicationSyncModule extends NativeModule<MedicationSyncModuleEvents> {
  setCredentials(username: string, password: string, classId: string, className: string): Promise<void>;
  clearCredentials(): Promise<void>;
  scheduleBackgroundSync(): Promise<void>;
  cancelBackgroundSync(): Promise<void>;
  runSyncNow(): Promise<void>;
  scheduleAlarm(params: ScheduleAlarmParams): Promise<void>;
  cancelAlarm(id: string): Promise<void>;
  updateParsedTime(id: string, newHhmm: string): Promise<void>;
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
}

export default requireNativeModule<MedicationSyncModule>('MedicationSync');
