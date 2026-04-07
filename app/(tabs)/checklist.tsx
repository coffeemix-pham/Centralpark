import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Modal,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchStudentsFromGAS, fetchChecklistsFromGAS,
  saveChecklistToGAS, hideChecklistFromGAS,
} from '../../src/api/gasApi';
import { loadTeacherProfile } from '../../src/store/teacherStore';
import { COLORS, RADIUS, SHADOW } from '../../src/constants/theme';

interface Student { id: string; name: string; classId: string; gender?: string; }
interface ClassInfo { id: string; name: string; }
interface ChecklistInfo {
  classId: string; title: string; date: string;
  items: string[]; dataMap: Record<string, boolean>;
}

const CHECK_EMOJIS: Record<string, string> = {
  '식사': '🍱', '수면': '😴', '투약': '💊', '배변': '🚽', '체온': '🌡️',
  '등원': '👟', '하원': '🏠', '낮잠': '😪', '간식': '🍎', '활동': '🎨',
};

export default function ChecklistScreen() {
  const [studentData, setStudentData] = useState<Record<string, Student[]>>({});
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [checklists, setChecklists] = useState<ChecklistInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkState, setCheckState] = useState<Record<string, boolean>>({});

  // 새 체크리스트 생성 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newItems, setNewItems] = useState(['', '', '']);

  // 현재 보고 있는 체크리스트
  const [activeChecklist, setActiveChecklist] = useState<ChecklistInfo | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [studentsRes, checklistsRes, profile] = await Promise.all([
        fetchStudentsFromGAS(), fetchChecklistsFromGAS(), loadTeacherProfile()
      ]);
      setStudentData(studentsRes?.students || {});
      const cls: ClassInfo[] = studentsRes?.classes || [];
      setClasses(cls);

      // 담당반 자동 설정
      if (profile.classId !== 'ALL') {
        setSelectedClassId(profile.classId);
      } else if (cls.length > 0) {
        setSelectedClassId(cls[0].id);
      }

      const cl: ChecklistInfo[] = checklistsRes || [];
      // 담당반 필터링
      const filtered = profile.classId === 'ALL' ? cl : cl.filter(c => c.classId === profile.classId);
      setChecklists(filtered);
      const state: Record<string, boolean> = {};
      cl.forEach(c => { Object.assign(state, c.dataMap || {}); });
      setCheckState(state);
    } catch (e) {
      Alert.alert('연결 오류', 'GAS 서버에 연결할 수 없습니다.\n인터넷 연결을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (cl: ChecklistInfo, sId: string, item: string) => {
    const key = `${sId}_${item}`;
    const newVal = !checkState[key];
    setCheckState(prev => ({ ...prev, [key]: newVal }));
    try {
      await saveChecklistToGAS(cl.date + '|' + cl.classId, sId, item, newVal, cl.title);
    } catch (err) {
      console.warn("Checklist save error:", err);
      // 저장 실패 시 상태 롤백
      setCheckState(prev => ({ ...prev, [key]: !newVal }));
      Alert.alert('알림', '인터넷 연결이 불안정하여 체크 상태를 저장할 수 없습니다.');
    }
  };

  const handleCreate = async () => {
    const items = newItems.filter(i => i.trim() !== '');
    if (!selectedClassId) return Alert.alert('알림', '반을 선택해 주세요.');
    if (!newTitle.trim()) return Alert.alert('알림', '제목을 입력해 주세요.');
    if (items.length === 0) return Alert.alert('알림', '항목을 1개 이상 입력해 주세요.');

    // 로컬 즉시 추가
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;
    const newCl: ChecklistInfo = {
      classId: selectedClassId, title: newTitle.trim(),
      date: dateStr, items, dataMap: {},
    };
    setChecklists(prev => [newCl, ...prev]);
    setShowCreateModal(false);
    setNewTitle(''); setNewItems(['', '', '']); setSelectedClassId('');
    // GAS에는 첫 체크 시 자동 저장됨 (saveChecklistData 호출 시 생성)
  };

  const handleHide = (cl: ChecklistInfo) => {
    Alert.alert('완료 처리', `"${cl.title}" 체크리스트를 완료 처리할까요?\n모든 교사 화면에서 사라집니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '완료', style: 'destructive', onPress: async () => {
          const key = `${cl.date}|${cl.classId}|${cl.title}`;
          setChecklists(prev => prev.filter(c => !(c.date === cl.date && c.classId === cl.classId && c.title === cl.title)));
          if (activeChecklist?.title === cl.title) setActiveChecklist(null);
          try { await hideChecklistFromGAS(key); } catch { /* ignore */ }
        }
      }
    ]);
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={COLORS.secondary} size="large" />
      <Text style={styles.loadingText}>구글 스프레드시트 연결 중...</Text>
    </View>
  );

  // 매트릭스 뷰
  if (activeChecklist) {
    const students = studentData[activeChecklist.classId] || [];
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setActiveChecklist(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 목록</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{activeChecklist.title}</Text>
          <TouchableOpacity onPress={() => handleHide(activeChecklist)}>
            <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 13 }}>완료처리</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          <View>
            {/* 헤더 행 */}
            <View style={styles.matrixHeaderRow}>
              <View style={styles.matrixNameCell}>
                <Text style={styles.matrixHeaderText}>이름</Text>
              </View>
              {activeChecklist.items.map(item => (
                <View key={item} style={styles.matrixItemCell}>
                  <Text style={styles.matrixItemEmoji}>{CHECK_EMOJIS[item] || '📋'}</Text>
                  <Text style={styles.matrixHeaderText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* 데이터 행 */}
            <FlatList
              data={students}
              keyExtractor={s => s.id}
              scrollEnabled={false}
              renderItem={({ item: student, index }) => (
                <View style={[styles.matrixDataRow, index % 2 === 0 && styles.matrixDataRowAlt]}>
                  <View style={styles.matrixNameCell}>
                    <View style={[styles.avatar, { backgroundColor: student.gender === '여' ? '#FFB3B3' : '#B3D4FF' }]}>
                      <Text style={styles.avatarText}>{student.name[0]}</Text>
                    </View>
                    <Text style={styles.studentName}>{student.name}</Text>
                  </View>
                  {activeChecklist.items.map(item => {
                    const key = `${student.id}_${item}`;
                    const checked = checkState[key] || false;
                    return (
                      <TouchableOpacity
                        key={item} style={styles.matrixCheckCell}
                        onPress={() => handleToggle(activeChecklist, student.id, item)}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.checkCircle, checked && styles.checkCircleOn]}>
                          <Text style={[styles.checkMark, checked && styles.checkMarkOn]}>
                            {checked ? 'O' : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          </View>
        </ScrollView>
        <Text style={styles.footer}>* 터치 즉시 구글 스프레드시트에 저장됩니다</Text>
      </SafeAreaView>
    );
  }

  // 목록 뷰
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✅ 스마트 체크리스트</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.addBtnText}>+ 새로 만들기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {checklists.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
            <Text style={styles.emptyText}>진행 중인 체크리스트가 없습니다.{'\n'}오른쪽 상단에서 새로 만들어 보세요!</Text>
          </View>
        ) : (
          checklists.map((cl, idx) => {
            const className = classes.find(c => c.id === cl.classId)?.name || cl.classId;
            return (
              <TouchableOpacity
                key={idx} style={styles.clCard}
                onPress={() => setActiveChecklist(cl)} activeOpacity={0.7}
              >
                <View style={styles.clCardLeft}>
                  <Text style={styles.clTitle}>{cl.title}</Text>
                  <Text style={styles.clSub}>{cl.date} · {className}</Text>
                  <Text style={styles.clItems}>{cl.items.join(' / ')}</Text>
                </View>
                <TouchableOpacity onPress={() => handleHide(cl)} style={styles.clDelete}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 새 체크리스트 생성 모달 */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>✏️ 새 체크리스트 만들기</Text>

            {/* 반 선택 */}
            <Text style={styles.inputLabel}>반 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.classPill, selectedClassId === c.id && styles.classPillActive]}
                  onPress={() => setSelectedClassId(c.id)}
                >
                  <Text style={[styles.classPillText, selectedClassId === c.id && styles.classPillTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 제목 */}
            <Text style={styles.inputLabel}>제목</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 오전 간식 체크"
              value={newTitle}
              onChangeText={setNewTitle}
              placeholderTextColor={COLORS.textMuted}
            />

            {/* 항목 */}
            <Text style={styles.inputLabel}>항목 (빈 칸은 자동 제외)</Text>
            {newItems.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 6 }]}
                  placeholder={`항목 ${idx + 1} (예: 식사, 수면...)`}
                  value={item}
                  onChangeText={val => setNewItems(prev => { const n = [...prev]; n[idx] = val; return n; })}
                  placeholderTextColor={COLORS.textMuted}
                />
                {newItems.length > 1 && (
                  <TouchableOpacity onPress={() => setNewItems(prev => prev.filter((_, i) => i !== idx))} style={{ paddingLeft: 8 }}>
                    <Text style={{ color: COLORS.danger, fontSize: 20 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={() => setNewItems(prev => [...prev, ''])} style={styles.addItemBtn}>
              <Text style={styles.addItemBtnText}>+ 항목 추가</Text>
            </TouchableOpacity>

            {/* 버튼 */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>표 생성</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 60 },
  loadingText: { fontSize: 13, color: COLORS.textLight, marginTop: 10 },
  header: {
    backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, flex: 1, marginHorizontal: 8 },
  addBtn: { backgroundColor: COLORS.secondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  backBtn: { paddingRight: 8 },
  backBtnText: { fontSize: 14, color: COLORS.secondary, fontWeight: '700' },
  // 목록
  clCard: {
    backgroundColor: COLORS.white, margin: 12, marginBottom: 0,
    borderRadius: RADIUS.md, padding: 14, ...SHADOW.small,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center',
  },
  clCardLeft: { flex: 1 },
  clTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  clSub: { fontSize: 11, color: COLORS.textLight, marginBottom: 4 },
  clItems: { fontSize: 12, color: COLORS.secondary },
  clDelete: { padding: 8 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 },
  // 매트릭스
  matrixHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.secondaryBg, borderBottomWidth: 2, borderBottomColor: COLORS.secondaryLight, paddingVertical: 10 },
  matrixNameCell: { width: 100, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  matrixItemCell: { width: 65, alignItems: 'center', justifyContent: 'center' },
  matrixHeaderText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
  matrixItemEmoji: { fontSize: 16, marginBottom: 2 },
  matrixDataRow: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#FFF0F0' },
  matrixDataRowAlt: { backgroundColor: '#FFFDFD' },
  matrixCheckCell: { width: 65, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  studentName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  checkCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F8F8' },
  checkCircleOn: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  checkMark: { fontSize: 14, fontWeight: '900', color: 'transparent' },
  checkMarkOn: { color: COLORS.white },
  footer: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 10, backgroundColor: COLORS.white },
  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 16, textAlign: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginBottom: 6 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  addItemBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLORS.secondaryBg, borderRadius: 20, marginBottom: 16 },
  addItemBtnText: { fontSize: 13, color: COLORS.secondary, fontWeight: '700' },
  classPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginRight: 8, backgroundColor: COLORS.white },
  classPillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  classPillText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  classPillTextActive: { color: COLORS.white },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, backgroundColor: '#F0F0F0', borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textLight },
  createBtn: { flex: 1, padding: 14, backgroundColor: COLORS.secondary, borderRadius: 12, alignItems: 'center' },
  createBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
