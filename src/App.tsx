import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SoundtrackController } from "./Soundtrack";
import { toStageProgress } from "./morphTimeline";
import { STAGE_CHANGE_EVENT, type StageChangeDetail } from "./stageSignal";

const LatentField = lazy(() =>
  import("./LatentField").then(({ LatentField: field }) => ({ default: field })),
);

const stages = [
  { title: "LATENT", line: "Possibility, compressed." },
  { title: "INFERENCE", line: "Signals converge on a path." },
  { title: "EMERGENCE", line: "New structure appears between them." },
  { title: "SUPERNEO", line: "The structure remains open." },
];

const progressStages = ["01 LATENT", "02 INFER", "03 EMERGE", "04 NEO"];
const neoSignFullUrl = new URL("neo-sign-full.png", document.baseURI).href;
const neoSignMediumUrl = new URL("neo-sign-medium.png", document.baseURI).href;
const neoSignFaultLowUrl = new URL("neo-sign-fault-low.png", document.baseURI).href;
const desktopArtworkUrl = new URL("latent-field.jpg", document.baseURI).href;
const mobileArtworkUrl = new URL("latent-field-mobile.jpg", document.baseURI).href;

function ScenePoster() {
  return (
    <div className="signal-poster" aria-hidden="true">
      <div
        className="signal-artwork-fallback signal-artwork-fallback--desktop"
        style={{ backgroundImage: `url(${desktopArtworkUrl})` }}
      />
      <div
        className="signal-artwork-fallback signal-artwork-fallback--mobile"
        style={{ backgroundImage: `url(${mobileArtworkUrl})` }}
      />
    </div>
  );
}

function StageWord({ title }: { title: string }) {
  if (title !== "SUPERNEO") return <>{title}</>;

  return (
    <span className="superneo-word">
      <span className="super-prefix">SUPER</span>
      <span className="neo-accent">
        <span className="neo-source" aria-hidden="true">NEO</span>
        <img
          className="neo-sign neo-sign--full"
          src={neoSignFullUrl}
          width="1000"
          height="640"
          decoding="async"
          loading="eager"
          fetchPriority="high"
          draggable="false"
          alt=""
          aria-hidden="true"
        />
        <img
          className="neo-sign neo-sign--medium"
          src={neoSignMediumUrl}
          width="1000"
          height="640"
          decoding="async"
          loading="eager"
          draggable="false"
          alt=""
          aria-hidden="true"
        />
        <img
          className="neo-sign neo-sign--fault-low"
          src={neoSignFaultLowUrl}
          width="1000"
          height="640"
          decoding="async"
          loading="eager"
          draggable="false"
          alt=""
          aria-hidden="true"
        />
      </span>
    </span>
  );
}

function renderStageMeter(progress: number) {
  const exact = Math.min(12, Math.max(0, progress * 12));
  const filled = Math.floor(exact);
  const head = filled < 12 && exact > filled ? "▓" : "";
  return "█".repeat(filled) + head + "░".repeat(12 - filled - head.length);
}

function ProcessTrace() {
  const iterationRef = useRef<HTMLOutputElement>(null);
  const deltaRef = useRef<HTMLOutputElement>(null);
  const bitsRef = useRef<HTMLOutputElement>(null);
  const motionScopeRef = useRef<HTMLOutputElement>(null);
  const phaseRef = useRef<HTMLOutputElement>(null);
  const blockRefs = useRef<Array<HTMLOutputElement | null>>([]);
  const percentRefs = useRef<Array<HTMLOutputElement | null>>([]);

  useEffect(() => {
    let scrollFrame = 0;
    let scrollRange = 1;
    let previousPercentage = -1;
    const scopeGlyphs = "▁▂▃▄▅▆▇█";
    const scopeSamples = new Array<number>(12).fill(0);

    const updateScrollRange = () => {
      scrollRange = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1,
      );
    };

    const syncScrollProgress = () => {
      scrollFrame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
      const percentage = Math.round(progress * 100);
      if (percentage === previousPercentage) return;
      previousPercentage = percentage;
      const binary = percentage.toString(2).padStart(24, "0");
      progressStages.forEach((_, index) => {
        const stageProgress = toStageProgress(progress, index);
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

    const syncStage = (event: Event) => {
      const { stage } = (event as CustomEvent<StageChangeDetail>).detail;
      if (phaseRef.current) phaseRef.current.value = `0${stage + 1}`;
    };

    updateScrollRange();
    syncScrollProgress();
    window.addEventListener("scroll", queueScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollRange, { passive: true });
    window.addEventListener("superneo:motion", syncMotion);
    window.addEventListener(STAGE_CHANGE_EVENT, syncStage);
    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", queueScrollProgress);
      window.removeEventListener("resize", updateScrollRange);
      window.removeEventListener("superneo:motion", syncMotion);
      window.removeEventListener(STAGE_CHANGE_EVENT, syncStage);
    };
  }, []);

  return (
    <aside
      className="process-trace"
      data-no-scene="true"
      aria-label="Live system status and soundtrack controls"
    >
      <div className="process-head">
        <span className="process-state" aria-hidden="true"><i /> FORM / LIVE</span>
        <SoundtrackController />
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
          <div className="signal-readouts">
            <span>ITER <output ref={iterationRef}>0024</output></span>
            <span>Δ <output ref={deltaRef}>0.031</output></span>
            <span>PHASE <output ref={phaseRef}>01</output></span>
          </div>
          <div className="signal-activity">
            <span>MOTION</span>
            <output className="motion-scope" ref={motionScopeRef}>▁▁▁▁▁▁▁▁▁▁▁▁</output>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StagePanel() {
  const stackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const headingRefs = useRef<Array<HTMLHeadingElement | null>>([]);

  useEffect(() => {
    const syncStage = (event: Event) => {
      const { stage, previous } = (event as CustomEvent<StageChangeDetail>).detail;
      if (stackRef.current) {
        stackRef.current.dataset.direction = stage > previous ? "forward" : "backward";
      }
      if (indexRef.current) indexRef.current.textContent = `0${stage + 1} / 04`;
      if (lineRef.current) lineRef.current.textContent = stages[stage].line;

      headingRefs.current.forEach((heading, index) => {
        if (!heading) return;
        heading.dataset.state = index === stage
          ? "active"
          : index < stage ? "complete" : "pending";
        heading.dataset.depth = String(index - stage);
        if (index === stage) heading.setAttribute("aria-current", "step");
        else heading.removeAttribute("aria-current");
      });
    };

    let disposed = false;
    const signs = Array.from(
      stackRef.current?.querySelectorAll<HTMLImageElement>(".neo-sign") ?? [],
    );
    if (signs.length > 0) {
      const requestedFont = document.fonts.load(
        '540 1em "Geist Variable"',
        "SUPERNEO",
      ).catch(() => []);
      const fontReady = Promise.all([requestedFont, document.fonts.ready]);
      const imagesReady = Promise.all(signs.map((sign) => {
        const imageLoaded = sign.complete && sign.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve, reject) => {
            sign.addEventListener("load", () => resolve(), { once: true });
            sign.addEventListener(
              "error",
              () => reject(new Error("NEO sign failed to load")),
              { once: true },
            );
          });
        return Promise.race([sign.decode().catch(() => imageLoaded), imageLoaded]);
      }));
      void Promise.all([imagesReady, fontReady]).then(() => {
        if (!disposed && stackRef.current) {
          stackRef.current.dataset.signReady = "true";
        }
      }).catch(() => undefined);
    }
    window.addEventListener(STAGE_CHANGE_EVENT, syncStage);
    return () => {
      disposed = true;
      window.removeEventListener(STAGE_CHANGE_EVENT, syncStage);
    };
  }, []);

  return (
    <section className="stage-panel" aria-live="polite">
      <p className="stage-index" ref={indexRef}>01 / 04</p>
      <div className="stage-stack" data-direction="forward" ref={stackRef}>
        {stages.map((item, index) => (
          <h2
            key={item.title}
            ref={(element) => { headingRefs.current[index] = element; }}
            data-state={index === 0 ? "active" : "pending"}
            data-depth={index}
            data-order={index}
            aria-label={item.title}
            aria-current={index === 0 ? "step" : undefined}
          >
            <span className="stage-outline" aria-hidden="true">{item.title}</span>
            <span className="stage-trail stage-trail--near" aria-hidden="true">
              <StageWord title={item.title} />
            </span>
            <span className="stage-trail stage-trail--far" aria-hidden="true">
              <StageWord title={item.title} />
            </span>
            <span className="stage-word" aria-hidden="true">
              <StageWord title={item.title} />
            </span>
          </h2>
        ))}
      </div>
      <p className="stage-line" ref={lineRef}>{stages[0].line}</p>
    </section>
  );
}

export function App() {
  const [discovered, setDiscovered] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const handleDiscover = useCallback(() => setDiscovered(true), []);
  const handleSceneStateChange = useCallback((ready: boolean) => {
    setSceneReady(ready);
  }, []);

  return (
    <main className="experience" data-scene-ready={sceneReady}>
      <ScenePoster />
      <Suspense fallback={null}>
        <LatentField
          onDiscover={handleDiscover}
          onSceneStateChange={handleSceneStateChange}
        />
      </Suspense>
      <div className="technical-frame" aria-hidden="true" />

      <header className="site-header">
        <h1>superneo.ai</h1>
        <div className="header-instruments">
          <ProcessTrace />
        </div>
      </header>

      <p className="making-line">in the making.</p>

      <StagePanel />

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
