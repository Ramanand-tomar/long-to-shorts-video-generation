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
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ThemedView } from '@/components/themed-view';
import { getSettings } from '@/utils/storage';
import { getYouTubeDirectUrl, downloadVideo } from '@/utils/downloader';
import { uploadToCloudinary } from '@/utils/cloudinary';
import { Play, Download, CloudUpload, Sparkles, Settings, FileVideo, Upload } from 'lucide-react-native';

type StepStatus = 'idle' | 'resolving' | 'downloading' | 'uploading' | 'triggering' | 'completed' | 'failed';

interface SelectedVideoFile {
  uri: string;
  name: string;
  size?: number;
}

export default function HomeScreen() {
  const router = useRouter();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'youtube' | 'file'>('youtube');
  
  // Inputs
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideoFile | null>(null);
  
  // Status states
  const [status, setStatus] = useState<StepStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoTrigger, setAutoTrigger] = useState(true);

  const validateUrl = (url: string): boolean => {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return ytRegex.test(url.trim());
  };

  const handlePickVideo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Permission to access your video gallery is required to select a video file.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const name = asset.fileName || uri.split('/').pop() || 'selected_video.mp4';
        const size = asset.fileSize; // optional bytes
        
        setSelectedVideo({ uri, name, size });
        setErrorMsg(null);
      }
    } catch (err) {
      console.error('Failed to pick video:', err);
      Alert.alert('Error', 'Failed to open video library.');
    }
  };

  const handleProcessVideo = async () => {
    if (activeTab === 'youtube') {
      if (!youtubeUrl.trim()) return;
      if (!validateUrl(youtubeUrl)) {
        setErrorMsg('Please enter a valid YouTube video URL.');
        return;
      }
    } else {
      if (!selectedVideo) {
        setErrorMsg('Please select a video file to upload.');
        return;
      }
    }

    setErrorMsg(null);
    setDownloadProgress(0);
    setUploadProgress(0);
    setStatus('idle');

    let localVideoUri = '';
    let shouldDeleteLocalFile = false;

    try {
      // 1. Fetch connection settings
      const settings = await getSettings();
      if (!settings.serverUrl || !settings.userId) {
        Alert.alert(
          'Missing Settings',
          'Please configure your Server URL and User ID in Settings first.',
          [
            { text: 'Go to Settings', onPress: () => router.push('/settings') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      // Fetch Cloudinary configs dynamically from Next.js backend
      setStatus('resolving');
      const configRes = await fetch(`${settings.serverUrl.replace(/\/$/, '')}/api/youtube/config`);
      if (!configRes.ok) {
        throw new Error(`Failed to load Cloudinary config from server: status ${configRes.status}`);
      }
      const { cloudName, uploadPreset } = await configRes.json().catch(() => ({}));
      if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary credentials are not configured on your Next.js server. Please check your .env.local file.');
      }

      const timestamp = new Date().getTime();
      let fileName = '';

      if (activeTab === 'youtube') {
        // 2. Resolve YouTube video download URL
        const directUrl = await getYouTubeDirectUrl(youtubeUrl.trim(), settings.serverUrl);

        // 3. Download video to phone's local cache
        setStatus('downloading');
        localVideoUri = await downloadVideo(directUrl, (progress) => {
          setDownloadProgress(progress);
        });
        shouldDeleteLocalFile = true; // Delete cached video file
        fileName = `YT_Download_${timestamp}.mp4`;
      } else {
        // Direct File Upload - use picked video file
        localVideoUri = selectedVideo!.uri;
        fileName = selectedVideo!.name || `Local_Upload_${timestamp}.mp4`;
        shouldDeleteLocalFile = false; // Do NOT delete user's picked media gallery file!
      }

      // 4. Upload file to Cloudinary with progress tracking
      setStatus('uploading');
      const uploadResult = await uploadToCloudinary(
        localVideoUri,
        cloudName,
        uploadPreset,
        (progress) => {
          setUploadProgress(progress);
        }
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
          videoUrl: uploadResult.secureUrl,
          cloudinaryAssetId: uploadResult.publicId,
          userId: settings.userId,
          triggerPipeline: autoTrigger,
        }),
      });

      const responseJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseJson.message || `Pipeline trigger failed with status ${response.status}`);
      }

      // 6. Complete and clean up local file if we downloaded it
      setStatus('completed');
      setYoutubeUrl('');
      setSelectedVideo(null);
      
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
      // Always cleanup local file to free storage if it was downloaded/cached
      if (shouldDeleteLocalFile && localVideoUri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(localVideoUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(localVideoUri, { idempotent: true });
            console.log('Cleaned up local cached video file to free space.');
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

  const getFormatSize = (bytes?: number): string => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const isProcessDisabled = () => {
    if (activeTab === 'youtube') {
      return !youtubeUrl.trim();
    } else {
      return !selectedVideo;
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
          Select a video source to upload and process into viral shorts.
        </Text>
      </View>

      {/* Selector Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'youtube' && styles.activeTabButton]}
          onPress={() => {
            if (status === 'idle' || status === 'completed' || status === 'failed') {
              setActiveTab('youtube');
              setErrorMsg(null);
            }
          }}
        >
          <Play size={14} color={activeTab === 'youtube' ? '#ffffff' : '#71717a'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabButtonText, activeTab === 'youtube' && styles.activeTabButtonText]}>
            YouTube URL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'file' && styles.activeTabButton]}
          onPress={() => {
            if (status === 'idle' || status === 'completed' || status === 'failed') {
              setActiveTab('file');
              setErrorMsg(null);
            }
          }}
        >
          <Upload size={14} color={activeTab === 'file' ? '#ffffff' : '#71717a'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabButtonText, activeTab === 'file' && styles.activeTabButtonText]}>
            Direct File
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main card */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>
          {activeTab === 'youtube' ? '🎬 Enter YouTube Link' : '📂 Select Local Video'}
        </Text>
        
        {activeTab === 'youtube' ? (
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
        ) : (
          <View style={styles.filePickerWrapper}>
            {selectedVideo ? (
              <View style={styles.selectedFileBox}>
                <FileVideo size={36} color="#c084fc" />
                <View style={styles.fileInfoTextWrapper}>
                  <Text style={styles.fileNameText} numberOfLines={1}>
                    {selectedVideo.name}
                  </Text>
                  {selectedVideo.size && (
                    <Text style={styles.fileSizeText}>
                      {getFormatSize(selectedVideo.size)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.changeFileButton}
                  onPress={handlePickVideo}
                  disabled={status !== 'idle' && status !== 'completed' && status !== 'failed'}
                >
                  <Text style={styles.changeFileButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.pickButton}
                onPress={handlePickVideo}
                disabled={status !== 'idle' && status !== 'completed' && status !== 'failed'}
              >
                <CloudUpload size={24} color="#a1a1aa" style={{ marginBottom: 8 }} />
                <Text style={styles.pickButtonText}>Choose Video from Gallery</Text>
                <Text style={styles.pickButtonSubtext}>MP4 format recommended</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {errorMsg && (
          <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
        )}

        {/* Toggle Switch for Auto-Trigger */}
        {(status === 'idle' || status === 'completed' || status === 'failed') && (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Auto-trigger clipping pipeline</Text>
            <TouchableOpacity
              style={[styles.toggleSwitch, autoTrigger ? styles.toggleSwitchOn : styles.toggleSwitchOff]}
              onPress={() => setAutoTrigger(!autoTrigger)}
            >
              <View style={[styles.toggleThumb, autoTrigger ? styles.toggleThumbOn : styles.toggleThumbOff]} />
            </TouchableOpacity>
          </View>
        )}

        {status === 'idle' || status === 'completed' || status === 'failed' ? (
          <TouchableOpacity
            style={[styles.processButton, isProcessDisabled() && styles.disabledButton]}
            onPress={handleProcessVideo}
            disabled={isProcessDisabled()}
          >
            <Sparkles size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.processButtonText}>
              {activeTab === 'youtube'
                ? (autoTrigger ? 'Process Video' : 'Add YouTube Video')
                : (autoTrigger ? 'Upload and Trigger' : 'Upload Video Only')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color="#c084fc" style={{ marginBottom: 12 }} />
            
            {/* Visual step progress tracker */}
            <View style={styles.stepsTracker}>
              {activeTab === 'youtube' && (
                <>
                  <View style={styles.stepRow}>
                    <View style={[styles.stepDot, getStepIndicatorStyle('resolving')]} />
                    <Text style={[styles.stepLabel, status === 'resolving' && styles.activeLabel]}>
                      Resolving Link
                    </Text>
                  </View>
                  <View style={styles.stepConnector} />
                  
                  <View style={styles.stepRow}>
                    <View style={[styles.stepDot, getStepIndicatorStyle('downloading')]} />
                    <Text style={[styles.stepLabel, status === 'downloading' && styles.activeLabel]}>
                      Downloading YouTube Stream ({Math.round(downloadProgress * 100)}%)
                    </Text>
                  </View>
                  <View style={styles.stepConnector} />
                </>
              )}
              
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, getStepIndicatorStyle('uploading')]} />
                <Text style={[styles.stepLabel, status === 'uploading' && styles.activeLabel]}>
                  Uploading to Cloud ({Math.round(uploadProgress * 100)}%)
                </Text>
              </View>
              <View style={styles.stepConnector} />
              
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, getStepIndicatorStyle('triggering')]} />
                <Text style={[styles.stepLabel, status === 'triggering' && styles.activeLabel]}>
                  {autoTrigger ? 'Triggering Pipeline' : 'Registering in Database'}
                </Text>
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
    marginBottom: 24,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: '#1e1e2d',
    borderRadius: 20,
    padding: 6,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  activeTabButton: {
    backgroundColor: '#1c192d',
    borderWidth: 1,
    borderColor: '#2d294a',
  },
  tabButtonText: {
    color: '#71717a',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabButtonText: {
    color: '#ffffff',
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
    fontSize: 14,
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
    marginBottom: 16,
  },
  filePickerWrapper: {
    marginBottom: 16,
  },
  pickButton: {
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#27273a',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: '#e4e4e7',
    fontSize: 14,
    fontWeight: '700',
  },
  pickButtonSubtext: {
    color: '#52525b',
    fontSize: 11,
    marginTop: 4,
  },
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#27273a',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  fileInfoTextWrapper: {
    flex: 1,
  },
  fileNameText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  fileSizeText: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 2,
  },
  changeFileButton: {
    backgroundColor: '#27273a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  changeFileButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
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
    backgroundColor: 'rgba(22, 22, 34, 0.4)',
    borderWidth: 1,
    borderColor: '#1e1e2d',
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#27273a',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  toggleLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: '#7c3aed',
  },
  toggleSwitchOff: {
    backgroundColor: '#27273a',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    alignSelf: 'flex-start',
  },
});
