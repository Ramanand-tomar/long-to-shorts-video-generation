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
import { Shield, Link2, Folder, UserCheck, CheckCircle2, Globe } from 'lucide-react-native';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [userId, setUserId] = useState('');
  const [gdriveToken, setGdriveToken] = useState('');
  const [gdriveFolderId, setGdriveFolderId] = useState('');
  const [cobaltUrl, setCobaltUrl] = useState('');
  const [gdriveRefreshToken, setGdriveRefreshToken] = useState('');
  const [gdriveClientId, setGdriveClientId] = useState('');
  const [gdriveClientSecret, setGdriveClientSecret] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getSettings();
      setServerUrl(data.serverUrl);
      setUserId(data.userId);
      setGdriveToken(data.gdriveToken);
      setGdriveFolderId(data.gdriveFolderId);
      setCobaltUrl(data.cobaltUrl);
      setGdriveRefreshToken(data.gdriveRefreshToken);
      setGdriveClientId(data.gdriveClientId);
      setGdriveClientSecret(data.gdriveClientSecret);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);

    try {
      await saveSettings({
        serverUrl: serverUrl.trim(),
        userId: userId.trim(),
        gdriveToken: gdriveToken.trim(),
        gdriveFolderId: gdriveFolderId.trim(),
        cobaltUrl: cobaltUrl.trim(),
        gdriveRefreshToken: gdriveRefreshToken.trim(),
        gdriveClientId: gdriveClientId.trim(),
        gdriveClientSecret: gdriveClientSecret.trim(),
      });
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

           {/* Google Drive Token Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Shield size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>Google Drive Access Token (1 hour limit)</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste Google Drive OAuth Access Token"
              placeholderTextColor="#52525b"
              value={gdriveToken}
              onChangeText={setGdriveToken}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              Used as fallback if no Refresh Token is provided below.
            </Text>
          </View>

          {/* Google Drive Refresh Token Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Shield size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>Google Drive Refresh Token (Indefinite)</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste Google Drive OAuth Refresh Token for auto-renewals"
              placeholderTextColor="#52525b"
              value={gdriveRefreshToken}
              onChangeText={setGdriveRefreshToken}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              Recommended. The app will automatically generate fresh access tokens on every upload using your client credentials!
            </Text>
          </View>

          {/* Google OAuth Client ID Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Shield size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>Google Client ID (Offline Use)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Paste Google OAuth Client ID"
              placeholderTextColor="#52525b"
              value={gdriveClientId}
              onChangeText={setGdriveClientId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Google OAuth Client Secret Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Shield size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>Google Client Secret (Offline Use)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Paste Google OAuth Client Secret"
              placeholderTextColor="#52525b"
              value={gdriveClientSecret}
              onChangeText={setGdriveClientSecret}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          {/* Google Folder ID Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Folder size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>Target Folder ID (Optional)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Folder ID to upload videos inside"
              placeholderTextColor="#52525b"
              value={gdriveFolderId}
              onChangeText={setGdriveFolderId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Cobalt API URL Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Globe size={14} color="#a1a1aa" style={styles.labelIcon} />
              <Text style={styles.label}>Cobalt Downloader API URL</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://api.cobalt.tools"
              placeholderTextColor="#52525b"
              value={cobaltUrl}
              onChangeText={setCobaltUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              Find public nodes on instances.cobalt.best if the main server requires keys.
            </Text>
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
