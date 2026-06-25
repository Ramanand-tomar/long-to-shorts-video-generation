"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Play, Menu, X } from "lucide-react";

export default function MarketingNavbar() {
  const { isSignedIn } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-900 bg-[#0a0a0f]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-all">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            VidShort
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <Link href="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
          <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
        </div>

        {/* Nav Actions */}
        <div className="hidden md:flex items-center gap-4">
          {isSignedIn ? (
            <Link href="/dashboard" className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="px-4 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-semibold text-sm transition-all">
                Sign In
              </Link>
              <Link href="/sign-up" className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/25">
                Get Started Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          type="button"
          className="md:hidden p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-950 bg-[#0a0a0f] px-6 py-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-250">
          <Link 
            href="/#how-it-works" 
            onClick={() => setMobileMenuOpen(false)}
            className="text-zinc-400 hover:text-white text-base py-1"
          >
            How It Works
          </Link>
          <Link 
            href="/#features" 
            onClick={() => setMobileMenuOpen(false)}
            className="text-zinc-400 hover:text-white text-base py-1"
          >
            Features
          </Link>
          <Link 
            href="/pricing" 
            onClick={() => setMobileMenuOpen(false)}
            className="text-zinc-400 hover:text-white text-base py-1"
          >
            Pricing
          </Link>
          <Link 
            href="/faq" 
            onClick={() => setMobileMenuOpen(false)}
            className="text-zinc-400 hover:text-white text-base py-1"
          >
            FAQ
          </Link>
          <hr className="border-zinc-900 my-2" />
          <div className="flex flex-col gap-3">
            {isSignedIn ? (
              <Link 
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link 
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-3 rounded-xl border border-zinc-800 text-zinc-300 font-semibold text-sm transition-all"
                >
                  Sign In
                </Link>
                <Link 
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
