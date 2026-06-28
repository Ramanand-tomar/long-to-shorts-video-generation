import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSettings, saveSettings, AppSettings } from '@/utils/storage';
import { Link2, UserCheck, CheckCircle2 } from 'lucide-react-native';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [userId, setUserId] = useState('');
  const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getSettings();
      setServerUrl(data.serverUrl);
      setUserId(data.userId);
      setOriginalSettings(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);

    try {
      await saveSettings({
        ...(originalSettings || {}),
        serverUrl: serverUrl.trim(),
        userId: userId.trim(),
      } as AppSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ Connection Settings</Text>
          <Text style={styles.subtitle}>
            Configure your video generator pipeline connection details below.
          </Text>
        </View>

        {success && (
          <View style={styles.successBanner}>
            <CheckCircle2 size={18} color="#34d399" />
            <Text style={styles.successText}>Settings saved successfully!</Text>
          </View>
        )}

        <View style={styles.form}>
          {/* Server URL Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Link2 size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>Pipeline Server URL</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://yourdomain.com"
              placeholderTextColor="#52525b"
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* User ID Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <UserCheck size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>User Database ID (UUID)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Paste your User ID from your Profile"
              placeholderTextColor="#52525b"
              value={userId}
              onChangeText={setUserId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

 
          {/* Save Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Save Configurations</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  container: {
    padding: 24,
    backgroundColor: '#0a0a0f',
    minHeight: '100%',
  },
  header: {
    marginBottom: 28,
    marginTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 6,
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  successText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
  labelIcon: {
    opacity: 0.8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e4e4e7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#27273a',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 14,
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  helperText: {
    fontSize: 10,
    color: '#71717a',
    marginTop: 2,
    paddingLeft: 2,
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
