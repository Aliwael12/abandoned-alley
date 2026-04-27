"use client";

import { useEffect, useRef } from "react";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const t = sessionStorage.getItem("aa-audio-time");
    if (t) a.currentTime = parseFloat(t);
    const onTime = () =>
      sessionStorage.setItem("aa-audio-time", String(a.currentTime));
    a.addEventListener("timeupdate", onTime);

    // Try to autoplay. Modern browsers block unmuted autoplay until the user
    // interacts with the page, so if it fails we wait for the first user
    // gesture (click / keydown / touch) and start playback then.
    let unlocked = false;
    const tryPlay = () => {
      a.play()
        .then(() => {
          unlocked = true;
        })
        .catch(() => {
          /* will retry on first user gesture */
        });
    };

    tryPlay();

    const onGesture = () => {
      if (unlocked) return;
      tryPlay();
    };
    window.addEventListener("pointerdown", onGesture, { once: false });
    window.addEventListener("keydown", onGesture, { once: false });

    return () => {
      a.removeEventListener("timeupdate", onTime);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      src="/placeholders/track.mp3"
      loop
      autoPlay
      preload="auto"
      aria-hidden
    />
  );
}
