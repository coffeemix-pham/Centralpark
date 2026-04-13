export type ScheduleAlarmParams = {
  id: string;
  triggerAtMillis: number;
  childName: string;
  medicineType: string;
  dosage: string;
  medicationTime: string;
  specialNote: string;
};

export type MedicationSyncModuleEvents = {
  onMedicationDone: (params: { id: string }) => void;
  onSyncCompleted: (params: { total: number; kept: number; skipped: number }) => void;
};
