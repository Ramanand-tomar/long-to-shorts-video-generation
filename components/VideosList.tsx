"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Film, Play, Clock, Calendar, Plus, Sparkles, Trash2, Loader2, Link2 } from "lucide-react";
import UploadModal from "./UploadModal";
import GoogleDriveModal from "./GoogleDriveModal";
import { deleteVideo } from "@/actions/video";

interface Video {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  fileName: string;
  fileSize: number;
  duration: number | null;
  format: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface VideosListProps {
  videos: Video[];
  userPlan: string;
}

export default function VideosList({ videos, userPlan }: VideosListProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [gdriveOpen, setGdriveOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video? This will also delete all associated clips and scheduled posts.")) {
      return;
    }
    
    setDeletingId(videoId);
    try {
      const result = await deleteVideo(videoId);
      if (result.error) {
        alert(`Failed to delete video: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred while deleting the video.");
    } finally {
      setDeletingId(null);
    }
  };

  // Helper to format video duration into HH:MM:SS or MM:SS
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num: number) => String(num).padStart(2, "0");

    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Helper to retrieve Cloudinary video thumbnail
  const getThumbnailUrl = (videoUrl: string) => {
    if (videoUrl.includes("/video/upload/")) {
      const lastDot = videoUrl.lastIndexOf(".");
      const baseUrl = lastDot !== -1 ? videoUrl.substring(0, lastDot) : videoUrl;
      const jpgUrl = baseUrl + ".jpg";
      // Inject standard 16:9 thumbnail cropping transformations
      return jpgUrl.replace("/video/upload/", "/video/upload/c_fill,g_center,h_360,w_640,f_jpg/");
    }
    return "";
  };

  return (
    <div className="p-6 sm:p-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Videos</h1>
          <p className="text-zinc-400 text-sm mt-1">View, manage, and run AI clip analysis on your uploads.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setGdriveOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-sm transition-all"
          >
            <Link2 className="w-4 h-4 text-violet-400" />
            Add from Google Drive
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-4.5 h-4.5" />
            Upload Video
          </button>
        </div>
      </div>

      {/* Videos Grid */}
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 border border-dashed border-zinc-900 rounded-3xl bg-zinc-950/10">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-6">
            <Film className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No videos uploaded yet</h3>
          <p className="text-zinc-500 text-sm max-w-sm mb-8 leading-relaxed">
            Drag and drop video files directly from your computer to Cloudinary to start clipping.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setGdriveOpen(true)}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-sm transition-all"
            >
              <Link2 className="w-4 h-4 text-violet-400" />
              Add from Google Drive
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/20"
            >
              <Plus className="w-4.5 h-4.5" />
              Upload Your First Video
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => {
            const thumbnail = getThumbnailUrl(video.videoUrl);
            return (
              <div 
                key={video.id} 
                className="group bg-zinc-900/10 border border-zinc-900 rounded-2xl overflow-hidden hover:border-zinc-800 transition-all flex flex-col justify-between"
              >
                
                {/* Thumbnail card image */}
                <div className="aspect-[16/9] w-full bg-zinc-950 relative overflow-hidden border-b border-zinc-900/80">
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={thumbnail} 
                      alt={video.title} 
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Film className="w-12 h-12" />
                    </div>
                  )}

                  {/* Play overlay button on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                    <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </div>
                  </div>

                  {/* Duration overlay badge */}
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/75 text-[11px] font-bold tracking-wide text-white">
                    {formatDuration(video.duration)}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1 group-hover:text-violet-400 transition-colors" title={video.title}>
                      {video.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-zinc-500 text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(video.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/60 pt-4 mt-5">
                    {/* Status badge */}
                    {video.status === "ready" ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        Ready
                      </span>
                    ) : ["processing", "pending", "analyzing", "rendering", "publishing"].includes(video.status) ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        Processing
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                        Failed
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteVideo(video.id)}
                        disabled={deletingId !== null}
                        className="p-2 rounded-xl bg-zinc-950/20 border border-zinc-900 hover:border-rose-500/30 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
                        title="Delete Video"
                      >
                        {deletingId === video.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>

                      <Link
                        href={`/dashboard/videos/${video.id}`}
                        className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        Analyse
                      </Link>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal (renders portalled on state change) */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        userPlan={userPlan}
      />

      {/* Google Drive URL Modal */}
      <GoogleDriveModal
        isOpen={gdriveOpen}
        onClose={() => setGdriveOpen(false)}
      />
    </div>
  );
}
