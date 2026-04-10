import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchStudentsFromGAS } from '../../src/api/gasApi';
import {
  saveTeacherProfile, loadTeacherProfile, TeacherProfile,
} from '../../src/store/teacherStore';
import { syncStudents, syncCalendar } from '../../src/services/DataSync';
import { COLORS, RADIUS, SHADOW } from '../../src/constants/theme';

interface ClassInfo { id: string; name: string; }

export default function SettingsScreen() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeacherProfile>({
    classId: 'ALL', className: '전체 반', teacherName: '',
  });
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // 저장된 프로필 불러오기
    loadTeacherProfile().then(setProfile);
    // GAS에서 반 목록 불러오기
    fetchStudentsFromGAS()
      .then(res => setClasses(res?.classes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await saveTeacherProfile(profile);
    setSaved(true);
    Alert.alert('✅ 저장 완료', `담당반이 "${profile.className}"으로 설정되었습니다.\n체크리스트와 원아수첩이 해당 반으로 고정됩니다.`);
    setTimeout(() => setSaved(false), 2000);
  };

  const selectClass = (classId: string, className: string) => {
    setProfile(prev => ({ ...prev, classId, className }));
  };

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      await Promise.all([syncStudents(), syncCalendar()]);
      Alert.alert('✅ 동기화 완료', '최신 데이터를 성공적으로 가져왔습니다.');
    } catch (err) {
      Alert.alert('❌ 동기화 실패', '네트워크 연결을 확인해 주세요.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚙️ 설정</Text>
        <Text style={styles.headerSub}>센트럴파크 어린이집</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* 선생님 이름 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleEmoji}>👩‍🏫</Text>
            <Text style={styles.cardTitle}>선생님 이름</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="이름을 입력해 주세요 (예: 김민지)"
            value={profile.teacherName}
            onChangeText={val => setProfile(prev => ({ ...prev, teacherName: val }))}
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* 담당 반 선택 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleEmoji}>🏫</Text>
            <Text style={styles.cardTitle}>내 담당 반 선택</Text>
          </View>
          <Text style={styles.cardDesc}>
            선택한 반의 원아만 체크리스트·원아수첩에 표시됩니다.
          </Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.classGrid}>
              {/* 전체 반 보기 옵션 */}
              <TouchableOpacity
                style={[
                  styles.classBtn,
                  profile.classId === 'ALL' && styles.classBtnActive,
                ]}
                onPress={() => selectClass('ALL', '전체 반')}
                activeOpacity={0.7}
              >
                <Text style={styles.classBtnEmoji}>🏛️</Text>
                <Text style={[
                  styles.classBtnText,
                  profile.classId === 'ALL' && styles.classBtnTextActive,
                ]}>
                  전체 반{'\n'}(원장/투담임)
                </Text>
                {profile.classId === 'ALL' && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </TouchableOpacity>

              {/* 각 반 버튼 */}
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.classBtn,
                    profile.classId === c.id && styles.classBtnActive,
                  ]}
                  onPress={() => selectClass(c.id, c.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.classBtnEmoji}>🌸</Text>
                  <Text style={[
                    styles.classBtnText,
                    profile.classId === c.id && styles.classBtnTextActive,
                  ]}>
                    {c.name}
                  </Text>
                  {profile.classId === c.id && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 현재 선택 표시 */}
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>
              현재 설정: {profile.className}
              {profile.teacherName ? ` (${profile.teacherName} 선생님)` : ''}
            </Text>
          </View>
        </View>

        {/* 앱 정보 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleEmoji}>ℹ️</Text>
            <Text style={styles.cardTitle}>앱 정보</Text>
          </View>
          <Text style={styles.infoText}>🌸 센트럴파크 어린이집 스마트 알림장</Text>
          <Text style={styles.infoText}>📱 버전 2.0.0</Text>
          <Text style={styles.infoText}>Cloud Google Calendar · Spreadsheet Integration</Text>
          <Text style={styles.infoText}>🌤️ Open-Meteo 실시간 날씨 (환경부 기준)</Text>
        </View>

        {/* 데이터 동기화 관리 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleEmoji}>🔄</Text>
            <Text style={styles.cardTitle}>데이터 관리</Text>
          </View>
          <Text style={styles.cardDesc}>
            스프레드시트 정보를 즉시 업데이트하려면 아래 버튼을 눌러주세요.
          </Text>
          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
            onPress={handleSyncData}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.syncBtnText}>지금 동기화하기</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 저장 버튼 (하단 고정) */}
      <View style={styles.saveArea}>
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text style={styles.saveBtnText}>
            {saved ? '✅ 저장되었습니다!' : '💾 설정 저장하기'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  scroll: { flex: 1, paddingTop: 4 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, margin: 12, marginTop: 10,
    padding: 16, ...SHADOW.small,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitleEmoji: { fontSize: 16, marginRight: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: 12, color: COLORS.textLight, marginBottom: 14, lineHeight: 18 },
  input: {
    backgroundColor: COLORS.background, borderRadius: 12,
    padding: 12, fontSize: 15, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  // 반 선택 그리드
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  classBtn: {
    minWidth: '45%', flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md, padding: 14,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border,
    position: 'relative',
  },
  classBtnActive: {
    backgroundColor: COLORS.primaryBg,
    borderColor: COLORS.primary,
  },
  classBtnEmoji: { fontSize: 24, marginBottom: 6 },
  classBtnText: {
    fontSize: 13, fontWeight: '600', color: COLORS.textLight,
    textAlign: 'center', lineHeight: 18,
  },
  classBtnTextActive: { color: COLORS.primary, fontWeight: '800' },
  checkMark: {
    position: 'absolute', top: 6, right: 8,
    fontSize: 14, color: COLORS.primary, fontWeight: '900',
  },
  selectedBadge: {
    backgroundColor: COLORS.primaryBg, borderRadius: 10,
    padding: 10, alignItems: 'center',
  },
  selectedBadgeText: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  // 앱 정보
  infoText: { fontSize: 13, color: COLORS.textLight, marginBottom: 6, lineHeight: 20 },
  // 저장 버튼
  saveArea: {
    backgroundColor: COLORS.white, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center',
  },
  saveBtnDone: { backgroundColor: COLORS.secondary },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  // 동기화 버튼
  syncBtn: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  syncBtnDisabled: {
    borderColor: COLORS.border,
  },
  syncBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
