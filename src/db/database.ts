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
  isPendingSync: number; // 0 or 1
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
  isPendingSync: number; // 0 or 1
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
      lastUpdated INTEGER NOT NULL,
      isPendingSync INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS checklists (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      classId TEXT NOT NULL,
      title TEXT NOT NULL,
      studentId TEXT NOT NULL,
      itemName TEXT NOT NULL,
      isChecked INTEGER DEFAULT 0,
      isPendingSync INTEGER DEFAULT 0
    );
  `);
  
  return db;
};

export const getDb = () => db;

// DAO 시뮬레이션 함수들
export const dbOperations = {
  // 원아 관련
  getStudentsByClass: async (classId: string): Promise<Student[]> => {
    return await db.getAllAsync<Student>(
      'SELECT * FROM students WHERE classId = ? AND status = "재원"',
      [classId]
    );
  },

  // 메모 관련
  getMemo: async (studentId: string): Promise<Memo | null> => {
    return await db.getFirstAsync<Memo>(
      'SELECT * FROM memos WHERE studentId = ?',
      [studentId]
    );
  },

  saveMemo: async (studentId: string, memoText: string) => {
    const now = Date.now();
    await db.runAsync(
      'INSERT OR REPLACE INTO memos (studentId, memoText, lastUpdated, isPendingSync) VALUES (?, ?, ?, ?)',
      [studentId, memoText, now, 1]
    );
  },

  // 동기화 관련
  getUnsyncedMemos: async (): Promise<Memo[]> => {
    return await db.getAllAsync<Memo>('SELECT * FROM memos WHERE isPendingSync = 1');
  },

  markMemoAsSynced: async (studentId: string) => {
    await db.runAsync('UPDATE memos SET isPendingSync = 0 WHERE studentId = ?', [studentId]);
  }
};
