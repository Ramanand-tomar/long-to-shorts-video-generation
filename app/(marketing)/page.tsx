"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Sliders,
  Cpu,
  Calendar,
  Play,
  ArrowRight,
  Zap,
  Tv,
  Clock,
  Shield,
  Star,
  Quote
} from "lucide-react";
import PricingSection from "@/components/PricingSection";
import FaqSection from "@/components/FaqSection";

export default function Home() {
  const { isSignedIn } = useAuth();

  const steps = [
    {
      num: "01",
      title: "Upload Long Video",
      desc: "Drag & drop podcasts, webinars, speeches, or streams in MP4, MOV, or WebM format.",
      icon: UploadCloud,
    },
    {
      num: "02",
      title: "Transcribe Instantly",
      desc: "Deepgram transcribes your video at a word-level with exact millisecond timestamps.",
      icon: FileText,
    },
    {
      num: "03",
      title: "AI Moment Pick",
      desc: "Gemini evaluates hook strength, context, and pacing to select the top 4-5 engaging clips.",
      icon: Sparkles,
    },
    {
      num: "04",
      title: "Style & Customize",
      desc: "Preview your clip, choose fonts, sizes, colors, and place the animated captions.",
      icon: Sliders,
    },
    {
      num: "05",
      title: "Cloud Render",
      desc: "One-click Remotion Lambda cloud render. Download your polished MP4 within seconds.",
      icon: Cpu,
    },
    {
      num: "06",
      title: "Schedule & Publish",
      desc: "Publish instantly or schedule posts across TikTok, Instagram Reels, and YouTube Shorts.",
      icon: Calendar,
    },
  ];

  const features = [
    {
      title: "Virality Score",
      desc: "Receive an AI-driven prediction score indicating how likely a clip is to go viral on TikTok or Reels.",
      icon: Zap,
    },
    {
      title: "Auto-Framing",
      desc: "Active speaker tracking keeps the main subject centered in standard 9:16 vertical layouts.",
      icon: Tv,
    },
    {
      title: "Dynamic Subtitles",
      desc: "Stunning, animated, karaoke-style captions that highlight words as they are spoken.",
      icon: Sparkles,
    },
    {
      title: "Priority Render",
      desc: "Never wait in line. High-speed cloud rendering instances deliver outputs in under 30 seconds.",
      icon: Clock,
    },
    {
      title: "Unlimited Security",
      desc: "All uploads and rendered videos are securely stored in encrypted cloud buckets.",
      icon: Shield,
    },
    {
      title: "Bulk Scheduling",
      desc: "Schedule a month's worth of short clips to publish automatically to your linked accounts.",
      icon: Calendar,
    },
  ];

  const testimonials = [
    {
      quote: "VidShort turned our 1-hour weekly podcast into 10 high-performing TikToks in literally 5 minutes. The captions look incredible.",
      author: "Sarah Jenkins",
      role: "Host of TechTalk Weekly",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80",
    },
    {
      quote: "The speaker tracking is a game changer. I used to spend hours manually keyframing horizontal video to 9:16. VidShort does it instantly.",
      author: "Marcus Chen",
      role: "Full-Time YouTuber",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 max-w-7xl mx-auto text-center z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-950/40 border border-violet-800/40 text-violet-300 text-xs font-semibold tracking-wide mb-8">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
          AI-Powered Short Clip Generator
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6">
          Turn Long Videos Into{" "}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            Viral Short Clips
          </span>
        </h1>

        {/* Description */}
        <p className="text-zinc-400 text-base sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload once. Our AI transcribes, detects your most engaging highlights, auto-crops speakers, and renders short-form masterpieces in seconds.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link
            href={isSignedIn ? "/dashboard" : "/sign-up"}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white font-bold transition-all shadow-xl shadow-violet-500/20 flex items-center justify-center gap-2 group"
          >
            Start for Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 text-zinc-300 font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-zinc-300 text-zinc-300" />
            Watch Demo
          </a>
        </div>

        {/* Dashboard Mockup Preview */}
        <div className="relative max-w-5xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4 backdrop-blur-lg shadow-2xl">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-violet-500/5 to-fuchsia-500/5 pointer-events-none" />
          <div className="w-full aspect-[16/9] rounded-xl bg-zinc-950 overflow-hidden relative border border-zinc-900 flex items-center justify-center">
            {/* Visual placeholder representation of VidShort dashboard */}
            <div className="absolute top-4 left-4 flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
            </div>
            
            <div className="text-center px-4 max-w-md">
              <div className="w-16 h-16 rounded-full bg-violet-600/10 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
                <Play className="w-6 h-6 text-violet-400 fill-violet-400 ml-0.5" />
              </div>
              <p className="text-zinc-300 font-bold text-lg mb-1">See VidShort in Action</p>
              <p className="text-zinc-500 text-xs sm:text-sm">Experience the workspace: upload a video, preview clips, style active speak overlays, and render on Lambda.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Logo strip */}
      <section className="border-y border-zinc-900 bg-zinc-950/20 py-10 px-6 text-center relative z-10">
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase mb-6">
          Loved by Creators and Social Media Agencies
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-16 opacity-40 grayscale hover:opacity-60 transition-opacity">
          <span className="text-white font-extrabold text-xl sm:text-2xl tracking-tight">PODCASTS.io</span>
          <span className="text-white font-extrabold text-xl sm:text-2xl tracking-tight">MEDIA LAB</span>
          <span className="text-white font-extrabold text-xl sm:text-2xl tracking-tight">VIRAL LOOP</span>
          <span className="text-white font-extrabold text-xl sm:text-2xl tracking-tight">STREAM LABS</span>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 max-w-7xl mx-auto scroll-mt-20 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-violet-500 text-sm font-bold tracking-widest uppercase block mb-3">
            Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            From Upload to Published in Minutes
          </h2>
          <p className="text-zinc-400 mt-4">
            Our automated, cloud-based workflow turns raw files into viral social posts through 6 easy steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div 
                key={idx} 
                className="group relative bg-zinc-900/20 border border-zinc-900 rounded-2xl p-8 hover:border-violet-500/30 hover:bg-zinc-900/40 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-xl bg-violet-950/50 border border-violet-800/30 flex items-center justify-center text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-zinc-700 font-extrabold text-2xl tracking-tight group-hover:text-violet-500/20 transition-colors">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-zinc-950/40 border-y border-zinc-900 px-6 scroll-mt-20 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-violet-500 text-sm font-bold tracking-widest uppercase block mb-3">
              Power Packed
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Automated Features for Power Creators
            </h2>
            <p className="text-zinc-400 mt-4">
              Everything you need to optimize engagement, format layouts, and schedule reels without opening complex video editors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={idx} 
                  className="flex gap-6 p-6 rounded-2xl bg-zinc-900/10 border border-zinc-900/50 hover:bg-zinc-900/30 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base mb-1">{feature.title}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
          <div className="lg:col-span-1">
            <span className="text-violet-500 text-sm font-bold tracking-widest uppercase block mb-3">
              Reviews
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              What Creators Say About Us
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Hear from digital creators, YouTubers, and podcasters who freed up hours of editing work each week using VidShort.
            </p>
            <div className="flex gap-1.5 text-amber-400">
              <Star className="w-5 h-5 fill-amber-400" />
              <Star className="w-5 h-5 fill-amber-400" />
              <Star className="w-5 h-5 fill-amber-400" />
              <Star className="w-5 h-5 fill-amber-400" />
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
            {testimonials.map((t, idx) => (
              <div 
                key={idx} 
                className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-8 flex flex-col justify-between"
              >
                <div>
                  <Quote className="w-8 h-8 text-violet-500/20 mb-4" />
                  <p className="text-zinc-300 text-sm leading-relaxed italic mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={t.avatar} 
                    alt={t.author} 
                    className="w-10 h-10 rounded-full object-cover border border-zinc-800"
                  />
                  <div>
                    <h4 className="text-white font-bold text-sm">{t.author}</h4>
                    <p className="text-zinc-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section Component */}
      <PricingSection />

      {/* FAQ Section Component */}
      <FaqSection />
    </div>
  );
}
