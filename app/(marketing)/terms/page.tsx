import React from "react";

export const metadata = {
  title: "Terms of Service | VidShort",
  description: "Terms of Service for using the VidShort platform.",
};

export default function TermsPage() {
  return (
    <div className="py-20 px-6 max-w-4xl mx-auto relative z-10 space-y-8 text-zinc-300">
      <div className="border-b border-zinc-900 pb-6 text-center">
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        <p className="text-zinc-500 text-xs sm:text-sm mt-2">Last updated: June 24, 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Acceptance of Terms</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          By accessing or using the VidShort platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, please do not use our Service.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. Description of Service</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          VidShort provides an AI-powered short-form video generation tool that transcribes long videos, identifies engaging clips, allows style customization, renders files, and manages posting schedules. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. User Conduct and Usage Limits</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          You agree to use the Service in compliance with all applicable local, state, national, and international laws. Free tier accounts are limited to 5 video uploads per day and 5 rendering runs per day. Any attempt to bypass usage quotas, execute reverse engineering, or disrupt our systems is strictly prohibited and will result in termination of your account.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Intellectual Property</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          You retain all rights, title, and interest in and to the videos you upload to the Service. VidShort does not claim ownership of your content. However, by uploading content, you grant us a worldwide, non-exclusive, royalty-free license to host, process, transcribe, and render your video for the sole purpose of providing the Service.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">5. Termination</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will cease immediately.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">6. Disclaimers & Limitation of Liability</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          The Service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. VidShort makes no warranties, expressed or implied, regarding the accuracy, completeness, or reliability of the Service or the output video files. In no event shall VidShort be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the Service.
        </p>
      </section>
    </div>
  );
}
