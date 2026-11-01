import { useState, useEffect, useCallback, useRef } from 'react';

type SttDetail = { type: 'ready' | 'result' | 'end' | 'error'; ok?: boolean; text?: string; message?: string };

/** Push-to-talk: browser SpeechRecognition, or native bridge via HoopStat WebView. */
export const useSpeechRecognition = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  const listeningRef = useRef(false);
  const bridgeRef = useRef(false);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const setListening = (on: boolean) => {
      listeningRef.current = on;
      setIsListening(on);
    };

    const onBridge = (e: Event) => {
      const d = (e as CustomEvent<SttDetail>).detail;
      if (!d) return;
      if (d.type === 'ready') {
        bridgeRef.current = !!d.ok;
        if (d.ok) setSupported(true);
      } else if (d.type === 'result' && d.text?.trim()) {
        onResultRef.current(d.text.trim());
      } else if (d.type === 'end' || d.type === 'error') {
        setListening(false);
      }
    };
    window.addEventListener('hoopstat-stt', onBridge);

    const rn = (window as any).ReactNativeWebView;
    if (rn?.postMessage) {
      rn.postMessage(JSON.stringify({ type: 'stt', action: 'probe' }));
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'id-ID';
      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) onResultRef.current(transcript);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      setSupported(true);
    } else if (!rn) {
      setSupported(false);
    }

    return () => window.removeEventListener('hoopstat-stt', onBridge);
  }, []);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;

    const rn = (window as any).ReactNativeWebView;
    if (bridgeRef.current && rn?.postMessage) {
      listeningRef.current = true;
      setIsListening(true);
      rn.postMessage(JSON.stringify({ type: 'stt', action: 'start' }));
      return;
    }

    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      listeningRef.current = true;
      setIsListening(true);
      rec.start();
    } catch (e) {
      console.error('Failed to start recognition', e);
      listeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!listeningRef.current) return;

    const rn = (window as any).ReactNativeWebView;
    if (bridgeRef.current && rn?.postMessage) {
      rn.postMessage(JSON.stringify({ type: 'stt', action: 'stop' }));
      return;
    }

    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch (e) {
      console.error('Failed to stop recognition', e);
      listeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  return { isListening, startListening, stopListening, supported };
};
