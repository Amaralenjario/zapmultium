"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const SPEEDS = [1, 1.5, 2];

export default function AudioPlayer({ src, onAccent }: { src: string; onAccent?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => { setDuration(audio.duration); setLoaded(true); };
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onError = () => setLoaded(true);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    audio.load();

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => {}); }
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration > 0) {
      audioRef.current.currentTime = pct * duration;
      setCurrentTime(pct * duration);
    }
  }, [duration]);

  const nextSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  }, [speed]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = "audio.mp3";
    a.click();
  };

  const fillColor = onAccent ? "#ffffff" : "var(--accent)";
  const idleColor = onAccent ? "rgba(255,255,255,0.35)" : "var(--track)";
  const playBtn = onAccent ? "bg-white/20 text-white hover:bg-white/30" : "bg-accent text-white hover:bg-accent2";
  const timeText = onAccent ? "text-white/70" : "text-tx3";
  const chipBtn = onAccent ? "bg-white/15 text-white hover:bg-white/25" : "bg-surface2 text-tx2 hover:bg-hover";
  const dlBtn = onAccent ? "text-white/70 hover:text-white hover:bg-white/15" : "text-tx3 hover:text-tx hover:bg-hover";

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 min-w-[240px] max-w-[300px]">
      <audio ref={audioRef} src={src} preload="auto" className="hidden" />

      <button onClick={toggle} className={`w-10 h-10 rounded-full flex items-center justify-center transition flex-shrink-0 shadow-md ${playBtn}`}>
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-0.5 h-8 mb-1.5">
          {[...Array(16)].map((_, i) => {
            const h = 30 + Math.sin(i * 0.8) * 25 + ((i * 7) % 10);
            const active = (i / 16) * 100 <= progress;
            return (
              <div key={i} className="flex-1 rounded-full transition-all duration-200" style={{
                height: `${h}%`,
                backgroundColor: active ? fillColor : idleColor,
              }} />
            );
          })}
        </div>

        <div className="relative h-1.5 rounded-full cursor-pointer overflow-hidden group" style={{ backgroundColor: idleColor }} onClick={seek}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-100" style={{ width: `${progress}%`, backgroundColor: fillColor }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow opacity-0 group-hover:opacity-100 transition" style={{ left: `calc(${progress}% - 6px)`, backgroundColor: fillColor }} />
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[11px] tabular-nums w-10 ${timeText}`}>{formatTime(currentTime)}</span>
          <span className={`text-[11px] tabular-nums ${timeText}`}>{loaded ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      <button onClick={nextSpeed} className={`w-8 h-6 rounded-md text-[10px] font-bold transition flex-shrink-0 flex items-center justify-center ${chipBtn}`} title={`Velocidade ${speed}x`}>{speed}x</button>

      <button onClick={handleDownload} className={`w-8 h-8 rounded-full flex items-center justify-center transition flex-shrink-0 ${dlBtn}`} title="Baixar áudio">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      </button>
    </div>
  );
}
