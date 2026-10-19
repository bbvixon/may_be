import { useEffect, useRef, useState } from "react";

type SpeechResult = {
  0: { transcript: string };
  isFinal: boolean;
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type Options = {
  onTranscript: (text: string) => void;
  onComplete: (text: string) => void;
  onError: (message: string) => void;
};

export function useSpeechInput(options: Options) {
  const callbacks = useRef(options);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  callbacks.current = options;

  useEffect(() => () => recognition.current?.abort(), []);

  function start() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      callbacks.current.onError("Voice input is not supported in this preview browser. Open may.be in Chrome or Edge, or type below.");
      return false;
    }

    const instance = new Recognition();
    let finalText = "";
    instance.continuous = false;
    instance.interimResults = true;
    instance.lang = "en-IN";
    instance.onresult = (event) => {
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      callbacks.current.onTranscript(`${finalText} ${interimText}`.trim());
    };
    instance.onerror = (event) => {
      const message = event.error === "not-allowed"
        ? "Microphone access was not allowed. Enable it for this site or type below."
        : "I couldn't hear that clearly. Try again or type below.";
      callbacks.current.onError(message);
    };
    instance.onend = () => {
      recognition.current = null;
      setIsListening(false);
      const transcript = finalText.trim();
      if (transcript) callbacks.current.onComplete(transcript);
    };
    recognition.current = instance;
    setIsListening(true);
    instance.start();
    return true;
  }

  function stop() {
    recognition.current?.stop();
  }

  return { isListening, start, stop };
}
