import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../../src/constants/theme';
import { dbOperations, MedicationRow, initDatabase } from '../../src/db/database';
import { runForegroundSyncOnce, updateMedicationTime } from '../../src/services/medicationSync';
import { loadKidsnoteCredentials } from '../../src/store/credentialsStore';
import { fetchMedicationsFromGAS } from '../../src/api/gasApi';
import { loadTeacherProfile } from '../../src/store/teacherStore';

export default function MedicationScreen() {
  const [items, setItems] = useState<MedicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCreds, setHasCreds] = useState(false);
  // 동기화 상태 로그
  const [syncStatus, setSyncStatus] = useState<'idle'|'syncing'|'success'|'error'>('idle');
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [showDetailLogs, setShowDetailLogs] = useState(false); // [NEW] 로그 접기 상태
  // 시간 수정 모달 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHour, setEditHour] = useState('');
  const [editMin, setEditMin] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const creds = await loadKidsnoteCredentials();
      setHasCreds(!!creds);
      
      // DB 초기화 대기 및 데이터 로드
      await initDatabase(); 
      const rows = await dbOperations.getTodaysMedications();
      setItems(rows);
    } catch (e) {
      console.warn('medication fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 최초 마운트 시 한 번만 실행되도록 보장
    fetchData();
  }, []); // 의존성 배열을 비워 최초 1회 실행 보장

  const onRefresh = async () => {
    if (refreshing) return; // 중복 클릭 방지 가드

    setRefreshing(true);
    setSyncStatus('syncing');
    setShowDetailLogs(true);
    
    const log: string[] = [];
    try {
      log.push('🔑 자격증명 확인 중...');
      const creds = await loadKidsnoteCredentials();
      if (!creds) throw new Error('자격증명 미설정');
      log.push(`✅ ID: ${creds.username}`);

      log.push('🌐 동기화 프로세스 시작...');
      // 1. 동기화 로직 수행 (내부에서 await initDatabase() 호출됨)
      await runForegroundSyncOnce(); 
      log.push('✅ 서버 데이터 수신 및 DB 반영 완료');

      log.push('💾 화면 데이터 갱신 중...');
      // 2. 동기화 완료 후 안전하게 데이터 다시 불러오기
      await fetchData(); 
      
      setSyncStatus('success');
      setTimeout(() => setShowDetailLogs(false), 2000);
    } catch (e: any) {
      log.push(`❌ 오류: ${e.message || String(e)}`);
      setSyncStatus('error');
      setShowDetailLogs(true);
    } finally {
      setSyncLog(log);
      setRefreshing(false);
    }
  };

  const handleDone = async (id: string) => {
    try {
      await dbOperations.markMedicationDone(id);
      await fetchData();
    } catch (e) {
      Alert.alert('오류', '투약 완료 처리에 실패했습니다.');
    }
  };

  const openTimeEdit = (item: MedicationRow) => {
    const parsed = item.parsed_time || '';
    const [h, m] = parsed.split(':');
    setEditHour(h || '');
    setEditMin(m || '');
    setEditingId(item.id);
  };

  const saveTimeEdit = async () => {
    if (!editingId) return;
    const h = parseInt(editHour, 10);
    const m = parseInt(editMin, 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      Alert.alert('시간 오류', '올바른 시간을 입력해 주세요 (00~23시, 00~59분)');
      return;
    }
    const hhmm = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    try {
      await updateMedicationTime(editingId, hhmm);
      setEditingId(null);
      await fetchData();
      Alert.alert('✅ 시간 변경 완료', `알람이 ${hhmm}으로 재설정되었습니다.`);
    } catch (e: any) {
      Alert.alert('오류', e.message || '시간 변경에 실패했습니다.');
    }
  };

  const onResetDb = () => {
    Alert.alert(
      '투약 이력 초기화',
      '로컬 DB의 모든 투약 이력을 삭제합니다.\n(키즈노트 서버 원본은 영향 없음)\n\n계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            try {
              await dbOperations.clearAllMedications();
              setItems([]);
              setSyncStatus('idle');
              setSyncLog([]);
              Alert.alert('완료', '투약 이력이 초기화되었습니다.\n새로고침으로 다시 동기화해 주세요.');
            } catch (e: any) {
              Alert.alert('오류', e.message || '초기화에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const pendingItems = items.filter(i => i.status === 'pending');
  const doneItems = items.filter(i => i.status === 'done');

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasCreds) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>💊 투약의뢰</Text>
          <Text style={styles.headerSub}>키즈노트 투약의뢰서 자동 알림</Text>
        </View>
        <View style={styles.centerWrap}>
          <Text style={styles.emptyEmoji}>🔑</Text>
          <Text style={styles.emptyTitle}>키즈노트 연동이 필요합니다</Text>
          <Text style={styles.emptyDesc}>
            설정 {'>'} 키즈노트 계정에서{'\n'}아이디와 비밀번호를 입력해 주세요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>💊 투약의뢰</Text>
          <Text style={styles.headerSub}>
            오늘의 투약 {pendingItems.length}건 대기 · {doneItems.length}건 완료
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity style={styles.syncIconButton} onPress={onResetDb}>
            <Text style={{ fontSize: 18 }}>🗑️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.syncIconButton} onPress={onRefresh} disabled={refreshing}>
            <ActivityIndicator animating={refreshing} size="small" color={COLORS.primary} style={{ position: 'absolute' }} />
            {!refreshing && <Text style={{ fontSize: 20 }}>🔄</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
      >
        {/* 요약 로그 섹션 */}
        {syncStatus !== 'idle' && (
          <View style={styles.syncStatusBanner}>
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncSummaryText}>
                {syncStatus === 'syncing' ? '🔄 동기화 진행 중...' :
                 syncStatus === 'success' ? `✅ 동기화 완료 (DB: ${items.length}건)` :
                 '❌ 동기화 실패 (오류 발생)'}
              </Text>
              <TouchableOpacity onPress={() => setShowDetailLogs(!showDetailLogs)}>
                <Text style={styles.logToggleBtn}>{showDetailLogs ? '[-] 접기' : '[+] 로그 보기'}</Text>
              </TouchableOpacity>
            </View>
            
            {showDetailLogs && syncLog.length > 0 && (
              <View style={styles.logCard}>
                {syncLog.map((line, i) => (
                  <Text key={i} style={styles.logLine}>{line}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.centerWrap}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>오늘은 투약 요청이 없습니다</Text>
            <Text style={styles.emptyDesc}>
              우측 상단 동기화 버튼을 눌러 확인해 보세요
            </Text>
          </View>
        ) : (
          <>
            {/* 대기 중 */}
            {pendingItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⏰ 대기 중</Text>
                {pendingItems.map(item => (
                  <MedCard key={item.id} item={item}
                    onDone={() => handleDone(item.id)}
                    onEditTime={() => openTimeEdit(item)} />
                ))}
              </View>
            )}
            {/* 완료 */}
            {doneItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ 투약 완료</Text>
                {doneItems.map(item => (
                  <MedCard key={item.id} item={item} isDone />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* 시간 편집 모달 */}
      <Modal visible={!!editingId} transparent animationType="fade"
        onRequestClose={() => setEditingId(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⏰ 알람 시간 변경</Text>
            <Text style={styles.modalDesc}>투약 알람 시간을 직접 설정합니다</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.timeInput}
                value={editHour}
                onChangeText={setEditHour}
                placeholder="시"
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={COLORS.textMuted}
              />
              <Text style={styles.timeColon}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={editMin}
                onChangeText={setEditMin}
                placeholder="분"
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn}
                onPress={() => setEditingId(null)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn}
                onPress={saveTimeEdit}>
                <Text style={styles.modalSaveText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── 투약 카드 컴포넌트 ──
function MedCard({
  item, isDone, onDone, onEditTime,
}: {
  item: MedicationRow;
  isDone?: boolean;
  onDone?: () => void;
  onEditTime?: () => void;
}) {
  const timeDisplay = item.parsed_time || item.original_time || '시간 미정';
  const isManual = item.is_manual_edited === 1;
  const displayDate = item.date_medicated.replace(/-/g, '.');

  return (
    <View style={[styles.medCard, isDone && styles.medCardDone]}>
      <View style={styles.medCardTop}>
        <View style={styles.medChildBadge}>
          <Text style={styles.medChildEmoji}>👶</Text>
          <Text style={styles.medChildName}>{item.child_name}</Text>
          <Text style={styles.medDateText}>({displayDate})</Text>
        </View>
        <TouchableOpacity onPress={onEditTime} disabled={isDone}
          style={styles.timeBadge}>
          <Text style={[styles.timeText, isDone && styles.timeTextDone]}>
            {timeDisplay}{isManual ? ' ✏️' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.medGrid}>
        <View style={styles.medGridItem}>
          <Text style={styles.medLabel}>🧪 증상</Text>
          <Text style={styles.medValue}>{item.symptoms || '-'}</Text>
        </View>
        <View style={styles.medGridItem}>
          <Text style={styles.medLabel}>💊 약 종류</Text>
          <Text style={styles.medValue}>{item.medicine_type}</Text>
        </View>
      </View>

      <View style={styles.medGrid}>
        <View style={styles.medGridItem}>
          <Text style={styles.medLabel}>📏 용량</Text>
          <Text style={[styles.medValue, { color: COLORS.primary, fontWeight: '800' }]}>{item.dosage}</Text>
        </View>
        <View style={styles.medGridItem}>
          <Text style={styles.medLabel}>❄️ 보관법</Text>
          <Text style={[styles.medValue, { color: '#2E8B57', fontWeight: '800' }]}>{item.storage_method || '-'}</Text>
        </View>
      </View>

      <View style={styles.medGrid}>
        <View style={styles.medGridItem}>
          <Text style={styles.medLabel}>🔢 횟수</Text>
          <Text style={styles.medValue}>{item.dose_count != null ? `${item.dose_count}회` : '-'}</Text>
        </View>
        <View style={styles.medGridItem} />
      </View>

      {item.special_note ? (
        <View style={styles.medNoteBox}>
          <Text style={styles.medLabel}>📝 특이사항</Text>
          <Text style={styles.medValue}>{item.special_note}</Text>
        </View>
      ) : null}

      {!isDone && onDone && (
        <TouchableOpacity style={styles.doneBtn} onPress={onDone}
          activeOpacity={0.7}>
          <Text style={styles.doneBtnText}>✅ 투약 완료</Text>
        </TouchableOpacity>
      )}
      {isDone && (
        <View style={styles.doneStamp}>
          <Text style={styles.doneStampText}>
            완료 {item.done_at ? new Date(item.done_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  syncIconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  scroll: { flex: 1 },
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },
  section: { paddingHorizontal: 12, paddingTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, marginLeft: 4 },
  medCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW.small,
  },
  medCardDone: { opacity: 0.6 },
  medCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  medChildBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  medChildEmoji: { fontSize: 14, marginRight: 4 },
  medChildName: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  medDateText: { fontSize: 11, color: COLORS.textLight, marginLeft: 4 },
  timeBadge: { backgroundColor: COLORS.accentBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.accent },
  timeText: { fontSize: 13, fontWeight: '700', color: '#B8860B' },
  timeTextDone: { color: COLORS.textMuted },
  medGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  medGridItem: { flex: 1, backgroundColor: '#F9F9F9', padding: 8, borderRadius: RADIUS.md },
  medLabel: { fontSize: 11, color: COLORS.textLight, marginBottom: 2 },
  medValue: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  medNoteBox: { backgroundColor: '#FFF9C4', padding: 10, borderRadius: RADIUS.md, marginTop: 4 },
  doneBtn: { marginTop: 12, backgroundColor: COLORS.secondary, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  doneBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  doneStamp: { marginTop: 8, alignItems: 'center' },
  doneStampText: { fontSize: 12, fontWeight: '600', color: COLORS.success },
  syncStatusBanner: { backgroundColor: COLORS.white, margin: 12, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  syncStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncSummaryText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  logToggleBtn: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  logCard: { backgroundColor: '#2D2D2D', borderRadius: RADIUS.sm, marginTop: 10, padding: 10 },
  logLine: { fontSize: 10, color: '#E0E0E0', lineHeight: 16, fontFamily: 'monospace' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 24, width: '80%', ...SHADOW.medium },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  modalDesc: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  timeInput: { backgroundColor: COLORS.background, borderRadius: 12, width: 64, height: 52, textAlign: 'center', fontSize: 22, fontWeight: '800', color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  timeColon: { fontSize: 24, fontWeight: '800', marginHorizontal: 8, color: COLORS.text },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.background, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.textLight },
  modalSaveBtn: { flex: 1, padding: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  modalSaveText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
});
