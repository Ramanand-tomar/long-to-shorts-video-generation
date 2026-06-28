"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createVideo } from "@/actions/video";
import { UploadCloud, X, AlertCircle, Loader2 } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPlan: string;
  onSuccess?: () => void;
}

export default function UploadModal({ isOpen, onClose, userPlan, onSuccess }: UploadModalProps) {
  const router = useRouter();
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Plan limits: Free = 200MB, Pro = 2GB
  const maxSizeBytes = userPlan === "pro" ? 2 * 1024 * 1024 * 1024 : 200 * 1024 * 1024;
  const maxSizeReadable = userPlan === "pro" ? "2 GB" : "200 MB";

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const validateFile = (selectedFile: File): boolean => {
    setError(null);

    // 1. Validate File Extension
    const allowedExtensions = [".mp4", ".mov", ".webm", ".m4v"];
    const fileName = selectedFile.name.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    // Also check mime-type
    const allowedMimeTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
    const hasValidMime = allowedMimeTypes.includes(selectedFile.type);

    if (!hasValidExt && !hasValidMime) {
      setError("Invalid file type. Only MP4, MOV, WebM, and M4V videos are accepted.");
      return false;
    }

    // 2. Validate File Size
    if (selectedFile.size > maxSizeBytes) {
      setError(`File is too large. Your ${userPlan} plan limit is ${maxSizeReadable}.`);
      return false;
    }

    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const startUpload = (triggerPipeline: boolean) => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset || uploadPreset === "placeholder" || cloudName === "demo") {
      setError("Cloudinary is not configured. Please add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to your .env.local file to enable uploading real videos.");
      setUploading(false);
      return;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "vidshort/uploads");

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setProgress(percent);
      }
    };

    // On completion
    xhr.onload = async () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const response = JSON.parse(xhr.responseText);
          
          // Call Server Action to register video in DB with auto-trigger option
          const result = await createVideo({
            title: file.name.substring(0, file.name.lastIndexOf(".")) || file.name,
            fileName: file.name,
            fileSize: file.size,
            videoUrl: response.secure_url,
            duration: response.duration,
            format: response.format,
            cloudinaryAssetId: response.asset_id,
            triggerPipeline: triggerPipeline,
          });

          if (result.error === "upload_limit_exceeded") {
            setError("Daily upload limit exceeded. Upgrade to Pro for unlimited uploads.");
            setUploading(false);
          } else if (result.error) {
            setError(`Database registration failed: ${result.error}`);
            setUploading(false);
          } else {
            // Success
            setUploading(false);
            if (onSuccess) onSuccess();
            onClose();
            router.push(`/dashboard/videos/${result.videoId}`);
          }
        } catch {
          setError("Failed to parse Cloudinary response.");
          setUploading(false);
        }
      } else {
        setError(`Upload failed with status ${xhr.status}. Please check Cloudinary credentials.`);
        setUploading(false);
      }
    };

    // On error
    xhr.onerror = () => {
      setError("A network error occurred during the upload.");
      setUploading(false);
    };

    xhr.open("POST", url, true);
    xhr.send(formData);
  };



  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
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
            <h3 className="text-xl font-bold text-white tracking-tight">Upload Video</h3>
            <p className="text-zinc-400 text-xs mt-1">Direct Cloudinary upload. Bypasses Vercel request limits.</p>
          </div>
          <button 
            disabled={uploading}
            onClick={onClose} 
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Drop Zone */}
        {!file && !uploading && (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer text-center transition-all ${
              isDragActive 
                ? "border-violet-500 bg-violet-500/5 shadow-[0_0_20px_-5px_rgba(124,58,237,0.2)]" 
                : "border-zinc-800 bg-zinc-950/20 hover:border-violet-500/50 hover:bg-zinc-900/10"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mov,.webm,.m4v"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform duration-300 mb-4">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-zinc-200 font-semibold text-sm sm:text-base mb-1.5">
              Drag & drop video file, or <span className="text-violet-400 group-hover:underline">browse</span>
            </p>
            <p className="text-zinc-500 text-xs max-w-xs">
              Supports MP4, MOV, WebM, or M4V. Max {maxSizeReadable} on {userPlan} plan.
            </p>
          </div>
        )}

        {/* Selected File & Action Trigger */}
        {file && !uploading && (
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/30 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-3">
              <UploadCloud className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-white font-bold text-sm truncate max-w-xs mb-1">{file.name}</p>
            <p className="text-zinc-500 text-xs">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            
            <div className="flex flex-col gap-3 w-full mt-6">
              <button
                onClick={() => startUpload(true)}
                className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-1.5"
              >
                ✨ Upload & Auto-Clip
              </button>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setFile(null)}
                  className="flex-1 py-3 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30 text-zinc-400 hover:text-zinc-200 font-semibold text-xs transition-all"
                >
                  Choose Other
                </button>
                <button
                  onClick={() => startUpload(false)}
                  className="flex-1 py-3 rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 hover:border-zinc-750 text-zinc-300 font-bold text-xs transition-all"
                >
                  Upload Only
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Uploading Progress */}
        {uploading && (
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/20 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin mb-4" />
            <p className="text-zinc-300 font-semibold text-sm mb-1">Uploading to Cloudinary...</p>
            <p className="text-zinc-500 text-xs mb-6">Do not close this window</p>
            
            {/* Progress Bar Container */}
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="w-full flex justify-between text-xs text-zinc-500 font-semibold mb-6">
              <span>{progress}% Completed</span>
              <span>{(file!.size * (progress / 100) / (1024 * 1024)).toFixed(2)} MB / {(file!.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>

            <button
              onClick={cancelUpload}
              className="py-2.5 px-6 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-semibold text-xs transition-colors"
            >
              Cancel Upload
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
