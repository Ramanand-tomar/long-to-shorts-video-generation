import React from "react";
import PricingSection from "@/components/PricingSection";

export const metadata = {
  title: "Pricing | VidShort",
  description: "Simple, creator-friendly pricing. Get started free or upgrade to Pro for unlimited uploads, scheduling, and rendering.",
};

export default function PricingPage() {
  return (
    <div className="py-12 relative z-10">
      <PricingSection />
    </div>
  );
}
