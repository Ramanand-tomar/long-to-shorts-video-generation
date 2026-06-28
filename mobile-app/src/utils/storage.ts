import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  serverUrl: string;
  userId: string;
  gdriveToken: string;
  gdriveFolderId: string;
  cobaltUrl: string;
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
      const parsed = JSON.parse(raw);
      // Ensure cobaltUrl is returned even if not saved previously
      if (!parsed.cobaltUrl) {
        parsed.cobaltUrl = 'https://api.cobalt.tools';
      }
      return parsed;
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
    cobaltUrl: 'https://api.cobalt.tools',
  };
}
