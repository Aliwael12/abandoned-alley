"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Persist time across navigation in same session
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = sessionStorage.getItem("aa-audio-time");
    if (t) a.currentTime = parseFloat(t);
    const onTime = () => sessionStorage.setItem("aa-audio-time", String(a.currentTime));
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 right-5 z-30 interactive">
      <audio
        ref={audioRef}
        src="/placeholders/track.mp3"
        loop
        preload="none"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause music" : "Play music"}
        className="w-14 h-14 rounded-full glass border border-white/15 grid place-items-center hover:scale-105 transition shadow-2xl shadow-black/60"
      >
        {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
      </button>
    </div>
  );
}
