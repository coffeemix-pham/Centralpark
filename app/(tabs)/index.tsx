import React, { useEffect, useState } from 'react';
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

interface CalendarEvent {
  dateStr: string;  // "04/03(금)"
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
            <Text style={styles.cardTitle}>이번 주 주요 일정</Text>
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
});
