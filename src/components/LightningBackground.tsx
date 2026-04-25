export default function VideoBackground() {
  return (
    <div className="lightning-bg" aria-hidden>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/media/white-ddw-1.jpg"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: "blur(2px) brightness(0.7)",
          objectPosition: "center 15%",
        }}
      >
        <source src="/media/white-ddw.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
    </div>
  );
}
