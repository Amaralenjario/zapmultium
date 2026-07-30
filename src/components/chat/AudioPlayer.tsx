"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const SPEEDS = [1, 1.5, 2];

export default function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

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
    if (audioRef.current) {
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

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 min-w-[240px] max-w-[300px]">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      {/* Play/Pause */}
      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full bg-[#075e54] text-white flex items-center justify-center hover:bg-[#064e46] transition flex-shrink-0 shadow-md"
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      {/* Waveform + Progress */}
      <div className="flex-1 min-w-0">
        {/* Barras de waveform decorativas */}
        <div className="flex items-end gap-0.5 h-8 mb-1.5">
          {[...Array(16)].map((_, i) => {
            const h = 30 + Math.sin(i * 0.8) * 25 + Math.random() * 10;
            const active = (i / 16) * 100 <= progress;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors"
                style={{
                  height: `${h}%`,
                  backgroundColor: active ? "#075e54" : "#d1d5db",
                  opacity: active ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>

        {/* Progresso */}
        <div
          className="relative h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full cursor-pointer overflow-hidden group"
          onClick={seek}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[#075e54] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#075e54] rounded-full shadow opacity-0 group-hover:opacity-100 transition"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        {/* Tempos + ações */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums w-10">
            {formatTime(currentTime)}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Velocidade */}
      <button
        onClick={nextSpeed}
        className="w-8 h-6 rounded-md bg-gray-200 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition flex-shrink-0 flex items-center justify-center"
        title={`Velocidade ${speed}x`}
      >
        {speed}x
      </button>

      {/* Download */}
      <button
        onClick={handleDownload}
        className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition flex-shrink-0"
        title="Baixar áudio"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    </div>
  );
}
