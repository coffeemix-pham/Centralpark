import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchStudentsFromGAS } from '../../src/api/gasApi';
import { loadTeacherProfile } from '../../src/store/teacherStore';
import { dbOperations } from '../../src/db/database';
import { COLORS, RADIUS, SHADOW } from '../../src/constants/theme';

interface Student { id: string; name: string; classId: string; gender?: string; memo?: string; }
interface ClassInfo { id: string; name: string; }

export default function MemoScreen() {
  const [studentData, setStudentData] = useState<Record<string, Student[]>>({});
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [memoText, setMemoText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [res, profile, allMemos] = await Promise.all([
          fetchStudentsFromGAS(), loadTeacherProfile(), dbOperations.getAllMemos()
        ]);
        // 로컬 메모를 studentData에 병합
        const memoMap: Record<string, string> = {};
        allMemos.forEach(m => { memoMap[m.studentId] = m.memoText; });

        const students: Record<string, Student[]> = res?.students || {};
        for (const classId in students) {
          students[classId] = students[classId].map(s => ({
            ...s,
            memo: memoMap[s.id] ?? s.memo ?? '',
          }));
        }
        setStudentData(students);
        const cls: ClassInfo[] = res?.classes || [];
        setClasses(cls);
        // 담당반 자동 선택
        if (profile.classId !== 'ALL') {
          const myClass = cls.find(c => c.id === profile.classId);
          if (myClass) setSelectedClass(myClass);
          else if (cls.length > 0) setSelectedClass(cls[0]);
        } else if (cls.length > 0) {
          setSelectedClass(cls[0]);
        }
      } catch {
        Alert.alert('연결 오류', '원아 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSelectStudent = async (student: Student) => {
    setSelected(student);
    setSavedAt(null);
    // SQLite에서 메모 로드
    const localMemo = await dbOperations.getMemo(student.id);
    setMemoText(localMemo?.memoText ?? student.memo ?? '');
  };

  // 디바운스 자동 저장 (500ms)
  const onChangeText = (text: string) => {
    setMemoText(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(text), 500);
  };

  const autoSave = useCallback(async (text: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      await dbOperations.saveMemo(selected.id, text);
      const now = new Date();
      setSavedAt(`${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} 저장됨`);
      // 로컬 캐시 업데이트
      setStudentData(prev => {
        const classStudents = [...(prev[selected.classId] || [])];
        const idx = classStudents.findIndex(s => s.id === selected.id);
        if (idx !== -1) classStudents[idx] = { ...classStudents[idx], memo: text };
        return { ...prev, [selected.classId]: classStudents };
      });
    } catch (err) {
      console.warn("Memo save error:", err);
      setSavedAt(`⚠️ 저장 실패`);
    } finally {
      setSaving(false);
    }
  }, [selected]);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={COLORS.primary} size="large" />
      <Text style={styles.loadingText}>원아 정보 불러오는 중...</Text>
    </View>
  );

  const currentStudents = selectedClass ? (studentData[selectedClass.id] || []) : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📒 원아 수첩</Text>
        {/* 반 선택 탭 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classTabs}>
          {classes.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.classTab, selectedClass?.id === c.id && styles.classTabActive]}
              onPress={() => { setSelectedClass(c); setSelected(null); }}
            >
              <Text style={[styles.classTabText, selectedClass?.id === c.id && styles.classTabTextActive]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.body}>
        {/* 왼쪽: 학생 목록 */}
        <View style={styles.listPanel}>
          <FlatList
            data={currentStudents}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyListText}>원아{'\n'}없음</Text>
            }
            renderItem={({ item }) => {
              const isSelected = selected?.id === item.id;
              const hasMemo = (item.memo ?? '').length > 0;
              return (
                <TouchableOpacity
                  style={[styles.studentItem, isSelected && styles.studentItemSelected]}
                  onPress={() => handleSelectStudent(item)} activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: item.gender === '여' ? '#FFB3B3' : '#B3D4FF' }]}>
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                  </View>
                  <Text style={[styles.studentName, isSelected && styles.studentNameSelected]}>
                    {item.name}
                  </Text>
                  {hasMemo && <Text style={styles.memoDot}>●</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* 오른쪽: 메모 영역 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.memoPanel}
        >
          {selected ? (
            <View style={styles.memoBox}>
              {/* 선택 학생 정보 */}
              <View style={styles.memoHeader}>
                <View style={[styles.avatarLg, { backgroundColor: selected.gender === '여' ? '#FFB3B3' : '#B3D4FF' }]}>
                  <Text style={styles.avatarLgText}>{selected.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memoStudentName}>{selected.name} 어린이</Text>
                  <Text style={styles.memoStudentSub}>{selected.classId}</Text>
                </View>
                {saving
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : savedAt
                    ? <Text style={styles.savedAt}>{savedAt}</Text>
                    : null
                }
              </View>

              {/* 메모 입력 */}
              <TextInput
                style={styles.textInput}
                multiline
                placeholder={`${selected.name} 어린이의 오늘 하루를 기록해 주세요.\n\n예) 점심을 잘 먹었어요 🍱\n     낮잠을 30분 잤어요 😴\n     활동에 적극적으로 참여했어요 🎨`}
                placeholderTextColor={COLORS.textMuted}
                value={memoText}
                onChangeText={onChangeText}
                textAlignVertical="top"
              />

              <Text style={styles.memoFooter}>💾 입력 후 0.5초 뒤 자동 저장</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👈</Text>
              <Text style={styles.emptyText}>왼쪽에서 원아를{'\n'}선택해 주세요</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: COLORS.textLight },
  header: {
    backgroundColor: COLORS.white,
    paddingTop: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.primary, marginBottom: 8 },
  classTabs: { flexDirection: 'row', marginBottom: 10 },
  classTab: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginRight: 8,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  classTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classTabText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  classTabTextActive: { color: COLORS.white },
  body: { flex: 1, flexDirection: 'row' },
  // 학생 목록
  listPanel: {
    width: 85, backgroundColor: COLORS.white,
    borderRightWidth: 1, borderRightColor: COLORS.border, paddingTop: 8,
  },
  studentItem: {
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: RADIUS.md, marginHorizontal: 6, marginBottom: 4,
  },
  studentItemSelected: { backgroundColor: COLORS.primaryBg },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  avatarText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  studentName: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, textAlign: 'center' },
  studentNameSelected: { color: COLORS.primary, fontWeight: '800' },
  memoDot: { fontSize: 8, color: COLORS.secondary, marginTop: 2 },
  emptyListText: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', padding: 10 },
  // 메모 영역
  memoPanel: { flex: 1, backgroundColor: COLORS.background },
  memoBox: { flex: 1, padding: 10 },
  memoHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: 12, marginBottom: 8, gap: 10, ...SHADOW.small,
  },
  avatarLg: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarLgText: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  memoStudentName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  memoStudentSub: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  savedAt: { fontSize: 10, color: COLORS.secondary },
  textInput: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: 14, fontSize: 14, color: COLORS.text, lineHeight: 22,
    ...SHADOW.small, marginBottom: 6,
  },
  memoFooter: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', paddingBottom: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 },
});
