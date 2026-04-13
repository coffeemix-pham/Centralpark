import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BirthdayBanner } from '../../src/components/BirthdayBanner';
import { WeatherWidget } from '../../src/components/WeatherWidget';
import { getEmojiForEvent } from '../../src/utils/emojiMapper';
import { COLORS, RADIUS, SHADOW } from '../../src/constants/theme';
import {
  CACHE_KEY, readCalendarCache, subscribeCache, syncCalendar,
} from '../../src/services/DataSync';
import { useFocusEffect } from '@react-navigation/native';
import { dbOperations } from '../../src/db/database';
import { loadTeacherProfile } from '../../src/store/teacherStore';

interface CalendarEvent {
  date: string;     // "2026-04-10" (GAS 원본)
  dateStr: string;  // "04/10(금)" (정규화된 문자열)
  title: string;
}

const QUICK_MENUS = [
  { icon: '✅', label: '체크리스트', color: '#5BC8AF', bg: '#F0FAFA', route: '/(tabs)/checklist' },
  { icon: '📒', label: '원아수첩', color: '#FF7F7F', bg: '#FFF0F0', route: '/(tabs)/memo' },
  { icon: '📅', label: '월간일정', color: '#B39DDB', bg: '#F5F0FF', route: '/(tabs)/calendar' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [medSummary, setMedSummary] = useState<{ total: number; pending: number; done: number; upcoming: { child_name: string; parsed_time: string }[] }>({
    total: 0, pending: 0, done: 0, upcoming: []
  });

  // 투약 현황 데이터 로드 (반 필터링 연동)
  const loadMedSummary = useCallback(async () => {
    try {
      const profile = await loadTeacherProfile();
      const summary = await dbOperations.getTodayMedicationSummary(profile.className);
      setMedSummary(summary);
    } catch (e) {
      console.warn('Medication summary load error:', e);
    }
  }, []);

  // 화면이 포커스될 때마다 데이터 갱신
  useFocusEffect(
    useCallback(() => {
      loadMedSummary();
    }, [loadMedSummary])
  );

  useEffect(() => {
    let cancelled = false;

    // 1) 캐시를 즉시 표시
    readCalendarCache().then((cached) => {
      if (cancelled) return;
      if (cached) {
        setEvents(cached.widget || []);
        setCalLoading(false);
      }
      // 2) 백그라운드로 최신 데이터 동기화
      syncCalendar();
    });

    // 3) 캐시 갱신 이벤트 구독 — 새 데이터 도착 시 자동 갱신
    const unsub = subscribeCache(CACHE_KEY.CALENDAR, async () => {
      const latest = await readCalendarCache();
      if (!cancelled && latest) {
        setEvents(latest.widget || []);
        setCalLoading(false);
      }
    });

    // 4) 캐시가 비어 있는 최초 실행에 대비: 일정 시간 후 로딩 종료
    const timer = setTimeout(() => {
      if (!cancelled) setCalLoading(false);
    }, 8000);

    return () => { cancelled = true; unsub(); clearTimeout(timer); };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🌸 센트럴파크 알림장</Text>
        <Text style={styles.headerDate}>{getTodayString()}</Text>
      </View>

      {/* 생일 배너 */}
      <BirthdayBanner />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 날씨 위젯 */}
        <WeatherWidget />

        {/* 이번 주 일정 (구글 캘린더 연동) */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleEmoji}>📅</Text>
            <Text style={styles.cardTitle}>향후 7일간 주요 일정</Text>
          </View>

          {calLoading ? (
            <ActivityIndicator color={COLORS.secondary} style={{ marginVertical: 12 }} />
          ) : events.length === 0 ? (
            <Text style={styles.emptyText}>이번 주 예정된 공식 일정이 없습니다.{'\n'}아이들과 행복한 한 주 보내세요! 🌱</Text>
          ) : (
            events.map((ev, idx) => (
              <View key={idx} style={[styles.scheduleRow, idx === events.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.scheduleEmoji}>{getEmojiForEvent(ev.title)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleDate}>{ev.dateStr}</Text>
                  <Text style={styles.scheduleContent}>{ev.title}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ✨ [NEW] 오늘의 투약 현황 위젯 */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(tabs)/medication')}
          activeOpacity={0.8}
        >
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleEmoji}>💊</Text>
            <Text style={[styles.cardTitle, { color: COLORS.primary }]}>오늘의 투약 현황</Text>
            {medSummary.pending > 0 && <View style={styles.alertDot} />}
          </View>

          <View style={styles.medSummaryRow}>
            <View style={styles.medSummaryBox}>
              <Text style={styles.medSummaryLabel}>전체 의뢰</Text>
              <Text style={styles.medSummaryValue}>{medSummary.total}건</Text>
            </View>
            <View style={styles.medSummaryDivider} />
            <View style={styles.medSummaryBox}>
              <Text style={styles.medSummaryLabel}>대기</Text>
              <Text style={[styles.medSummaryValue, medSummary.pending > 0 && { color: COLORS.danger }]}>
                {medSummary.pending}건
              </Text>
            </View>
            <View style={styles.medSummaryDivider} />
            <View style={styles.medSummaryBox}>
              <Text style={styles.medSummaryLabel}>완료</Text>
              <Text style={[styles.medSummaryValue, { color: COLORS.success }]}>{medSummary.done}건</Text>
            </View>
          </View>

          {medSummary.pending > 0 && medSummary.upcoming.length > 0 && (
            <View style={styles.upcomingMedList}>
              <Text style={styles.upcomingMedTitle}>🔔 곧 투약이 필요해요</Text>
              {medSummary.upcoming.map((u, i) => (
                <View key={i} style={styles.upcomingMedRow}>
                  <Text style={styles.upcomingMedName}>{u.child_name}</Text>
                  <Text style={styles.upcomingMedTime}>{u.parsed_time}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* 퀵 메뉴 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleEmoji}>🚀</Text>
            <Text style={styles.cardTitle}>빠른 메뉴</Text>
          </View>
          <View style={styles.quickMenuRow}>
            {QUICK_MENUS.map((menu, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.quickMenuBtn, { backgroundColor: menu.bg }]}
                onPress={() => router.push(menu.route as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickMenuIcon}>{menu.icon}</Text>
                <Text style={[styles.quickMenuLabel, { color: menu.color }]}>{menu.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getTodayString(): string {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}(${days[now.getDay()]})`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  headerDate: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  scroll: { flex: 1 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, margin: 12, marginTop: 0,
    padding: 16, ...SHADOW.small,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitleEmoji: { fontSize: 16, marginRight: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#E05A5A' },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#FFF0F0',
  },
  scheduleEmoji: { fontSize: 16, marginRight: 8, marginTop: 2 },
  scheduleDate: { fontSize: 13, fontWeight: '700', color: COLORS.primary, width: 90, flexShrink: 0 },
  scheduleContent: { fontSize: 13, color: COLORS.text, flex: 1, lineHeight: 18 },
  emptyText: { fontSize: 13, color: COLORS.textLight, lineHeight: 20, textAlign: 'center', paddingVertical: 8 },
  quickMenuRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  quickMenuBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: RADIUS.md },
  quickMenuIcon: { fontSize: 28, marginBottom: 6 },
  quickMenuLabel: { fontSize: 12, fontWeight: '700' },
  // 투약 위젯 스타일
  alertDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.danger, marginLeft: 6,
  },
  medSummaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F9F9', borderRadius: RADIUS.md,
    paddingVertical: 12, marginBottom: 12,
  },
  medSummaryBox: { flex: 1, alignItems: 'center' },
  medSummaryLabel: { fontSize: 11, color: COLORS.textLight, marginBottom: 2 },
  medSummaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  medSummaryDivider: { width: 1, height: 20, backgroundColor: COLORS.border },
  upcomingMedList: {
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  upcomingMedTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginBottom: 6 },
  upcomingMedRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4, paddingHorizontal: 4,
  },
  upcomingMedName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  upcomingMedTime: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
