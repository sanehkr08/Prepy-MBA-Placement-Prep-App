"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Profile } from "@/lib/schemas";

export type SavedProfile = { raw_text: string; data: Profile; updated_at: string } | null;

export function useProfile() {
  const [profile, setProfile] = useState<SavedProfile>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => {
    api<{ profile: SavedProfile }>("/api/profile")
      .then((r) => setProfile(r.profile))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { profile, setProfile, loaded, reload };
}

/* ---------------- Voice dictation (Web Speech API) ---------------- */

type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictation: streams speech into text. `base` is the text already in the box;
 * new speech is appended after it. The transcript stays editable.
 */
export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");
  const finalRef = useRef("");
  const wantRef = useRef(false);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    // Feature detection must run in the browser after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!getRecognitionCtor());
    return () => {
      wantRef.current = false;
      recRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [listening]);

  const start = useCallback((currentText: string) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setError(null);
    baseRef.current = currentText.trim() ? currentText.trim() + " " : "";
    finalRef.current = "";
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      onTextRef.current((baseRef.current + finalRef.current + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow the mic for this site in your browser, or type your answer.");
        wantRef.current = false;
      } else if (e.error === "no-speech") {
        /* silence: keep listening */
      } else if (e.error !== "aborted") {
        setError(`Voice input stopped (${e.error}). You can start again or type.`);
      }
    };
    rec.onend = () => {
      // Chrome stops after silence; restart while the user still wants to dictate.
      if (wantRef.current) {
        baseRef.current = (baseRef.current + finalRef.current).replace(/\s+/g, " ");
        finalRef.current = "";
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };
    recRef.current = rec;
    wantRef.current = true;
    setSeconds(0);
    setListening(true);
    rec.start();
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, seconds, error, start, stop };
}
