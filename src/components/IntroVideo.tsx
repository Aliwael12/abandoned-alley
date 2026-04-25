"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function IntroVideo() {
  const [stage, setStage] = useState<"hidden" | "ready" | "playing" | "done">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("aa-intro-played")) {
      setStage("done");
      return;
    }
    setStage("ready");
  }, []);

  const enter = () => {
    setStage("playing");
    sessionStorage.setItem("aa-intro-played", "1");
    setTimeout(() => setStage("done"), 4000);
  };

  const skip = () => {
    sessionStorage.setItem("aa-intro-played", "1");
    setStage("done");
  };

  return (
    <AnimatePresence>
      {stage !== "done" && stage !== "hidden" && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[99999] bg-black flex items-center justify-center overflow-hidden"
        >
          {/* Placeholder for the intro video */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-black to-zinc-900 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,_rgba(120,150,255,0.4)_0%,_transparent_60%)] blur-3xl animate-pulse" />
              </div>
              {stage === "playing" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="font-[family-name:var(--font-bebas)] text-white/40 text-sm tracking-[0.4em]">
                    [ INTRO VIDEO PLACEHOLDER ]
                  </p>
                </div>
              )}
            </div>
          </div>

          {stage === "ready" && (
            <button onClick={enter} className="intro-enter-btn z-10" aria-label="Enter site">
              ENTER
            </button>
          )}

          <button
            onClick={skip}
            className="absolute bottom-8 right-8 px-7 py-2.5 rounded-full glass border border-white/20 text-white text-xs font-bold tracking-[0.25em] uppercase hover:scale-105 hover:border-white/50 transition z-10"
          >
            Skip Intro
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
