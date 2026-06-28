import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { ThemedView } from '@/components/themed-view';
import { getSettings } from '@/utils/storage';
import { getYouTubeDirectUrl, downloadVideo } from '@/utils/downloader';
import { uploadToGoogleDrive } from '@/utils/gdrive';
import { Play, Download, CloudUpload, Sparkles, Settings } from 'lucide-react-native';

type StepStatus = 'idle' | 'resolving' | 'downloading' | 'uploading' | 'triggering' | 'completed' | 'failed';

export default function HomeScreen() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [status, setStatus] = useState<StepStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validateUrl = (url: string): boolean => {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return ytRegex.test(url.trim());
  };

  const handleProcessVideo = async () => {
    if (!youtubeUrl.trim()) return;

    if (!validateUrl(youtubeUrl)) {
      setErrorMsg('Please enter a valid YouTube video URL.');
      return;
    }

    setErrorMsg(null);
    setStatus('resolving');
    setDownloadProgress(0);

    let localVideoUri = '';

    try {
      // 1. Fetch connection settings
      const settings = await getSettings();
      if (!settings.serverUrl || !settings.userId || !settings.gdriveToken) {
        Alert.alert(
          'Missing Settings',
          'Please configure your Server URL, User ID, and Google Drive Access Token in Settings first.',
          [
            { text: 'Go to Settings', onPress: () => router.push('/settings') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        setStatus('idle');
        return;
      }

      // 2. Resolve YouTube video download URL
      const directUrl = await getYouTubeDirectUrl(youtubeUrl.trim(), settings.serverUrl);

      // 3. Download video to phone's local cache
      setStatus('downloading');
      localVideoUri = await downloadVideo(directUrl, (progress) => {
        setDownloadProgress(progress);
      });

      // 4. Upload file to Google Drive
      setStatus('uploading');
      const timestamp = new Date().getTime();
      const fileName = `YT_Download_${timestamp}.mp4`;
      
      const uploadResult = await uploadToGoogleDrive(
        localVideoUri,
        settings.gdriveToken,
        fileName,
        settings.gdriveFolderId
      );

      // 5. Trigger Next.js backend pipeline
      setStatus('triggering');
      const triggerUrl = `${settings.serverUrl.replace(/\/$/, '')}/api/youtube/trigger`;
      const response = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driveUrl: uploadResult.driveUrl,
          userId: settings.userId,
        }),
      });

      const responseJson = await response.json();
      if (!response.ok) {
        throw new Error(responseJson.message || `Pipeline trigger failed with status ${response.status}`);
      }

      // 6. Complete and clean up local file
      setStatus('completed');
      setYoutubeUrl('');
      Alert.alert(
        'Success!',
        'Video has been uploaded to Drive and the clip generation pipeline has started in the background.',
        [{ text: 'Great!' }]
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during processing.');
      setStatus('failed');
    } finally {
      // Always cleanup local file to free storage
      if (localVideoUri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(localVideoUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(localVideoUri, { idempotent: true });
            console.log('Cleaned up local video file to free space.');
          }
        } catch (cleanupErr) {
          console.warn('Failed to clean up temporary video file:', cleanupErr);
        }
      }
    }
  };

  const getStepIndicatorStyle = (stepName: StepStatus) => {
    const order: StepStatus[] = ['idle', 'resolving', 'downloading', 'uploading', 'triggering', 'completed'];
    const currentIdx = order.indexOf(status);
    const stepIdx = order.indexOf(stepName);

    if (status === 'failed') {
      return styles.stepFailed;
    }

    if (stepIdx < currentIdx) {
      return styles.stepDone;
    } else if (stepIdx === currentIdx) {
      return styles.stepActive;
    } else {
      return styles.stepPending;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header section with branding */}
      <View style={styles.brandingHeader}>
        <View style={styles.logoBadge}>
          <Sparkles size={16} color="#c084fc" />
          <Text style={styles.logoBadgeText}>Mobile Hub</Text>
        </View>
        <Text style={styles.brandingTitle}>VidShorts Automator</Text>
        <Text style={styles.brandingSubtitle}>
          Download YouTube videos to Google Drive & auto-trigger shorts rendering.
        </Text>
      </View>

      {/* Main card */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>🎬 Input YouTube Link</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Paste YouTube watch URL here..."
          placeholderTextColor="#52525b"
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          editable={status === 'idle' || status === 'completed' || status === 'failed'}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {errorMsg && (
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
        )}

        {status === 'idle' || status === 'completed' || status === 'failed' ? (
          <TouchableOpacity
            style={[styles.processButton, !youtubeUrl.trim() && styles.disabledButton]}
            onPress={handleProcessVideo}
            disabled={!youtubeUrl.trim()}
          >
            <Play size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.processButtonText}>Process Video</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color="#c084fc" style={{ marginBottom: 12 }} />
            
            {/* Visual step progress tracker */}
            <View style={styles.stepsTracker}>
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, getStepIndicatorStyle('resolving')]} />
                <Text style={[styles.stepLabel, status === 'resolving' && styles.activeLabel]}>Resolving Link</Text>
              </View>
              <View style={styles.stepConnector} />
              
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, getStepIndicatorStyle('downloading')]} />
                <Text style={[styles.stepLabel, status === 'downloading' && styles.activeLabel]}>
                  Downloading to Temp ({Math.round(downloadProgress * 100)}%)
                </Text>
              </View>
              <View style={styles.stepConnector} />
              
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, getStepIndicatorStyle('uploading')]} />
                <Text style={[styles.stepLabel, status === 'uploading' && styles.activeLabel]}>Uploading to Drive</Text>
              </View>
              <View style={styles.stepConnector} />
              
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, getStepIndicatorStyle('triggering')]} />
                <Text style={[styles.stepLabel, status === 'triggering' && styles.activeLabel]}>Triggering Pipeline</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>💡 Background Processing</Text>
        <Text style={styles.infoCardBody}>
          Once the video is uploaded to Google Drive, the pipeline trigger is complete. You can close this app, and the clip transcription, moment extraction, and publishing will run completely on the backend server.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#0a0a0f',
    minHeight: '100%',
  },
  brandingHeader: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 12,
  },
  logoBadgeText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  brandingTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
  },
  brandingSubtitle: {
    fontSize: 12,
    color: '#71717a',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 280,
  },
  mainCard: {
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: '#1e1e2d',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#27273a',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 12,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    paddingLeft: 4,
  },
  processButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#4c1d95',
    opacity: 0.6,
  },
  processButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingWrapper: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  stepsTracker: {
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: 12,
    marginTop: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepActive: {
    backgroundColor: '#a78bfa',
    transform: [{ scale: 1.2 }],
    shadowColor: '#a78bfa',
    shadowRadius: 6,
    shadowOpacity: 0.8,
  },
  stepDone: {
    backgroundColor: '#34d399',
  },
  stepPending: {
    backgroundColor: '#27273a',
  },
  stepFailed: {
    backgroundColor: '#f87171',
  },
  stepConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#27273a',
    marginLeft: 4,
  },
  stepLabel: {
    fontSize: 12,
    color: '#71717a',
    fontWeight: '600',
  },
  activeLabel: {
    color: '#e4e4e7',
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: '#161622/40',
    borderWidth: 1,
    borderColor: '#212235',
    borderRadius: 22,
    padding: 20,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#a78bfa',
    marginBottom: 6,
  },
  infoCardBody: {
    fontSize: 11,
    color: '#71717a',
    lineHeight: 16,
  },
});
