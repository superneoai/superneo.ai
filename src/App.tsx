import { useCallback, useEffect, useRef, useState } from "react";
import { LatentField } from "./LatentField";
import { SoundtrackController } from "./Soundtrack";

const stages = [
  { title: "LATENT", line: "Possibility, compressed." },
  { title: "INFERENCE", line: "Signals converge on a path." },
  { title: "EMERGENCE", line: "New structure appears between them." },
  { title: "SUPERNEO", line: "The structure remains open." },
];

const progressStages = ["01 LATENT", "02 INFER", "03 EMERGE", "04 NEO"];

function renderStageMeter(progress: number) {
  const exact = Math.min(12, Math.max(0, progress * 12));
  const filled = Math.floor(exact);
  const head = filled < 12 && exact > filled ? "▓" : "";
  return "█".repeat(filled) + head + "░".repeat(12 - filled - head.length);
}

function ProcessTrace({ stage }: { stage: number }) {
  const iterationRef = useRef<HTMLOutputElement>(null);
  const deltaRef = useRef<HTMLOutputElement>(null);
  const bitsRef = useRef<HTMLOutputElement>(null);
  const motionScopeRef = useRef<HTMLOutputElement>(null);
  const blockRefs = useRef<Array<HTMLOutputElement | null>>([]);
  const percentRefs = useRef<Array<HTMLOutputElement | null>>([]);

  useEffect(() => {
    let scrollFrame = 0;
    const scopeGlyphs = "▁▂▃▄▅▆▇█";
    const scopeSamples = new Array<number>(12).fill(0);

    const syncScrollProgress = () => {
      scrollFrame = 0;
      const scrollRange = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1,
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
      const percentage = Math.round(progress * 100);
      const binary = percentage.toString(2).padStart(24, "0");
      progressStages.forEach((_, index) => {
        const stageProgress = Math.min(1, Math.max(0, progress * 4 - index));
        const stagePercentage = Math.round(stageProgress * 100);
        const blocks = renderStageMeter(stageProgress);
        if (blockRefs.current[index]) blockRefs.current[index].value = blocks;
        if (percentRefs.current[index]) {
          percentRefs.current[index].value =
            `${stagePercentage.toString().padStart(3, " ")}%`;
        }
      });
      if (bitsRef.current) {
        bitsRef.current.value = binary.match(/.{8}/g)?.join(" ") ?? binary;
      }
    };

    const queueScrollProgress = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(syncScrollProgress);
    };

    const syncMotion = (event: Event) => {
      const { iteration, delta } = (event as CustomEvent<{
        iteration: number;
        delta: number;
      }>).detail;
      if (iterationRef.current) {
        iterationRef.current.value = iteration.toString().padStart(4, "0");
      }
      if (deltaRef.current) deltaRef.current.value = delta.toFixed(3);
      scopeSamples.shift();
      scopeSamples.push(Math.min(1, Math.max(0, (delta - 0.006) / 0.094)));
      if (motionScopeRef.current) {
        motionScopeRef.current.value = scopeSamples
          .map((sample) => scopeGlyphs[Math.round(sample * (scopeGlyphs.length - 1))])
          .join("");
      }
    };

    syncScrollProgress();
    window.addEventListener("scroll", queueScrollProgress, { passive: true });
    window.addEventListener("superneo:motion", syncMotion);
    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", queueScrollProgress);
      window.removeEventListener("superneo:motion", syncMotion);
    };
  }, []);

  return (
    <aside
      className="process-trace"
      data-no-scene="true"
      aria-label="Live system status and soundtrack controls"
    >
      <div className="process-head">
        <div className="process-readouts" aria-hidden="true">
          <span className="process-state"><i /> FORM / LIVE</span>
          <span>ITER <output ref={iterationRef}>0024</output></span>
          <span>Δ <output ref={deltaRef}>0.031</output></span>
        </div>
        <SoundtrackController stage={stage} />
      </div>
      <span className="bit-loader" aria-hidden="true">
        <output ref={bitsRef}>00000000 00000000 00000000</output>
        <i />
      </span>
      <div className="process-body" aria-hidden="true">
        <div className="block-stack">
          {progressStages.map((label, index) => (
            <span className="block-loader" key={label}>
              <b>{label}</b>
              <output
                className="block-meter"
                ref={(element) => { blockRefs.current[index] = element; }}
              >░░░░░░░░░░░░</output>
              <output
                className="block-percent"
                ref={(element) => { percentRefs.current[index] = element; }}
              >  0%</output>
            </span>
          ))}
        </div>
        <div className="signal-monitor">
          <span>MOTION</span>
          <output className="motion-scope" ref={motionScopeRef}>▁▁▁▁▁▁▁▁▁▁▁▁</output>
          <span className="signal-phase">PHASE <output>0{stage + 1}</output></span>
        </div>
      </div>
    </aside>
  );
}

export function App() {
  const [discovered, setDiscovered] = useState(false);
  const [stage, setStage] = useState(0);
  const handleDiscover = useCallback(() => setDiscovered(true), []);
  const handleStageChange = useCallback((nextStage: number) => setStage(nextStage), []);
  const activeStage = stages[stage];

  return (
    <main className="experience">
      <LatentField onDiscover={handleDiscover} onStageChange={handleStageChange} />
      <div className="technical-frame" aria-hidden="true" />

      <header className="site-header">
        <h1>superneo.ai</h1>
        <div className="header-instruments">
          <ProcessTrace stage={stage} />
        </div>
      </header>

      <p className="making-line">in the making.</p>

      <section className="stage-panel" aria-live="polite">
        <p className="stage-index">0{stage + 1} / 04</p>
        <div className="stage-stack">
          {stages.map((item, index) => (
            <h2
              key={item.title}
              data-state={index === stage ? "active" : index < stage ? "complete" : "pending"}
              data-depth={index - stage}
              data-order={index}
              aria-current={index === stage ? "step" : undefined}
            >
              {item.title === "SUPERNEO" ? (
                <>SUPER<span className="neo-accent">NEO</span></>
              ) : item.title}
            </h2>
          ))}
        </div>
        <p className="stage-line">{activeStage.line}</p>
      </section>

      <div className="scroll-rail" aria-hidden="true">
        <span className="scroll-rail-fill" />
      </div>

      <div className="scroll-cue" data-hidden={discovered} aria-hidden="true">
        <span>SCROLL</span>
        <i />
      </div>

      <footer className="site-footer">
        <p className="status-line" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span className="discovery-copy" data-found={discovered}>
            {discovered ? "YOU FOUND IT." : "█"}
          </span>
        </p>

        <div className="footer-links">
          <a
            className="contact-link x-link"
            href="https://x.com/superneoai"
            target="_blank"
            rel="noreferrer"
            aria-label="Superneo on X"
          >
            <span className="x-mark" aria-hidden="true">𝕏</span>
            <span>@superneoai</span>
          </a>
          <a className="contact-link" href="mailto:hello@superneo.ai">
            hello@superneo.ai
          </a>
        </div>
      </footer>

      <div className="scroll-runway" aria-hidden="true" />
    </main>
  );
}
