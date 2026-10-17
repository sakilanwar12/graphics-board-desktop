"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type RecorderStatus = "idle" | "recording" | "paused";

const MIME_CANDIDATES: [withAudio: string, videoOnly: string][] = [
  ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1"],
  ["video/mp4;codecs=vp9,opus", "video/mp4;codecs=vp9"],
  ["video/mp4;codecs=vp8,opus", "video/mp4;codecs=vp8"],
  ["video/mp4", "video/mp4"],
  ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp9"],
  ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8"],
  ["video/webm", "video/webm"],
];

const VIDEO_BITRATE = 6_000_000;
const AUDIO_BITRATE = 128_000;

function pickMimeType(hasAudio: boolean): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.map(([withAudio, videoOnly]) =>
    hasAudio ? withAudio : videoOnly
  ).find((type) => MediaRecorder.isTypeSupported(type));
}

function fileExtension(mime: string) {
  return mime.includes("mp4") ? "mp4" : "webm";
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

export default function useScreenRecorder({
  onError,
  onSaved,
}: {
  onError: (message: string) => void;
  onSaved: (message: string) => void;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const supported = useSyncExternalStore(
    () => () => {},
    () =>
      Boolean(navigator.mediaDevices?.getDisplayMedia) &&
      typeof MediaRecorder !== "undefined",
    () => true
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const sourcesRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("video/webm");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  const discardRef = useRef(false);
  const startingRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    startedAtRef.current = performance.now();
    stopTimer();
    timerRef.current = setInterval(() => {
      const total =
        accumulatedRef.current + (performance.now() - startedAtRef.current);
      setElapsed(Math.floor(total / 1000));
    }, 250);
  }, [stopTimer]);

  const cleanup = useCallback(() => {
    stopTimer();
    recorderRef.current = null;
    for (const stream of sourcesRef.current) {
      for (const track of stream.getTracks()) track.stop();
    }
    sourcesRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    setStatus("idle");
  }, [stopTimer]);

  const finalize = useCallback(() => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    cleanup();
    if (discardRef.current) {
      discardRef.current = false;
      return;
    }
    const type = chunks[0]?.type || mimeRef.current;
    const blob = new Blob(chunks, { type });
    if (!blob.size) {
      onError("Recording was empty — nothing saved");
      return;
    }
    const ext = fileExtension(type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graphics-board-recording-${timestamp()}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    onSaved(
      ext === "mp4"
        ? "Recording saved as MP4"
        : "Saved as WebM — this browser can't record MP4"
    );
  }, [cleanup, onError, onSaved]);

  const start = useCallback(
    async ({ mic }: { mic: boolean }) => {
      if (recorderRef.current || startingRef.current) return;
      startingRef.current = true;
      try {
        if (
          !navigator.mediaDevices?.getDisplayMedia ||
          typeof MediaRecorder === "undefined"
        ) {
          onError("Screen recording is not supported in this browser");
          return;
        }

        let display: MediaStream;
        try {
          display = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: 30, max: 60 } },
            audio: true,
          });
        } catch {
          onError("Screen share was cancelled");
          return;
        }

        let micStream: MediaStream | null = null;
        if (mic) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
            });
          } catch {
            onError("Microphone unavailable — recording without it");
          }
        }

        const sources = [display];
        if (micStream) sources.push(micStream);
        sourcesRef.current = sources;

        let stream: MediaStream = display;
        const displayAudio = display.getAudioTracks();
        const micAudio = micStream?.getAudioTracks() ?? [];
        if (displayAudio.length && micAudio.length) {
          try {
            const ctx = new AudioContext();
            await ctx.resume().catch(() => {});
            const dest = ctx.createMediaStreamDestination();
            ctx.createMediaStreamSource(new MediaStream(displayAudio)).connect(dest);
            ctx.createMediaStreamSource(new MediaStream(micAudio)).connect(dest);
            audioCtxRef.current = ctx;
            stream = new MediaStream([
              ...display.getVideoTracks(),
              ...dest.stream.getAudioTracks(),
            ]);
          } catch {
            stream = new MediaStream([
              ...display.getVideoTracks(),
              ...displayAudio,
              ...micAudio,
            ]);
          }
        } else if (micAudio.length) {
          stream = new MediaStream([...display.getVideoTracks(), ...micAudio]);
        }

        const videoTrack = display.getVideoTracks()[0];
        if (!videoTrack) {
          cleanup();
          onError("No video track available to record");
          return;
        }

        const mimeType = pickMimeType(stream.getAudioTracks().length > 0);
        mimeRef.current = mimeType ?? "video/webm";
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: VIDEO_BITRATE,
          audioBitsPerSecond: AUDIO_BITRATE,
        };
        if (mimeType) options.mimeType = mimeType;

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, options);
        } catch {
          cleanup();
          onError("Could not start screen recording");
          return;
        }

        discardRef.current = false;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data);
        };
        recorder.onstop = finalize;
        recorder.onerror = () => {
          discardRef.current = true;
          cleanup();
          onError("Recording failed");
        };
        videoTrack.addEventListener("ended", () => {
          const rec = recorderRef.current;
          if (rec && rec.state !== "inactive") rec.stop();
        });

        recorderRef.current = recorder;
        accumulatedRef.current = 0;
        setElapsed(0);
        recorder.start(1000);
        startTimer();
        setStatus("recording");

        try {
          const wakeLock = (
            navigator as Navigator & {
              wakeLock?: {
                request: (type: "screen") => Promise<{
                  release: () => Promise<void>;
                }>;
              };
            }
          ).wakeLock;
          wakeLockRef.current =
            (await wakeLock?.request("screen").catch(() => null)) ?? null;
        } catch {}
      } finally {
        startingRef.current = false;
      }
    },
    [cleanup, finalize, onError, startTimer]
  );

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    accumulatedRef.current += performance.now() - startedAtRef.current;
    stopTimer();
    setStatus("paused");
  }, [stopTimer]);

  const resume = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    startTimer();
    setStatus("recording");
  }, [startTimer]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
  }, []);

  useEffect(() => {
    return () => {
      discardRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {}
      }
      cleanup();
    };
  }, [cleanup]);

  return { status, elapsed, supported, start, pause, resume, stop };
}
