import MedicationSync from '../../modules/medication-sync';
import { fetchMedicationsFromGAS } from '../api/gasApi';
import { loadKidsnoteCredentials } from '../store/credentialsStore';
import { loadTeacherProfile } from '../store/teacherStore';
import { dbOperations, upsertMedications, initDatabase } from '../db/database';
import { ensureDefaults, getKeywordRules, matchKeyword } from './keywordRuleStore';

function hhmmToEpoch(dateYmd: string, hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const [y, mo, d] = dateYmd.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
}

let isSyncRunning = false;

export async function initializeMedicationSync() {
  await initDatabase(); // 👈 최신 안전 장치 적용
  await ensureDefaults();
  const creds = await loadKidsnoteCredentials();
  if (!creds) return;
  const profile = await loadTeacherProfile();
  const classId = profile.classId;
  const className = profile.className;
  await MedicationSync.setCredentials(creds.username, creds.password, classId ?? '', className ?? '');
  await MedicationSync.scheduleBackgroundSync();
  // 오늘의 pending 알람 재예약
  const rows = await dbOperations.getTodaysPending();
  for (const r of rows) {
    if (!r.parsed_time) continue;
    const ts = hhmmToEpoch(r.date_medicated, r.parsed_time);
    if (ts && ts > Date.now()) {
      await MedicationSync.scheduleAlarm({
        id: r.id, triggerAtMillis: ts,
        childName: r.child_name, medicineType: r.medicine_type,
        dosage: r.dosage, medicationTime: r.original_time,
        specialNote: r.special_note ?? '',
      });
    }
  }
}

/** 선생님이 담당 반을 변경했을 때 호출 */
export async function onTeacherClassChanged(classId: string, className: string) {
  const creds = await loadKidsnoteCredentials();
  if (!creds) return;
  // 설정 정보 네이티브에 즉시 동기화
  await MedicationSync.setCredentials(creds.username, creds.password, classId, className);
  // 백그라운드 예약 대신 즉시 UI와 함께 포그라운드 동기화 실행 (로딩 바 표시용)
  await runForegroundSyncOnce();
}

/** pull-to-refresh */
export async function runForegroundSyncOnce() {
  if (isSyncRunning) {
    console.log("⏳ [SYNC] 동기화가 이미 진행 중입니다. 요청을 무시합니다.");
    return;
  }

  isSyncRunning = true;
  try {
    console.log("🔄 [SYNC] 포그라운드 동기화 시작...");
    await initDatabase(); // 👈 무조건 대기표 확인
    
    const creds = await loadKidsnoteCredentials();
    if (!creds) throw new Error('자격증명 미설정');
    
    const profile = await loadTeacherProfile();
    const classId = profile.classId;
    const className = profile.className;
    const rules = await getKeywordRules();
    
    const list = await fetchMedicationsFromGAS(creds.username, creds.password);
    await upsertMedications(list, { classId, className }, rules, matchKeyword);
    
    // 다시 알람 스케줄링 업데이트
    await initializeMedicationSync();
    console.log("✅ [SYNC] 동기화 성공");
  } catch (error) {
    console.error("❌ [SYNC] 동기화 실패:", error);
    throw error;
  } finally {
    isSyncRunning = false;
  }
}

/** 선생님 수동 시간 수정 */
export async function updateMedicationTime(id: string, newHhmm: string) {
  // 1. 선택한 시간이 오늘 기준 과거인지 검증
  const todayYmd = new Date().toISOString().split('T')[0];
  const ts = hhmmToEpoch(todayYmd, newHhmm);
  if (ts && ts < Date.now()) {
    throw new Error('과거 시간으로는 알람을 설정할 수 없습니다.');
  }

  // 2. 정상 시간이면 업데이트 진행
  await dbOperations.updateParsedTime(id, newHhmm);   // is_manual_edited=1
  await MedicationSync.updateParsedTime(id, newHhmm);  // 네이티브: 알람 취소 + 재예약
}
