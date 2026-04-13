import * as SecureStore from 'expo-secure-store';

const KEY_ID = 'kidsnote_username';
const KEY_PW = 'kidsnote_password';

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface KidsnoteCredentials {
  username: string;
  password: string;
}

export async function saveKidsnoteCredentials(username: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_ID, username, OPTS);
  await SecureStore.setItemAsync(KEY_PW, password, OPTS);
}

export async function loadKidsnoteCredentials(): Promise<KidsnoteCredentials | null> {
  const username = await SecureStore.getItemAsync(KEY_ID);
  const password = await SecureStore.getItemAsync(KEY_PW);
  if (!username || !password) return null;
  return { username, password };
}

export async function clearKidsnoteCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ID);
  await SecureStore.deleteItemAsync(KEY_PW);
}

export async function hasKidsnoteCredentials(): Promise<boolean> {
  const c = await loadKidsnoteCredentials();
  return c !== null;
}
