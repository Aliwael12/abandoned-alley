Drop replacement assets here:

- logo.glb        — 3D rotating header logo (referenced by Logo3D.tsx)
- track.mp3       — looping background track for the floating music player (MusicPlayer.tsx)
- intro.mp4       — full-screen intro video (IntroVideo.tsx is already wired up; just swap the placeholder div)
- lightning.gif   — animated lightning background to replace the SVG fallback in LightningBackground.tsx

Until the real files are dropped here:
  - Logo3D shows an "AA" letter fallback if the .glb is missing
  - MusicPlayer is silent (the audio element loads on click)
  - IntroVideo shows a styled gradient placeholder
  - LightningBackground uses an animated SVG bolt
