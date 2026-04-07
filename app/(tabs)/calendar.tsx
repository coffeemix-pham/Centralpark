import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Appbar, List, Text, Divider } from 'react-native-paper';
import { fetchCalendarFromGAS } from '../../src/api/gasApi';
import { getEmojiForEvent } from '../../src/utils/emojiMapper';
import { COLORS, RADIUS } from '../../src/constants/theme';

interface CalendarEvent {
  date: string;       // YYYY-MM-DD
  month: string;      // "04월"
  day: string;        // "05"
  dayName: string;    // "일"
  title: string;
  startTime: string;  // "10:00"
  desc?: string;
}

export default function CalendarScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalendar();
  }, []);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarFromGAS();
      // GAS 응답: { widget: [...], list: [...] }
      setEvents(data?.list || []);
    } catch (error) {
      console.error('Calendar Load Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated mode="center-aligned" style={{ backgroundColor: '#fff' }}>
        <Appbar.Content title="어린이집 전체 일정" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="refresh" onPress={loadCalendar} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingText}>일정표 불러오는 중...</Text>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyText}>등록된 일정이 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <List.Item
              title={item.title}
              titleStyle={styles.eventTitle}
              description={`${item.month} ${item.day}일(${item.dayName}) | ${item.startTime}\n${item.desc || ''}`}
              descriptionStyle={styles.eventDesc}
              descriptionNumberOfLines={3}
              left={() => (
                <View style={styles.dateIconArea}>
                  <View style={styles.emojiCircle}>
                    <Text style={styles.emojiText}>{getEmojiForEvent(item.title)}</Text>
                  </View>
                </View>
              )}
              style={styles.listItem}
            />
          )}
          ItemSeparatorComponent={Divider}
        />
      )}
      <Text style={styles.footerText}>* 구글 캘린더의 최신 데이터를 실시간으로 가져옵니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#E05A5A',
  },
  listContainer: {
    paddingBottom: 20,
  },
  listItem: {
    paddingVertical: 12,
  },
  dateIconArea: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  eventDesc: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
    lineHeight: 18,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textLight,
  },
  footerText: {
    fontSize: 11,
    color: '#999',
    padding: 15,
    textAlign: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  }
});
