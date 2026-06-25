import React from "react";

export const metadata = {
  title: "Privacy Policy | VidShort",
  description: "Privacy Policy detailing how VidShort collects, uses, and safeguards your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="py-20 px-6 max-w-4xl mx-auto relative z-10 space-y-8 text-zinc-300">
      <div className="border-b border-zinc-900 pb-6 text-center">
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <p className="text-zinc-500 text-xs sm:text-sm mt-2">Last updated: June 24, 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Information Collected</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          We collect personal data that you provide to us directly, such as your name and email address when registering for an account. We also collect the videos and transcripts you upload, as well as metadata related to rendering jobs, publishing schedules, and API usage stats.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. How We Use Information</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          We use the information we collect to provide, maintain, and optimize the Service, including: transcribing video audio, detecting engaging video segments using AI models, rendering and cropping clips, and automating posts to your connected social channels. We do not sell your personal data or video files to third parties.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. Third-Party Integrations</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          Our Service integrates with trusted third-party providers to deliver key features. By using the Service, you acknowledge and agree that your data will be processed by:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2 text-sm sm:text-base">
          <li><strong>Clerk</strong> for secure user authentication and profile management.</li>
          <li><strong>Cloudinary</strong> for temporary media storage, caching, and processing.</li>
          <li><strong>Deepgram</strong> for voice-to-text transcript processing.</li>
          <li><strong>Google Gemini</strong> for AI virality scoring and clip selection logic.</li>
          <li><strong>Zernio</strong> for secure OAuth social account linkages and API publishing.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Data Retention and Safety</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          We retain your account data and video uploads for as long as your account remains active or as needed to provide you with the Service. We implement industry-standard technical and organizational security measures to protect your data against unauthorized access, loss, or alteration.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">5. Your Choices & Contact Information</h2>
        <p className="text-sm sm:text-base leading-relaxed">
          You have the right to access, update, or delete your personal data at any time. You can delete your connected social channels in the Social settings page, or delete your account entirely. If you have any questions or concerns regarding this Privacy Policy, please contact us at privacy@vidshort.io.
        </p>
      </section>
    </div>
  );
}
