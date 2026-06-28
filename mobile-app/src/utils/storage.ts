import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  serverUrl: string;
  userId: string;
  gdriveToken: string;
  gdriveFolderId: string;
}

const SETTINGS_KEY = '@youtube_pipeline_settings';

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('Failed to get settings:', error);
  }

  // Return defaults
  return {
    serverUrl: 'https://long-to-shorts-video-generation.vercel.app',
    userId: '',
    gdriveToken: '',
    gdriveFolderId: '',
  };
}
