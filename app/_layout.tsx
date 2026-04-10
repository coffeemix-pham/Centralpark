import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Provider as PaperProvider, MD3LightTheme as PaperDefaultTheme } from 'react-native-paper';
import { useState, useEffect } from 'react';
import { initDatabase } from '../src/db/database';
import { kickoffBackgroundSync } from '../src/services/DataSync';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [dbLoaded, setDbLoaded] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // DB 초기화 → 스플래시 숨김 → 백그라운드 동기화 시작
      initDatabase().then(() => {
        setDbLoaded(true);
        SplashScreen.hideAsync();
        // 스플래시 직후 백그라운드에서 GAS 동기화 시작 (UI 블록 X)
        kickoffBackgroundSync();
      }).catch((e) => {
        console.error('Database initialization failed:', e);
        // 에러가 나더라도 앱은 띄우도록 처리 (이미 로드된 데이터 사용 혹은 에러 대응)
        setDbLoaded(true);
      });
    }
  }, [loaded]);

  if (!loaded || !dbLoaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider theme={PaperDefaultTheme}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}
