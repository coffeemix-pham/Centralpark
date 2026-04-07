import React from 'react';
import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { Appbar, IconButton } from 'react-native-paper';
import { WeatherWidget } from '../src/components/WeatherWidget';
import { BirthdayBanner } from '../src/components/BirthdayBanner';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Appbar.Header elevated mode="center-aligned" style={{ backgroundColor: '#fff' }}>
        <Appbar.Content title="센트럴파크 알림장" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="bell-outline" onPress={() => {}} />
      </Appbar.Header>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 생일 알림 (오늘 생일인 경우에만 표시됨) */}
        <BirthdayBanner />

        {/* 날씨 및 미세먼지 위젯 (환경부 기준 색상 적용) */}
        <WeatherWidget />

        {/* 주간 일정 요약 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 주간 일정</Text>
          <View style={styles.schedulePlaceholder}>
            <Text style={styles.placeholderText}>- 04/05 (월): 현장 체험 학습</Text>
            <Text style={styles.placeholderText}>- 04/07 (수): 소방 대피 훈련</Text>
            <Text style={styles.placeholderText}>- 04/09 (금): 인형극 관람</Text>
          </View>
        </View>

        {/* 바로가기 섹션 */}
        <View style={styles.quickActions}>
           <Text style={styles.sectionTitle}>퀵 메뉴</Text>
           <View style={styles.actionRow}>
              <View style={styles.actionItem}>
                 <IconButton icon="clipboard-list-outline" size={40} mode="contained" containerColor="#e8f5e9" iconColor="#2e7d32" />
                 <Text style={styles.actionLabel}>체크리스트</Text>
              </View>
              <View style={styles.actionItem}>
                 <IconButton icon="note-edit-outline" size={40} mode="contained" containerColor="#e3f2fd" iconColor="#1565c0" />
                 <Text style={styles.actionLabel}>원아수첩</Text>
              </View>
              <View style={styles.actionItem}>
                 <IconButton icon="calendar-month-outline" size={40} mode="contained" containerColor="#fff3e0" iconColor="#ef6c00" />
                 <Text style={styles.actionLabel}>일정표</Text>
              </View>
           </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontWeight: '900',
    fontSize: 20,
    color: '#000',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    margin: 10,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  schedulePlaceholder: {
    marginVertical: 5,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 4,
  },
  quickActions: {
    margin: 10,
    padding: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionLabel: {
    marginTop: 5,
    fontSize: 12,
    color: '#444',
  }
});
