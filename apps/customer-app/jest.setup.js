/* eslint-disable */
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    getItemAsync: jest.fn(async (k) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
    isAvailableAsync: jest.fn(async () => true),
  };
});

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(async () => [1, 2]),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'https://api.test',
        wsUrl: 'https://api.test',
        whatsappNumber: '+910000000000',
        supportPhone: '+910000000000',
        supportEmail: 'care@test',
      },
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    setItem: jest.fn(async (k, v) => void store.set(k, v)),
    getItem: jest.fn(async (k) => store.get(k) ?? null),
    removeItem: jest.fn(async (k) => void store.delete(k)),
    clear: jest.fn(async () => void store.clear()),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
    multiGet: jest.fn(async (keys) => keys.map((k) => [k, store.get(k) ?? null])),
    multiRemove: jest.fn(async (keys) => keys.forEach((k) => store.delete(k))),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => undefined),
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

global.__DEV__ = true;
