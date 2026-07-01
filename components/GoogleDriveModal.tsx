"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitGoogleDriveVideo, getGoogleDriveConnection, disconnectGoogleDrive } from "@/actions/gdrive";
import { Link2, X, AlertCircle, Loader2, Play, CheckCircle2, UploadCloud } from "lucide-react";

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GoogleDriveModal({ isOpen, onClose, onSuccess }: GoogleDriveModalProps) {
  const router = useRouter();
  const [driveUrl, setDriveUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [gdriveProfile, setGdriveProfile] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(true);

  // File upload states
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = async () => {
    setLoadingConnection(true);
    try {
      const conn = await getGoogleDriveConnection();
      if (conn) {
        setGdriveConnected(true);
        setGdriveProfile(conn.profileName);
        setAccessToken(conn.accessToken || null);
        setUploadMode("file");
      } else {
        setGdriveConnected(false);
        setGdriveProfile(null);
        setAccessToken(null);
        setUploadMode("link");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConnection(false);
    }
  };

  const uploadToGoogleDrive = async (selectedFile: File) => {
    if (!accessToken) {
      setError("Google Drive connection token is missing. Please reconnect your account.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Start resumable session
      const initResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": selectedFile.type,
          "X-Upload-Content-Length": selectedFile.size.toString(),
        },
        body: JSON.stringify({
          name: selectedFile.name,
          mimeType: selectedFile.type,
        }),
      });

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize Google Drive upload: ${await initResponse.text()}`);
      }

      const uploadUrl = initResponse.headers.get("Location");
      if (!uploadUrl) {
        throw new Error("No upload Location header returned from Google Drive.");
      }

      // Step 2: Perform upload using XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            const fileId = response.id;
            if (!fileId) {
              throw new Error("Google Drive response did not contain a file ID.");
            }

            // Successfully uploaded! Trigger submit action
            const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            const result = await submitGoogleDriveVideo(directUrl);

            if (result.error) {
              setError(result.message || `Failed to start pipeline: ${result.error}`);
              setSubmitting(false);
            } else {
              setSubmitting(false);
              if (onSuccess) onSuccess();
              onClose();
              router.push(`/dashboard/videos/${result.videoId}`);
            }
          } catch {
            setError("Failed to process Google Drive upload response.");
            setSubmitting(false);
          }
        } else {
          setError(`Upload failed with status ${xhr.status}.`);
          setSubmitting(false);
        }
      };

      xhr.onerror = () => {
        setError("A network error occurred uploading to Google Drive.");
        setSubmitting(false);
      };

      xhr.open("PUT", uploadUrl, true);
      xhr.send(selectedFile);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || "An error occurred starting Google Drive upload.");
      setSubmitting(false);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const allowedExtensions = [".mp4", ".mov", ".webm", ".m4v"];
    const fileName = selectedFile.name.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => fileName.endsWith(ext));
    const allowedMimeTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
    const hasValidMime = allowedMimeTypes.includes(selectedFile.type);

    if (!hasValidExt && !hasValidMime) {
      setError("Invalid file type. Only MP4, MOV, WebM, and M4V videos are accepted.");
      return;
    }

    // Max 2GB
    if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
      setError("File is too large. Maximum size is 2 GB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim()) return;

    setSubmitting(true);
    setError(null);

    const result = await submitGoogleDriveVideo(driveUrl.trim());

    if (result.error) {
      setError(result.message || `An error occurred: ${result.error}`);
      setSubmitting(false);
    } else {
      setSubmitting(false);
      if (onSuccess) onSuccess();
      onClose();
      router.push(`/dashboard/videos/${result.videoId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#12121a] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        
        {/* Glow decoration */}
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-violet-600/10 rounded-full blur-[60px] pointer-events-none" />

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">🎬 Add Google Drive Video</h3>
            <p className="text-zinc-400 text-xs mt-1">Paste a public Drive share link to launch the automated pipeline.</p>
          </div>
          <button 
            disabled={submitting}
            onClick={onClose} 
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pipeline steps indicator */}
        <div className="flex justify-between items-center bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-4 mb-6">
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-violet-600/15 border border-violet-500/30 text-violet-400 text-xs font-bold flex items-center justify-center mb-1.5">1</div>
            <span className="text-[10px] text-zinc-400 font-medium">Analyze</span>
          </div>
          <div className="h-[1px] bg-zinc-800 flex-1 mx-1" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-bold flex items-center justify-center mb-1.5">2</div>
            <span className="text-[10px] text-zinc-500 font-medium">Render</span>
          </div>
          <div className="h-[1px] bg-zinc-800 flex-1 mx-1" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-bold flex items-center justify-center mb-1.5">3</div>
            <span className="text-[10px] text-zinc-500 font-medium">Publish</span>
          </div>
          <div className="h-[1px] bg-zinc-800 flex-1 mx-1" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-bold flex items-center justify-center mb-1.5">4</div>
            <span className="text-[10px] text-zinc-500 font-medium">Email</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Google Drive Account Connection status */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-2xl flex items-center justify-between gap-4">
            {loadingConnection ? (
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                <span>Checking account connection...</span>
              </div>
            ) : gdriveConnected ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Linked as <strong className="text-zinc-200">{gdriveProfile}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setLoadingConnection(true);
                    await disconnectGoogleDrive();
                    await checkConnection();
                  }}
                  className="text-rose-400 hover:text-rose-300 text-xs font-semibold hover:underline"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <AlertCircle className="w-4 h-4 text-zinc-500" />
                  <span>Connect your drive to import private files</span>
                </div>
                <a
                  href="/api/auth/gdrive/start"
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition-colors"
                >
                  Connect
                </a>
              </div>
            )}
          </div>

          {/* Mode Selector */}
          {gdriveConnected && (
            <div className="flex gap-2 p-1 bg-zinc-950 border border-zinc-900/60 rounded-2xl mb-2">
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                  uploadMode === "file"
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                📁 Upload File
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("link")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                  uploadMode === "link"
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                🔗 Paste Link
              </button>
            </div>
          )}

          {/* 1. File Upload Card */}
          {uploadMode === "file" ? (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("gdrive-file-input")?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  isDragActive
                    ? "border-violet-500 bg-violet-500/5"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-950/60"
                }`}
              >
                <input
                  id="gdrive-file-input"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className="w-10 h-10 text-violet-400" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-zinc-200 max-w-[250px] truncate">
                    {file ? file.name : "Drag and drop video file"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {file
                      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                      : "MP4, MOV, WebM, or M4V (up to 2GB)"}
                  </p>
                </div>
              </div>

              {submitting && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-zinc-400">
                    <span>Uploading directly to Google Drive...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-zinc-850">
                    <div
                      className="h-full bg-violet-600 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 2. Paste URL input field */
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-300 font-bold text-xs uppercase tracking-wider mb-2">Google Drive URL</label>
                <div className="relative">
                  <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400" />
                  <input
                    type="url"
                    required={uploadMode === "link"}
                    disabled={submitting}
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm outline-none focus:border-violet-500 transition-colors placeholder-zinc-600 disabled:opacity-50"
                    data-element-id="drive-url-input"
                  />
                </div>
              </div>

              {/* Sharing Help Info */}
              <div className="p-4 rounded-2xl bg-violet-600/5 border border-violet-500/10 text-violet-300/80 text-xs leading-relaxed">
                {gdriveConnected ? (
                  <span>✓ <strong>Google Drive connected.</strong> You can paste links to your <strong>private files</strong> (no public sharing settings required!). Files up to 2GB are supported.</span>
                ) : (
                  <span>Please connect your Google Drive above to process private files. Otherwise, make sure your sharing setting is configured to <strong>&ldquo;Anyone with the link can view&rdquo;</strong>.</span>
                )}
              </div>
            </div>
          )}

          {/* Auto settings list */}
          <div>
            <label className="block text-zinc-300 font-bold text-xs uppercase tracking-wider mb-3">Pipeline Settings (Defaults)</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Clips Generated</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">4–5 Clips</p>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Publishing Gap</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">1 Hour</p>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Editing Style</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">Default</p>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">S3 Cleanup</p>
                <p className="text-zinc-200 text-xs font-bold mt-1">Auto-Delete</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type={uploadMode === "file" ? "button" : "submit"}
            onClick={() => {
              if (uploadMode === "file") {
                if (file) {
                  uploadToGoogleDrive(file);
                } else {
                  setError("Please drag and drop or select a video file first.");
                }
              }
            }}
            disabled={submitting || (uploadMode === "link" && !driveUrl.trim()) || (uploadMode === "file" && !file)}
            className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-element-id="start-pipeline-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadProgress > 0 ? `Uploading (${uploadProgress}%)...` : "Ingesting Video..."}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                🚀 Start Auto-Pipeline
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
