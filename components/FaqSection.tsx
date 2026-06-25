"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqItems = [
    {
      q: "What video formats are supported?",
      a: "We support MP4, MOV, WebM, and M4V files. Standard modern codecs like H.264/AAC are recommended for best performance.",
    },
    {
      q: "How long does AI analysis take?",
      a: "Typically 1 to 3 minutes depending on the length of your source video. The analysis runs entirely in the background so you can close the tab and return later.",
    },
    {
      q: "Can I edit the clips before rendering?",
      a: "Absolutely. You can adjust the start and end times down to the frame, customize caption text, and select from several text themes, positions, and animations.",
    },
    {
      q: "Which social platforms are supported?",
      a: "You can connect and schedule posts directly to TikTok, Instagram Reels, and YouTube Shorts, with Facebook and LinkedIn connections coming soon.",
    },
    {
      q: "Is there a limit on file size?",
      a: "Free tier accounts support uploads up to 200MB or 15 minutes of video. Pro accounts support up to 2GB uploads or 2 hours of high-definition video.",
    },
    {
      q: "What AI models are used for clipping?",
      a: "We use state-of-the-art Gemini Pro models to read transcripts, identify contextually complete highlights, detect punchlines, and calculate hook scores.",
    },
  ];

  return (
    <section id="faq" className="py-24 px-6 max-w-4xl mx-auto bg-transparent scroll-mt-20">
      <div className="text-center mb-16">
        <span className="text-violet-500 text-sm font-bold tracking-widest uppercase block mb-3">
          FAQ
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-zinc-400 mt-4 text-sm sm:text-base">
          Everything you need to know about our video generation software and billing policies.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {faqItems.map((item, idx) => {
          const isOpen = openFaq === idx;
          return (
            <div 
              key={idx} 
              className="border border-zinc-900 bg-zinc-900/10 rounded-2xl overflow-hidden transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full text-left px-6 py-5 flex justify-between items-center text-white hover:bg-zinc-900/20 transition-colors cursor-pointer"
              >
                <span className="font-bold text-sm sm:text-base pr-4">{item.q}</span>
                <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform ${isOpen ? "rotate-180 text-violet-400" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-6 pb-6 text-zinc-400 text-xs sm:text-sm leading-relaxed border-t border-zinc-950/60 pt-4 animate-in fade-in duration-200">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
