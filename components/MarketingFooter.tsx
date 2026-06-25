import React from "react";
import Link from "next/link";
import { Play } from "lucide-react";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-zinc-950 bg-zinc-950/40 py-12 px-6 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            VidShort
          </span>
        </Link>

        <div className="flex flex-wrap justify-center gap-8 text-xs text-zinc-500 font-medium">
          <Link href="/#how-it-works" className="hover:text-zinc-300 transition-colors">How It Works</Link>
          <Link href="/#features" className="hover:text-zinc-300 transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-zinc-300 transition-colors">Pricing</Link>
          <Link href="/faq" className="hover:text-zinc-300 transition-colors">FAQ</Link>
          <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
        </div>

        <p className="text-zinc-600 text-xs">
          &copy; {new Date().getFullYear()} VidShort. Built for creators.
        </p>
      </div>
    </footer>
  );
}
