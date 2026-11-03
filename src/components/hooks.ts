"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
export function useDictation(onText: (text: string, phraseDone: boolean) => void) {
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
      // phraseDone: the recogniser finished a phrase (no words still being guessed).
      onTextRef.current((baseRef.current + finalRef.current + interim).replace(/\s+/g, " ").trimStart(), !interim);
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

  /** Stop at once and drop words still being recognised (used by Undo, so they are not added back). */
  const abort = useCallback(() => {
    wantRef.current = false;
    recRef.current?.abort();
    setListening(false);
  }, []);

  return { supported, listening, seconds, error, start, stop, abort };
}

/* ---------------- Undo / redo for the answer box ---------------- */

type HistoryState = { value: string; stack: string[]; index: number };
type HistoryAction =
  | { type: "set"; value: string; commit: boolean }
  | { type: "commit" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: string };

const MAX_STEPS = 100;

function commitValue(h: HistoryState): HistoryState {
  if (h.stack[h.index] === h.value) return h;
  // A new step drops anything that could have been redone.
  const stack = [...h.stack.slice(0, h.index + 1), h.value].slice(-MAX_STEPS);
  return { ...h, stack, index: stack.length - 1 };
}

function historyReducer(h: HistoryState, a: HistoryAction): HistoryState {
  switch (a.type) {
    case "set": {
      const next = { ...h, value: a.value };
      return a.commit ? commitValue(next) : next;
    }
    case "commit":
      return commitValue(h);
    case "undo": {
      const c = commitValue(h);
      return c.index === 0 ? c : { ...c, index: c.index - 1, value: c.stack[c.index - 1] };
    }
    case "redo":
      if (h.value !== h.stack[h.index] || h.index >= h.stack.length - 1) return commitValue(h);
      return { ...h, index: h.index + 1, value: h.stack[h.index + 1] };
    case "reset":
      return { value: a.value, stack: [a.value], index: 0 };
  }
}

/**
 * Text with undo/redo steps. Each finished spoken phrase is one step; a burst of
 * typing becomes one step after a short pause.
 */
export function useUndoableText(initial = "") {
  const [h, dispatch] = useReducer(historyReducer, { value: initial, stack: [initial], index: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  /** "type": typed edit, "interim": words still being recognised, "phrase": a finished spoken phrase. */
  const set = useCallback((value: string, kind: "type" | "interim" | "phrase") => {
    clearTimer();
    dispatch({ type: "set", value, commit: kind === "phrase" });
    if (kind === "type") timer.current = setTimeout(() => dispatch({ type: "commit" }), 800);
  }, []);
  const undo = useCallback(() => {
    clearTimer();
    dispatch({ type: "undo" });
  }, []);
  const redo = useCallback(() => {
    clearTimer();
    dispatch({ type: "redo" });
  }, []);
  const reset = useCallback((value = "") => {
    clearTimer();
    dispatch({ type: "reset", value });
  }, []);

  return {
    value: h.value,
    set,
    undo,
    redo,
    reset,
    canUndo: h.index > 0 || h.value !== h.stack[h.index],
    canRedo: h.value === h.stack[h.index] && h.index < h.stack.length - 1,
  };
}
