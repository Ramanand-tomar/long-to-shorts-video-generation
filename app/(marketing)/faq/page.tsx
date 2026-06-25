import React from "react";
import FaqSection from "@/components/FaqSection";

export const metadata = {
  title: "Frequently Asked Questions | VidShort",
  description: "Have questions about VidShort? Find answers to commonly asked questions about video limits, AI clipping, billing, and integrations.",
};

export default function FaqPage() {
  return (
    <div className="py-12 relative z-10">
      <FaqSection />
    </div>
  );
}
