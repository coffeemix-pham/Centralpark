import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

// 원아 정보 타입 정의
export interface Student {
  id: string;
  name: string;
  classId: string;
  birthdate: string; // YYYY-MM-DD
  gender: string;
  contact: string;
  status: '재원' | '졸업' | '퇴소';
}

// 메모 정보 타입 정의
export interface Memo {
  studentId: string;
  memoText: string;
  lastUpdated: number; // Timestamp
}

// 체크리스트 메타 정보 타입 정의
export interface ChecklistMeta {
  id: string;          // "date|classId|title"
  date: string;
  classId: string;
  title: string;
  items: string;       // JSON: ["식사","수면","투약"]
}

// 체크리스트 아이템 타입 정의
export interface ChecklistItem {
  id: string;
  date: string;
  classId: string;
  title: string;
  studentId: string;
  itemName: string;
  isChecked: number; // 0 or 1
}

// 키즈노트 투약의뢰서 (로컬 캐시)
export interface MedicationRow {
  id: string;
  child_name: string;
  class_id: number | null;
  class_name: string | null;
  date_medicated: string;           // YYYY-MM-DD
  medicine_type: string;
  dosage: string;
  original_time: string;            // 원본 텍스트
  parsed_time: string | null;       // 'HH:mm' or null
  is_manual_edited: number;         // 0/1
  symptoms: string | null;          // [NEW] 증상
  storage_method: string | null;    // [NEW] 보관방법
  dose_count: number | null;        // [NEW] 횟수
  special_note: string | null;
  status: 'pending' | 'done';
  done_at: number | null;
  alarm_scheduled: number;          // 0/1
  created_at: number;
  updated_at: number;
}

// 키워드 규칙
export interface KeywordRuleRow {
  id: number;
  keyword: string;
  time_hhmm: string;                // 'HH:mm'
  priority: number;
  created_at: number;
  updated_at: number;
}

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null; // 👈 락(Lock) 변수 추가

/**
 * [Fail-Safe] 안전하게 DB를 오픈하고, 손상 시 자동 복구(삭제 후 재 생성)
 */
async function safeOpenDatabase(dbName: string, retryCount = 0): Promise<SQLite.SQLiteDatabase> {
  try {
    const database = await SQLite.openDatabaseAsync(dbName);
    return database;
  } catch (error) {
    const errorMsg = String(error).toLowerCase();
    const isMalformed = errorMsg.includes('malformed') || errorMsg.includes('disk i/o error');

    if (isMalformed && retryCount < 1) {
      console.error(`⚠️ [DB RECOVERY] 손상 감지! 자동 복구 시작 (재시도: ${retryCount + 1})`);
      
      const dbPaths = [
        `${FileSystem.documentDirectory}SQLite/${dbName}`,
        `${FileSystem.documentDirectory}databases/${dbName}`
      ];

      for (const path of dbPaths) {
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists) {
          try {
            await FileSystem.deleteAsync(path, { idempotent: true });
            console.log(`✅ [DB RECOVERY] 파일 삭제 완료: ${path}`);
          } catch (delErr) {
            console.error(`❌ [DB RECOVERY] 파일 삭제 실패: ${path}`, delErr);
          }
        }
      }
      return safeOpenDatabase(dbName, retryCount + 1);
    }
    throw error;
  }
}

/**
 * [Promise Lock] DB 초기화를 안전하게 보호 (중복 실행 방지)
 */
export const initDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  if (initPromise) return initPromise; // 이미 진행 중이라면 그 약속을 기다림

  initPromise = (async () => {
    try {
      const openedDb = await safeOpenDatabase('centralpark.db');
      
      // 1. 성능 및 안정성 설정 (PRAGMA 동기화)
      await openedDb.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 2000;
      `);

      // 2. 테이블 생성 및 마이그레이션 (트랜잭션으로 보호)
      await openedDb.withTransactionAsync(async () => {
        await openedDb.execAsync(`
          CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            classId TEXT NOT NULL,
            birthdate TEXT,
            gender TEXT,
            contact TEXT,
            status TEXT DEFAULT '재원'
          );
          CREATE TABLE IF NOT EXISTS memos (
            studentId TEXT PRIMARY KEY NOT NULL,
            memoText TEXT,
            lastUpdated INTEGER NOT NULL
          );
          CREATE TABLE IF NOT EXISTS checklist_meta (
            id TEXT PRIMARY KEY NOT NULL,
            date TEXT NOT NULL,
            classId TEXT NOT NULL,
            title TEXT NOT NULL,
            items TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS checklists (
            id TEXT PRIMARY KEY NOT NULL,
            date TEXT NOT NULL,
            classId TEXT NOT NULL,
            title TEXT NOT NULL,
            studentId TEXT NOT NULL,
            itemName TEXT NOT NULL,
            isChecked INTEGER DEFAULT 0
          );
          CREATE TABLE IF NOT EXISTS kv_cache (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updatedAt INTEGER NOT NULL
          );
          CREATE TABLE IF NOT EXISTS medications (
            id TEXT PRIMARY KEY NOT NULL,
            child_name TEXT NOT NULL,
            class_id INTEGER,
            class_name TEXT,
            date_medicated TEXT NOT NULL,
            medicine_type TEXT NOT NULL,
            dosage TEXT NOT NULL,
            original_time TEXT NOT NULL,
            parsed_time TEXT,
            is_manual_edited INTEGER NOT NULL DEFAULT 0,
            symptoms TEXT,
            storage_method TEXT,
            dose_count INTEGER,
            special_note TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            done_at INTEGER,
            alarm_scheduled INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_medications_date ON medications(date_medicated);
          CREATE INDEX IF NOT EXISTS idx_medications_status ON medications(status);
          CREATE TABLE IF NOT EXISTS keyword_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL UNIQUE,
            time_hhmm TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);

        // 마이그레이션 컬럼 체크
        const tableInfo = await openedDb.getAllAsync<{ name: string }>("PRAGMA table_info(medications)");
        const columnNames = tableInfo.map(c => c.name);
        if (!columnNames.includes('symptoms')) await openedDb.execAsync("ALTER TABLE medications ADD COLUMN symptoms TEXT;");
        if (!columnNames.includes('storage_method')) await openedDb.execAsync("ALTER TABLE medications ADD COLUMN storage_method TEXT;");
        if (!columnNames.includes('dose_count')) await openedDb.execAsync("ALTER TABLE medications ADD COLUMN dose_count INTEGER;");
      });

      db = openedDb;
      return db;
    } catch (e) {
      initPromise = null; // 실패 시 다시 시도할 수 있도록 초기화
      throw e;
    }
  })();

  return initPromise;
};

export const getDb = () => db;

// DAO 함수들
export const dbOperations = {
  // ─── 원아 관련 ───
  getStudentsByClass: async (classId: string): Promise<Student[]> => {
    const database = await initDatabase();
    return await database.getAllAsync<Student>(
      'SELECT * FROM students WHERE classId = ? AND status = "재원"',
      [classId]
    );
  },

  // ─── 메모 관련 ───
  getMemo: async (studentId: string): Promise<Memo | null> => {
    const database = await initDatabase();
    return await database.getFirstAsync<Memo>(
      'SELECT * FROM memos WHERE studentId = ?',
      [studentId]
    );
  },

  saveMemo: async (studentId: string, memoText: string) => {
    const database = await initDatabase();
    const now = Date.now();
    await database.runAsync(
      'INSERT OR REPLACE INTO memos (studentId, memoText, lastUpdated) VALUES (?, ?, ?)',
      [studentId, memoText, now]
    );
  },

  getAllMemos: async (): Promise<Memo[]> => {
    const database = await initDatabase();
    return await database.getAllAsync<Memo>('SELECT * FROM memos WHERE memoText IS NOT NULL AND memoText != ""');
  },

  // ─── 체크리스트 관련 ───
  createChecklist: async (date: string, classId: string, title: string, items: string[]) => {
    const database = await initDatabase();
    const id = `${date}|${classId}|${title}`;
    await database.runAsync(
      'INSERT OR REPLACE INTO checklist_meta (id, date, classId, title, items) VALUES (?, ?, ?, ?, ?)',
      [id, date, classId, title, JSON.stringify(items)]
    );
  },

  getChecklistsByClass: async (classId: string): Promise<ChecklistMeta[]> => {
    const database = await initDatabase();
    return await database.getAllAsync<ChecklistMeta>(
      'SELECT * FROM checklist_meta WHERE classId = ? ORDER BY date DESC',
      [classId]
    );
  },

  getAllChecklists: async (): Promise<ChecklistMeta[]> => {
    const database = await initDatabase();
    return await database.getAllAsync<ChecklistMeta>(
      'SELECT * FROM checklist_meta ORDER BY date DESC'
    );
  },

  saveChecklistItem: async (
    date: string, classId: string, title: string,
    studentId: string, itemName: string, isChecked: boolean
  ) => {
    const database = await initDatabase();
    const id = `${date}|${classId}|${title}|${studentId}|${itemName}`;
    await database.runAsync(
      'INSERT OR REPLACE INTO checklists (id, date, classId, title, studentId, itemName, isChecked) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, date, classId, title, studentId, itemName, isChecked ? 1 : 0]
    );
  },

  getChecklistItems: async (date: string, classId: string, title: string): Promise<ChecklistItem[]> => {
    const database = await initDatabase();
    return await database.getAllAsync<ChecklistItem>(
      'SELECT * FROM checklists WHERE date = ? AND classId = ? AND title = ?',
      [date, classId, title]
    );
  },

  getAllChecklistItems: async (): Promise<ChecklistItem[]> => {
    const database = await initDatabase();
    return await database.getAllAsync<ChecklistItem>('SELECT * FROM checklists');
  },

  hideChecklist: async (date: string, classId: string, title: string) => {
    const database = await initDatabase();
    const metaId = `${date}|${classId}|${title}`;
    await database.runAsync('DELETE FROM checklist_meta WHERE id = ?', [metaId]);
    await database.runAsync(
      'DELETE FROM checklists WHERE date = ? AND classId = ? AND title = ?',
      [date, classId, title]
    );
  },

  // ─── 범용 캐시 (원아/캘린더 등 외부 데이터) ───
  getCache: async <T = any>(key: string): Promise<{ value: T; updatedAt: number } | null> => {
    const database = await initDatabase();
    try {
      const row = await database.getFirstAsync<{ value: string; updatedAt: number }>(
        'SELECT value, updatedAt FROM kv_cache WHERE key = ?',
        [key]
      );
      
      if (!row || !row.value) {
        console.log(`[Cache Miss] ${key} 데이터가 없습니다.`);
        return null;
      }

      // 안전한 파싱 시도
      const parsedValue = JSON.parse(row.value) as T;
      return { value: parsedValue, updatedAt: row.updatedAt };
      
    } catch (error) {
      console.error(`[Cache Parse Error] ${key} 데이터 파싱 실패:`, error);
      // 기존 캐시가 깨졌다면 차라리 삭제하여 다음 동기화 때 새로 받도록 유도
      await database.runAsync('DELETE FROM kv_cache WHERE key = ?', [key]);
      return null;
    }
  },

  setCache: async (key: string, value: any) => {
    const database = await initDatabase();
    try {
      const stringifiedValue = JSON.stringify(value);
      await database.runAsync(
        'INSERT OR REPLACE INTO kv_cache (key, value, updatedAt) VALUES (?, ?, ?)',
        [key, stringifiedValue, Date.now()]
      );
      console.log(`[Cache Set] ${key} 저장 완료`);
    } catch (error) {
      console.error(`[Cache Save Error] ${key} 저장 실패:`, error);
    }
  },

  // ─── 투약의뢰서 관련 ───
  getTodaysMedications: async (): Promise<MedicationRow[]> => {
    const database = await initDatabase();
    const today = new Date().toISOString().slice(0, 10);
    return await database.getAllAsync<MedicationRow>(
      'SELECT * FROM medications WHERE date_medicated = ? ORDER BY parsed_time ASC',
      [today]
    );
  },

  getTodaysPending: async (): Promise<MedicationRow[]> => {
    const database = await initDatabase();
    const today = new Date().toISOString().slice(0, 10);
    return await database.getAllAsync<MedicationRow>(
      'SELECT * FROM medications WHERE date_medicated = ? AND status = "pending" ORDER BY parsed_time ASC',
      [today]
    );
  },

  markMedicationDone: async (id: string) => {
    const database = await initDatabase();
    const now = Date.now();
    await database.runAsync(
      'UPDATE medications SET status = "done", done_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    );
  },

  updateParsedTime: async (id: string, newTime: string) => {
    const database = await initDatabase();
    const now = Date.now();
    await database.runAsync(
      'UPDATE medications SET parsed_time = ?, is_manual_edited = 1, updated_at = ? WHERE id = ?',
      [newTime, now, id]
    );
  },

  // ─── 키워드 규칙 관련 ───
  listKeywordRules: async (): Promise<KeywordRuleRow[]> => {
    const database = await initDatabase();
    return await database.getAllAsync<KeywordRuleRow>(
      'SELECT * FROM keyword_rules ORDER BY priority DESC, length(keyword) DESC'
    );
  },

  upsertKeywordRule: async (keyword: string, time_hhmm: string, priority: number) => {
    const database = await initDatabase();
    const now = Date.now();
    await database.runAsync(
      `INSERT INTO keyword_rules (keyword, time_hhmm, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(keyword) DO UPDATE SET time_hhmm = excluded.time_hhmm, priority = excluded.priority, updated_at = excluded.updated_at`,
      [keyword, time_hhmm, priority, now, now]
    );
  },

  deleteKeywordRule: async (id: number) => {
    const database = await initDatabase();
    await database.runAsync('DELETE FROM keyword_rules WHERE id = ?', [id]);
  },

  seedDefaultKeywordRules: async () => {
    const database = await initDatabase();
    // kv_cache에 seed 완료 플래그 확인
    const flag = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv_cache WHERE key = ?',
      ['keyword_rules_seeded_v1']
    );
    if (flag) return;
    const defaults: [string, string, number][] = [
      ['아침', '09:30', 0],
      ['오전 간식', '10:30', 1],
      ['점심', '13:00', 2],
      ['오후 간식', '15:30', 3],
      ['저녁', '17:00', 4],
    ];
    const now = Date.now();
    for (const [kw, time, pri] of defaults) {
      await database.runAsync(
        `INSERT OR IGNORE INTO keyword_rules (keyword, time_hhmm, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [kw, time, pri, now, now]
      );
    }
    await database.runAsync(
      'INSERT OR REPLACE INTO kv_cache (key, value, updatedAt) VALUES (?, ?, ?)',
      ['keyword_rules_seeded_v1', '1', now]
    );
  },
};

// ─── 투약의뢰서 Upsert (medicationSync.ts 에서 사용) ───
function sha1Simple(input: string): string {
  // 간단한 해시 — crypto 없이 충분한 유니크 ID 생성
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function generateMedicationId(childName: string, date: string, medicineType: string, idx: number): string {
  return sha1Simple(`${childName}|${date}|${medicineType}|${idx}`).slice(0, 16);
}

/**
 * SQLite 바인딩 파라미터를 위한 강력한 안전 변환기 (전수 검사용)
 */
function safeBind(val: any, targetType: 'string' | 'number' | 'boolean' = 'string') {
  if (val === null || val === undefined) return null;

  if (targetType === 'number') {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  if (targetType === 'boolean') {
    return val ? 1 : 0;
  }

  // 배열 처리 (사용자 요청: 쉼표로 연결)
  if (Array.isArray(val)) {
    return val.join(", ");
  }

  // 객체 처리 (사용자 요청: 상세 문자열화)
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch (e) {
      return "[Object]";
    }
  }

  return val;
}

export interface ClassFilter {
  classId?: string | null;
  className?: string | null;
}

export type KeywordMatchFn = (original: string, rules: KeywordRuleRow[]) => string | null;

export async function upsertMedications(
  list: import('../api/gasApi').KidsnoteMedication[],
  filter: ClassFilter,
  rules: KeywordRuleRow[],
  matchKeyword: KeywordMatchFn
): Promise<{ inserted: number; updated: number; skipped: number }> {
  const database = db || await initDatabase();
  let inserted = 0, updated = 0, skipped = 0;
  const now = Date.now();

  console.log("=== 🕵️‍♂️ 정밀 디버깅 시작 ===");
  if (list && list.length > 0) {
    console.log("🔎 [RAW DATA 1st ITEM]:", JSON.stringify(list[0], null, 2));
  }
  console.log("1. 선생님이 설정한 반 이름(raw):", filter?.className);

  for (const med of list) {
    // 📸 [CCTV 1] 도대체 설정값이 뭘로 넘어오고 있는가?
    const rawTargetName = filter?.className || "";
    const cleanTarget = rawTargetName.replace(/반/g, "").replace(/\s/g, "");

    const rawMedName = med.class_name || "";
    const cleanMed = rawMedName.replace(/반/g, "").replace(/\s/g, "");

    const isAll = cleanTarget === "" || cleanTarget === "전체" || cleanTarget === "ALL";
    const isNameMatch = (cleanMed !== "" && cleanTarget !== "") && (cleanMed.includes(cleanTarget) || cleanTarget.includes(cleanMed));
    const isIdMatch = filter?.classId && med.belong_to_class === Number(filter.classId);

    // 📸 [CCTV 2] 필터링에 걸려서 버려지는 데이터 확인
    if (!isAll && !isNameMatch && !isIdMatch) {
      console.log(`❌ 버려짐: [${med.child_name}] (키즈노트 반: '${rawMedName}' / 내가 설정한 반: '${rawTargetName}') -> clean비교: '${cleanMed}' vs '${cleanTarget}'`);
      skipped++;
      continue;
    }

    // 📸 [CCTV 3] 필터링을 무사히 통과한 데이터 확인
    console.log(`✅ 통과됨: [${med.child_name}] DB 저장 시도!`);

    for (let idx = 0; idx < med.items.length; idx++) {
      const item = med.items[idx];
      const id = generateMedicationId(med.child_name, med.date_medicated, item.medicine_type, idx);

      try {
        // [전수 검사 1] id 파라미터 체크
        const existing = await database.getFirstAsync<{ parsed_time: string | null; is_manual_edited: number; status: string }>(
          'SELECT parsed_time, is_manual_edited, status FROM medications WHERE id = ?',
          [safeBind(id)]
        );
        
        const isManual = existing?.is_manual_edited === 1;
        // [지시 반영] 자동 시간 변환(matchKeyword)을 제거하고, 수동 수정이 아닐 경우 null로 유지하여 원본 텍스트가 보이게 함
        const parsedTime = isManual ? existing!.parsed_time : null; 
        const status = existing?.status ?? 'pending';

        // [전수 검사 2] 바인딩 파라미터(17개) 전수 맵핑
        await database.runAsync(
          `INSERT OR REPLACE INTO medications
           (id, child_name, class_id, class_name, date_medicated, medicine_type, dosage,
            original_time, parsed_time, is_manual_edited, symptoms, storage_method,
            dose_count, special_note, status, alarm_scheduled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            safeBind(id),                      // 1
            safeBind(med.child_name),          // 2
            safeBind(med.belong_to_class, 'number'), // 3
            safeBind(med.class_name),          // 4
            safeBind(med.date_medicated),      // 5
            safeBind(item.medicine_type),      // 6
            safeBind(item.dosage),             // 7
            safeBind(item.medication_time),    // 8
            safeBind(parsedTime),              // 9
            safeBind(isManual, 'boolean'),     // 10
            safeBind(item.symptoms),           // 11
            safeBind(item.storage_method),     // 12
            safeBind(item.dose_count, 'number') ?? (idx + 1), // 13
            // [지시 반영] special_note가 객체 형태의 문자열일 경우 실제 메시지만 추출하거나 정제함
            (() => {
              const note = item.special_note;
              if (!note) return "";
              if (typeof note === 'object') return ""; // 객체면 무시 (혹은 상세 파싱)
              if (typeof note === 'string' && note.startsWith('{')) {
                try {
                  const parsed = JSON.parse(note);
                  return parsed.message || parsed.content || "";
                } catch (e) { return ""; }
              }
              return String(note);
            })(), // 14
            safeBind(status),                  // 15 
            safeBind(now, 'number'),           // 16
            safeBind(now, 'number')            // 17
          ]
        );

        if (existing) { updated++; } else { inserted++; }
      } catch (err) {
        console.error(`❌ [DB ERROR] 저장 실패: ${med.child_name} - ${item.medicine_type}`);
        console.error(`에러 내용: ${err instanceof Error ? err.message : String(err)}`);
        // 지시 사항: 전체 원아 데이터 덤프
        console.error("저장 실패 데이터:", JSON.stringify(med));
        skipped++;
      }
    }
  }

  console.log(`=== 🏁 디버깅 종료 (총 ${inserted + updated}건 필터 통과) ===`);

  return { inserted, updated, skipped };
}

/** [NEW] 홈 화면 위젯을 위한 오늘 투약 요약 정보 (아동수 기준 집계) */
export async function getTodayMedicationSummary(className: string | null = null) {
  const database = await initDatabase();
  
  // 한국 표준시(KST) 기준 오늘 날짜 생성 (YYYY-MM-DD)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  
  // 반 필터 조건 구성
  const isAll = !className || className === '전체' || className === 'ALL';
  const classLike = `%${className?.replace(/반/g, '')}%`;

  // 1. 전체/대기/완료 명수(아동수) 집계
  // 한 아동이 여러 약을 신청해도 1명으로 카운트하기 위해 DISTINCT child_name 사용
  const statsQuery = `
    SELECT 
      COUNT(DISTINCT child_name) as total,
      COUNT(DISTINCT CASE WHEN status = 'pending' THEN child_name END) as pending,
      COUNT(DISTINCT CASE WHEN status = 'done' AND child_name NOT IN (SELECT child_name FROM medications WHERE date_medicated = ? AND status = 'pending') THEN child_name END) as done
    FROM medications 
    WHERE date_medicated = ?
    AND (? = 1 OR class_name LIKE ?)
  `;

  // 주의: '완료' 명수는 '해당 아동의 모든 투약이 완료'되었을 때만 완료로 카운트하는 것이 논리적으로 정확함
  // 여기서는 간단하게 DISTINCT로 처리하되 필요시 서브쿼리 활용
  const stats = await database.getFirstAsync<{ total: number; pending: number; done: number }>(
    statsQuery,
    [today, today, isAll ? 1 : 0, classLike]
  );

  // 2. 투약 시간이 임박한 대기 중인 아동 (중복 제거)
  const upcoming = await database.getAllAsync<{ child_name: string; parsed_time: string }>(
    `SELECT DISTINCT child_name, parsed_time FROM medications
     WHERE date_medicated = ? AND status = 'pending' AND parsed_time IS NOT NULL
     AND (? = 1 OR class_name LIKE ?)
     ORDER BY parsed_time ASC LIMIT 3`,
    [today, isAll ? 1 : 0, classLike]
  );

  return {
    total: stats?.total || 0,
    pending: stats?.pending || 0,
    done: stats?.done || 0,
    upcoming: upcoming || []
  };
}

Object.assign(dbOperations, {
  getTodayMedicationSummary,
  getTodaysMedications: async () => {
    const database = db || await initDatabase();
    const today = new Date().toISOString().split('T')[0];
    return await database.getAllAsync<MedicationRow>(
      'SELECT * FROM medications WHERE date_medicated = ? ORDER BY status DESC, parsed_time ASC',
      [today]
    );
  },
  getTodaysPending: async () => {
    const database = db || await initDatabase();
    const today = new Date().toISOString().split('T')[0];
    return await database.getAllAsync<MedicationRow>(
      "SELECT * FROM medications WHERE date_medicated = ? AND status = 'pending'",
      [today]
    );
  },
  markMedicationDone: async (id: string) => {
    const database = db || await initDatabase();
    await database.runAsync(
      "UPDATE medications SET status = 'done', done_at = ?, updated_at = ? WHERE id = ?",
      [Date.now(), Date.now(), id]
    );
  },
  updateParsedTime: async (id: string, hmmm: string) => {
    const database = db || await initDatabase();
    await database.runAsync(
      'UPDATE medications SET parsed_time = ?, is_manual_edited = 1, updated_at = ? WHERE id = ?',
      [hmmm, Date.now(), id]
    );
  },
  clearAllMedications: async () => {
    const database = db || await initDatabase();
    await database.runAsync('DELETE FROM medications');
  },
});
