"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface AudioTrack { src: string; title: string }

interface AudioCtx {
  current: AudioTrack | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  isActive: (src: string) => boolean;
  toggle: (track: AudioTrack, knownDuration?: number) => void;
  seekFraction: (f: number) => void;
  cycleSpeed: () => void;
  close: () => void;
}

const Ctx = createContext<AudioCtx | null>(null);

export function useGlobalAudio(): AudioCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGlobalAudio precisa do <GlobalAudioProvider>");
  return c;
}

const SPEEDS = [1, 1.5, 2];
const fmt = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60), x = Math.floor(s % 60);
  return `${m}:${String(x).padStart(2, "0")}`;
};

const PlayIcon = () => <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
const PauseIcon = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>;

// Um único <audio> que vive no layout — não desmonta ao trocar de conversa/página,
// então o áudio continua tocando. Uma barra flutuante controla o que está tocando.
export default function GlobalAudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<AudioTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed, current]);

  const toggle = useCallback((track: AudioTrack, knownDuration?: number) => {
    const a = audioRef.current;
    if (!a) return;
    if (current?.src === track.src) {
      if (a.paused) a.play().catch(() => {}); else a.pause();
      return;
    }
    setCurrent(track);
    setCurrentTime(0);
    if (knownDuration) setDuration(knownDuration);
    a.src = track.src;
    a.playbackRate = speed;
    a.load();
    a.play().catch(() => {});
  }, [current, speed]);

  const seekFraction = useCallback((f: number) => {
    const a = audioRef.current;
    if (a && a.duration) {
      a.currentTime = Math.max(0, Math.min(1, f)) * a.duration;
      setCurrentTime(a.currentTime);
    }
  }, []);

  const cycleSpeed = useCallback(() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]), []);

  const close = useCallback(() => {
    const a = audioRef.current;
    if (a) { a.pause(); a.removeAttribute("src"); a.load(); }
    setCurrent(null); setPlaying(false); setCurrentTime(0); setDuration(0);
  }, []);

  const isActive = useCallback((src: string) => current?.src === src, [current]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Ctx.Provider value={{ current, playing, currentTime, duration, speed, isActive, toggle, seekFraction, cycleSpeed, close }}>
      {children}
      <audio ref={audioRef} preload="none" className="hidden" />

      {/* Barra flutuante — continua visível/controlável mesmo saindo da conversa */}
      {current && (
        <div className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] rounded-2xl border border-bd bg-surface shadow-pop p-3 flex items-center gap-3">
          <button onClick={() => toggle(current)} className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 shadow-md hover:bg-accent2 transition" title={playing ? "Pausar" : "Tocar"}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[12px] font-bold text-tx truncate flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${playing ? "bg-success animate-pulse" : "bg-tx3"}`} />
                {current.title}
              </p>
              <button onClick={cycleSpeed} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface2 text-tx2 hover:bg-hover transition flex-shrink-0" title={`Velocidade ${speed}x`}>{speed}x</button>
            </div>
            <div className="relative h-1.5 rounded-full cursor-pointer overflow-hidden" style={{ backgroundColor: "var(--track)" }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seekFraction((e.clientX - r.left) / r.width); }}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] tabular-nums text-tx3">
              <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded-full text-tx3 hover:text-red-500 hover:bg-hover transition flex-shrink-0" title="Fechar player">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
