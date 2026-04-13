import { Tabs } from 'expo-router';
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../../src/constants/theme';

// 탭 아이콘 + 라벨 (이모지 + 텍스트 모두 표시)
function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false, // 커스텀 라벨 사용
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="홈" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="checklist"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="✅" label="체크리스트" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="memo"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📒" label="원아수첩" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="medication"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💊" label="투약" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📅" label="일정표" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" label="설정" focused={focused} />
          ),
        }}
      />
      {/* 숨길 탭 */}
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#FFE4E4',
    height: 72,          // 이모지 + 텍스트를 위해 높이 증가
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 56,
  },
  tabIconWrapFocused: {
    backgroundColor: COLORS.primaryBg,
  },
  tabEmoji: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.5,
  },
  tabEmojiFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  tabLabelFocused: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});
