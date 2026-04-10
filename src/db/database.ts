import * as SQLite from 'expo-sqlite';

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

let db: SQLite.SQLiteDatabase;

export const initDatabase = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('centralpark.db');
  }

  // 테이블 생성
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
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
  `);

  return db;
};

export const getDb = () => db;

// DAO 함수들
export const dbOperations = {
  // ─── 원아 관련 ───
  getStudentsByClass: async (classId: string): Promise<Student[]> => {
    const database = db || await initDatabase();
    return await database.getAllAsync<Student>(
      'SELECT * FROM students WHERE classId = ? AND status = "재원"',
      [classId]
    );
  },

  // ─── 메모 관련 ───
  getMemo: async (studentId: string): Promise<Memo | null> => {
    const database = db || await initDatabase();
    return await database.getFirstAsync<Memo>(
      'SELECT * FROM memos WHERE studentId = ?',
      [studentId]
    );
  },

  saveMemo: async (studentId: string, memoText: string) => {
    const database = db || await initDatabase();
    const now = Date.now();
    await database.runAsync(
      'INSERT OR REPLACE INTO memos (studentId, memoText, lastUpdated) VALUES (?, ?, ?)',
      [studentId, memoText, now]
    );
  },

  getAllMemos: async (): Promise<Memo[]> => {
    const database = db || await initDatabase();
    return await database.getAllAsync<Memo>('SELECT * FROM memos WHERE memoText IS NOT NULL AND memoText != ""');
  },

  // ─── 체크리스트 관련 ───
  createChecklist: async (date: string, classId: string, title: string, items: string[]) => {
    const database = db || await initDatabase();
    const id = `${date}|${classId}|${title}`;
    await database.runAsync(
      'INSERT OR REPLACE INTO checklist_meta (id, date, classId, title, items) VALUES (?, ?, ?, ?, ?)',
      [id, date, classId, title, JSON.stringify(items)]
    );
  },

  getChecklistsByClass: async (classId: string): Promise<ChecklistMeta[]> => {
    const database = db || await initDatabase();
    return await database.getAllAsync<ChecklistMeta>(
      'SELECT * FROM checklist_meta WHERE classId = ? ORDER BY date DESC',
      [classId]
    );
  },

  getAllChecklists: async (): Promise<ChecklistMeta[]> => {
    const database = db || await initDatabase();
    return await database.getAllAsync<ChecklistMeta>(
      'SELECT * FROM checklist_meta ORDER BY date DESC'
    );
  },

  saveChecklistItem: async (
    date: string, classId: string, title: string,
    studentId: string, itemName: string, isChecked: boolean
  ) => {
    const database = db || await initDatabase();
    const id = `${date}|${classId}|${title}|${studentId}|${itemName}`;
    await database.runAsync(
      'INSERT OR REPLACE INTO checklists (id, date, classId, title, studentId, itemName, isChecked) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, date, classId, title, studentId, itemName, isChecked ? 1 : 0]
    );
  },

  getChecklistItems: async (date: string, classId: string, title: string): Promise<ChecklistItem[]> => {
    const database = db || await initDatabase();
    return await database.getAllAsync<ChecklistItem>(
      'SELECT * FROM checklists WHERE date = ? AND classId = ? AND title = ?',
      [date, classId, title]
    );
  },

  getAllChecklistItems: async (): Promise<ChecklistItem[]> => {
    const database = db || await initDatabase();
    return await database.getAllAsync<ChecklistItem>('SELECT * FROM checklists');
  },

  hideChecklist: async (date: string, classId: string, title: string) => {
    const database = db || await initDatabase();
    const metaId = `${date}|${classId}|${title}`;
    await database.runAsync('DELETE FROM checklist_meta WHERE id = ?', [metaId]);
    await database.runAsync(
      'DELETE FROM checklists WHERE date = ? AND classId = ? AND title = ?',
      [date, classId, title]
    );
  },

  // ─── 범용 캐시 (원아/캘린더 등 외부 데이터) ───
  getCache: async <T = any>(key: string): Promise<{ value: T; updatedAt: number } | null> => {
    const database = db || await initDatabase();
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
    const database = db || await initDatabase();
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
};
