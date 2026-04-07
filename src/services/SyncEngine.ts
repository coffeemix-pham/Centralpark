import { dbOperations, getDb } from '../db/database';
import { postToGAS, fetchLatestFromServer } from '../api/gasApi';

export const SyncEngine = {
  // 로컬에서 변경된 내용을 서버로 밀어넣기 (Push)
  pushLocalChanges: async () => {
    try {
      const unsyncedMemos = await dbOperations.getUnsyncedMemos();
      
      for (const memo of unsyncedMemos) {
        const result = await postToGAS({
          action: 'saveMemo',
          data: memo,
          timestamp: memo.lastUpdated
        });
        
        if (result.success) {
          await dbOperations.markMemoAsSynced(memo.studentId);
          console.log(`Synced memo for student ${memo.studentId}`);
        }
      }
    } catch (error) {
      console.error('SyncEngine Push Error:', error);
    }
  },

  // 서버의 최신 데이터를 로컬로 가져오기 (Pull)
  pullServerChanges: async () => {
    try {
      const lastSyncTime = 0; // 실제로는 AsyncStorage 등에서 마지막 성공 시각을 관리해야 함
      const serverData = await fetchLatestFromServer(lastSyncTime);
      
      if (serverData && serverData.length > 0) {
        const db = getDb();
        for (const remote of serverData) {
          // 서버 데이터가 더 최신인 경우에만 덮어쓰기 (양방향 동기화 핵심)
          const local = await dbOperations.getMemo(remote.studentId);
          if (!local || remote.lastUpdated > local.lastUpdated) {
            await db.runAsync(
              'INSERT OR REPLACE INTO memos (studentId, memoText, lastUpdated, isPendingSync) VALUES (?, ?, ?, 0)',
              [remote.studentId, remote.memoText, remote.lastUpdated]
            );
          }
        }
      }
    } catch (error) {
      console.error('SyncEngine Pull Error:', error);
    }
  },

  // 전체 동기화 실행 (앱 시작 시 또는 주기적 호출)
  runFullSync: async () => {
    console.log('Starting Full Sync...');
    await SyncEngine.pushLocalChanges();
    await SyncEngine.pullServerChanges();
    console.log('Full Sync Completed.');
  }
};
