import React from "react";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white flex flex-col justify-between overflow-hidden">
      {/* Background Neon Glows */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-fuchsia-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />

      <MarketingNavbar />
      <main className="flex-1 relative z-10">{children}</main>
      <MarketingFooter />
    </div>
  );
}
