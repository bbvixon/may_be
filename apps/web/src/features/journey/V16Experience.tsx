import { useEffect, useRef, useState } from "react";
import { createJourneyEngine, type JourneyEngine } from "./engine";
import { useSpeechInput } from "./useSpeechInput";

export function V16Experience() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const phoneRef = useRef<HTMLElement>(null);
  const meaningSpaceRef = useRef<HTMLDivElement>(null);
  const passageCopyRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const treeSvgRef = useRef<SVGSVGElement>(null);
  const graphRef = useRef<SVGGElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<JourneyEngine | null>(null);
  const speech = useSpeechInput({
    onTranscript: setInput,
    onComplete: (transcript) => {
      setInput("");
      void engineRef.current?.start(transcript);
    },
    onError: setError,
  });

  useEffect(() => {
    if (!phoneRef.current || !meaningSpaceRef.current || !passageCopyRef.current ||
      !logoRef.current || !treeSvgRef.current || !graphRef.current ||
      !hintRef.current || !undoRef.current) return;

    engineRef.current = createJourneyEngine({
      elements: {
        phone: phoneRef.current,
        meaningSpace: meaningSpaceRef.current,
        passageCopy: passageCopyRef.current,
        logo: logoRef.current,
        treeSvg: treeSvgRef.current,
        graph: graphRef.current,
        hint: hintRef.current,
        undo: undoRef.current,
      },
      onError: setError,
    });

    return () => engineRef.current?.destroy();
  }, []);

  function begin() {
    const submittedInput = input.trim();
    if (!submittedInput) return;
    setInput("");
    void engineRef.current?.start(submittedInput);
  }

  function beginVoice() {
    setError(null);
    if (speech.isListening) {
      speech.stop();
      return;
    }
    if (speech.start()) setInput("");
  }

  return (
    <main className="phone" ref={phoneRef} aria-live="polite">
      <header className="app-header">
        <button className="brand-mini" onClick={() => engineRef.current?.reset()} aria-label="Start again">
          may<span>.</span>be
        </button>
        <button className="undo" ref={undoRef} onClick={() => engineRef.current?.undoChoice()} aria-label="Go back one decision">
          ↶ <span>Undo</span>
        </button>
      </header>

      <section className="scene active intro" data-scene="intro">
        <div className="hello"><h1>Hi, there.</h1><p>Tell me where you’re stuck.</p></div>
        <button className={`mic-button${speech.isListening ? " recording" : ""}`} onClick={beginVoice} aria-label={speech.isListening ? "Stop speaking" : "Start speaking"}>
          <span className="mic-rings" />
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.6 3.6 0 0 0 3.6-3.6V6.4a3.6 3.6 0 1 0-7.2 0v5.2a3.6 3.6 0 0 0 3.6 3.6Zm-6-3.9a1 1 0 0 1 2 0 4 4 0 0 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.91V20h2.2a1 1 0 1 1 0 2H8.8a1 1 0 1 1 0-2H11v-2.79A6 6 0 0 1 6 11.3Z" /></svg>
        </button>
        <div className="tiny-input">
          <input
            aria-label="Type your situation"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") begin(); }}
          />
          <button onClick={begin} aria-label="Send" disabled={!input.trim()}>↑</button>
        </div>
        {error && <p className="journey-error" role="alert">{error}</p>}
      </section>

      <section className="scene listening" data-scene="listening">
        <div className="sound-orb"><i /><i /><i /><span /></div><p>I’m listening</p>
      </section>

      <section className="scene meanings" data-scene="meanings">
        <div className="meaning-space" ref={meaningSpaceRef}><div className="bowl"><i /></div></div>
      </section>

      <section className="scene passage" data-scene="passage">
        <div className="passage-copy" ref={passageCopyRef}><p>You’ve told me the story.</p><h2>Now, let me find<br />the paths.</h2></div>
      </section>

      <section className="scene journey" data-scene="journey">
        <div className="logo-stage" ref={logoRef}><span className="may">may</span><b>.</b><span className="be">be</span></div>
        <svg
          className="tree-svg"
          ref={treeSvgRef}
          viewBox="0 240 430 840"
          role="group"
          aria-label="Decision paths"
          onClick={(event) => engineRef.current?.handleTreeClick(event.target)}
          onKeyDown={(event) => engineRef.current?.handleTreeKeyDown(event.nativeEvent)}
          onPointerOver={(event) => engineRef.current?.handlePointerOver(event.target)}
          onPointerOut={(event) => engineRef.current?.handlePointerOut(event.target)}
          onFocus={(event) => engineRef.current?.handlePointerOver(event.target)}
          onBlur={() => engineRef.current?.clearDetail()}
        >
          <defs>
            <filter id="nodeShadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="12" stdDeviation="15" floodColor="#3b271e" floodOpacity=".10" /></filter>
            <filter id="softBlur"><feGaussianBlur stdDeviation="8" /></filter>
          </defs>
          <g ref={graphRef} />
        </svg>
        <div className="branch-caption" ref={hintRef}>Hover to understand · touch to follow</div>
      </section>
    </main>
  );
}
