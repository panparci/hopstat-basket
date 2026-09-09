import { useState, useEffect, useCallback, useRef } from 'react';

export const useCommentarySpeech = (onResult: (text: string, isFinal: boolean) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'id-ID';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            onResult(event.results[i][0].transcript, true);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (interimTranscript) {
          onResult(interimTranscript, false);
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setError('not-allowed');
        } else if (event.error !== 'no-speech') {
          setError(event.error);
        }
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };

      rec.onend = () => {
        // Auto-restart if we are supposed to be listening and there was no fatal error like not-allowed
        if (isListening && error !== 'not-allowed') {
          try {
            recognitionRef.current.start();
          } catch (e) {
            setIsListening(false);
          }
        }
      };

      recognitionRef.current = rec;
      setSupported(true);
    } else {
      setSupported(false);
    }
  }, [onResult, isListening, error]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        setError(null);
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start recognition', e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Failed to stop recognition', e);
      }
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, startListening, stopListening, supported, error };
};
