import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnalyticsRuntime } from "./analytics/AnalyticsRuntime";
import { dispatchAnalyticsEvent } from "./analytics/events";
import { analyticsConsentPreviewMode } from "./analytics/runtimeConfig";
import {
  ConsentDock,
  PrivacyPreferences,
  useAnalyticsConsent,
} from "./privacy/AnalyticsConsent";
import { SoundtrackController } from "./Soundtrack";
import { STAGE_COUNT, toStageProgress } from "./morphTimeline";
import { parseSceneQa, type NeoQaState } from "./sceneQa";
import { STAGE_CHANGE_EVENT, type StageChangeDetail } from "./stageSignal";

const LatentField = lazy(() =>
  import("./LatentField").then(({ LatentField: field }) => ({ default: field })),
);

const stages = [
  { title: "LATENT", line: "Possibility, compressed." },
  { title: "EMERGENCE", line: "New structure appears." },
  { title: "SUPERNEO", line: "The structure remains open." },
];

const progressStages = ["01 LATENT", "02 EMERGE", "03 NEO"];
const stageTotal = String(STAGE_COUNT).padStart(2, "0");
const neoSignFullUrl = new URL("neo-sign-full.png", document.baseURI).href;
const neoSignMediumUrl = new URL("neo-sign-medium.png", document.baseURI).href;
const neoSignFaultLowUrl = new URL("neo-sign-fault-low.png", document.baseURI).href;
const desktopArtworkUrl = new URL("latent-field.avif", document.baseURI).href;
const mobileArtworkUrl = new URL("latent-field-mobile.jpg", document.baseURI).href;
const SCENE_LOADING_STEP_MS = 300;
const INITIALIZING_LINGER_BASE_MS = 550;
const INITIALIZING_LINGER_JITTER_MS = 350;
const bootPhases = [
  { label: "RUNTIME", activity: "INIT" },
  { label: "FIELD", activity: "DECODE" },
  { label: "SCENE", activity: "LINK" },
] as const;
const bootTotal = String(bootPhases.length).padStart(2, "0");
const MIN_SCENE_LOADING_MS = (
  SCENE_LOADING_STEP_MS * bootPhases.length
  + INITIALIZING_LINGER_BASE_MS
  + Math.floor(Math.random() * INITIALIZING_LINGER_JITTER_MS)
);

function ScenePoster({ loadStep }: { loadStep: number }) {
  const finalizing = loadStep > bootPhases.length;

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
      <div className="scene-loader">
        <span className="scene-loader-label">
          <span>SYSTEM BOOT</span>
          <output>{String(Math.min(loadStep, bootPhases.length)).padStart(2, "0")}/{bootTotal}</output>
        </span>
        <span className="scene-loader-log">
          {bootPhases.map((phase, index) => {
            const step = index + 1;
            const state = step < loadStep
              ? "complete"
              : step === loadStep ? "active" : "pending";

            return (
              <span className="scene-loader-step" data-state={state} key={phase.label}>
                <i>{String(step).padStart(2, "0")}</i>
                <span>{phase.label}</span>
                <output>{state === "complete" ? "OK" : state === "active" ? phase.activity : "WAIT"}</output>
              </span>
            );
          })}
        </span>
        <span className="scene-loader-track">
          {bootPhases.map((phase, index) => {
            const step = index + 1;
            const state = step < loadStep
              ? "complete"
              : step === loadStep ? "active" : "pending";

            return <i data-state={state} key={phase.label} />;
          })}
        </span>
        <span className="scene-loader-final" data-visible={finalizing}>
          <i>&gt;</i>
          <span>INITIALIZING</span>
          <output>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </output>
        </span>
      </div>
    </div>
  );
}

function StageWord({
  title,
  forcedNeoState,
  showTrademark = false,
}: {
  title: string;
  forcedNeoState: NeoQaState | null;
  showTrademark?: boolean;
}) {
  if (title !== "SUPERNEO") return <>{title}</>;

  const stateStyle = (state: NeoQaState) => forcedNeoState
    ? { animation: "none", opacity: forcedNeoState === state ? 1 : 0 }
    : undefined;

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
          style={stateStyle("full")}
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
          style={stateStyle("medium")}
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
          style={stateStyle("fault-low")}
        />
      </span>
      {showTrademark ? (
        <span className="brand-tm brand-tm--stage" aria-hidden="true">™</span>
      ) : null}
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

function StagePanel({ forcedNeoState }: { forcedNeoState: NeoQaState | null }) {
  const stackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const headingRefs = useRef<Array<HTMLHeadingElement | null>>([]);

  useEffect(() => {
    const syncStage = (event: Event) => {
      const { stage, previous } = (event as CustomEvent<StageChangeDetail>).detail;
      const direction = stage > previous ? "forward" : "backward";
      if (stackRef.current) {
        stackRef.current.dataset.direction = stage > previous ? "forward" : "backward";
      }
      if (indexRef.current) {
        indexRef.current.textContent = `${String(stage + 1).padStart(2, "0")} / ${stageTotal}`;
      }
      if (lineRef.current) lineRef.current.textContent = stages[stage].line;

      headingRefs.current.forEach((heading, index) => {
        if (!heading) return;
        heading.removeAttribute("data-exiting");
        heading.dataset.state = index === stage
          ? "active"
          : index < stage ? "complete" : "pending";
        heading.dataset.depth = String(index - stage);
        if (index === stage) heading.setAttribute("aria-current", "step");
        else heading.removeAttribute("aria-current");
      });
      const previousHeading = headingRefs.current[previous];
      if (previousHeading) {
        void previousHeading.offsetWidth;
        previousHeading.dataset.exiting = direction;
      }
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
      <p className="stage-index" ref={indexRef}>01 / {stageTotal}</p>
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
            <span className="stage-outline" aria-hidden="true">
              <StageWord title={item.title} forcedNeoState={forcedNeoState} />
            </span>
            <span className="stage-trail stage-trail--near" aria-hidden="true">
              <StageWord title={item.title} forcedNeoState={forcedNeoState} />
            </span>
            <span className="stage-trail stage-trail--far" aria-hidden="true">
              <StageWord title={item.title} forcedNeoState={forcedNeoState} />
            </span>
            <span className="stage-word" aria-hidden="true">
              <StageWord
                title={item.title}
                forcedNeoState={forcedNeoState}
                showTrademark
              />
            </span>
          </h2>
        ))}
      </div>
      <p className="stage-line" ref={lineRef}>{stages[0].line}</p>
    </section>
  );
}

export function App() {
  const sceneQa = import.meta.env.DEV
    ? parseSceneQa(window.location.search)
    : null;
  const [discovered, setDiscovered] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [loadStep, setLoadStep] = useState(1);
  const [consentFallbackReady, setConsentFallbackReady] = useState(false);
  const [consentPreviewDismissed, setConsentPreviewDismissed] = useState(false);
  const [consentOffset, setConsentOffset] = useState<number>(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const privacyButtonRef = useRef<HTMLAnchorElement>(null);
  const { consent, chooseAnalytics, announcement } = useAnalyticsConsent();
  const handleConsentDockChoice = useCallback(async (allowed: boolean) => {
    await chooseAnalytics(allowed);
    if (analyticsConsentPreviewMode) setConsentPreviewDismissed(true);
  }, [chooseAnalytics]);
  const loadingStartedAtRef = useRef(performance.now());
  const sceneReadyTimerRef = useRef<number | null>(null);
  const handleDiscover = useCallback(() => setDiscovered(true), []);
  const handleSceneStateChange = useCallback((ready: boolean) => {
    if (sceneReadyTimerRef.current !== null) {
      window.clearTimeout(sceneReadyTimerRef.current);
      sceneReadyTimerRef.current = null;
    }

    if (!ready) {
      setSceneReady(false);
      return;
    }

    const elapsed = performance.now() - loadingStartedAtRef.current;
    const remaining = Math.max(0, MIN_SCENE_LOADING_MS - elapsed);
    sceneReadyTimerRef.current = window.setTimeout(() => {
      setLoadStep(bootPhases.length + 1);
      setSceneReady(true);
      sceneReadyTimerRef.current = null;
    }, remaining);
  }, []);

  useEffect(() => {
    const stepTimers = bootPhases.map((_, index) => {
      const step = index + 2;
      return window.setTimeout(
        () => setLoadStep(step),
        SCENE_LOADING_STEP_MS * (step - 1),
      );
    });

    return () => {
      stepTimers.forEach(window.clearTimeout);
      if (sceneReadyTimerRef.current !== null) {
        window.clearTimeout(sceneReadyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!consent.available || sceneReady) return;
    const fallbackTimer = window.setTimeout(() => setConsentFallbackReady(true), 2600);
    return () => window.clearTimeout(fallbackTimer);
  }, [consent.available, sceneReady]);

  const consentVisible = !consentPreviewDismissed
    && (consent.status === "pending" || analyticsConsentPreviewMode)
    && (sceneReady || consentFallbackReady);
  const experienceStyle = {
    "--consent-offset": `${consentOffset}px`,
  } as CSSProperties;

  return (
    <main
      className="experience"
      data-scene-ready={sceneReady}
      data-consent-open={consentVisible}
      style={experienceStyle}
    >
      <ScenePoster loadStep={loadStep} />
      <Suspense fallback={null}>
        <LatentField
          onDiscover={handleDiscover}
          onSceneStateChange={handleSceneStateChange}
          qa={sceneQa}
        />
      </Suspense>
      <div className="technical-frame" aria-hidden="true" />

      <header className="site-header">
        <h1 aria-label="superneo.ai">superneo.ai</h1>
        <div className="header-instruments">
          <ProcessTrace />
        </div>
      </header>

      <p className="making-line">in the making.</p>

      <StagePanel forcedNeoState={sceneQa?.neoState ?? null} />

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

        <nav className="footer-privacy" aria-label="Site information">
          {consent.available && consent.status !== "loading" && (
            <a
              className="contact-link privacy-link"
              href="./privacy/"
              ref={privacyButtonRef}
              aria-haspopup="dialog"
              onClick={(event) => {
                if (
                  event.button !== 0
                  || event.metaKey
                  || event.ctrlKey
                  || event.shiftKey
                  || event.altKey
                ) return;
                event.preventDefault();
                setPrivacyOpen(true);
              }}
            >
              PRIVACY
            </a>
          )}
          <a className="contact-link" href="./legal/">LEGAL</a>
        </nav>

        <nav className="contact-links" aria-label="Contact">
          <a
            className="contact-link x-link"
            href="https://x.com/superneoai"
            target="_blank"
            rel="noreferrer"
            aria-label="SUPERNEO on X"
            onClick={() => dispatchAnalyticsEvent("outbound_clicked", { destination: "x" })}
          >
            <span className="x-mark" aria-hidden="true">𝕏</span>
            <span>@superneoai</span>
          </a>
          <a
            className="contact-link"
            href="mailto:hello@superneo.ai"
            onClick={() => dispatchAnalyticsEvent("outbound_clicked", { destination: "email" })}
          >
            hello@superneo.ai
          </a>
        </nav>
      </footer>

      <ConsentDock
        visible={consentVisible}
        onChoice={handleConsentDockChoice}
        onDetails={() => setPrivacyOpen(true)}
        onHeightChange={setConsentOffset}
      />
      {consent.available && (
        <PrivacyPreferences
          open={privacyOpen}
          consent={consent}
          onClose={() => setPrivacyOpen(false)}
          onSave={chooseAnalytics}
          fallbackFocusRef={privacyButtonRef}
        />
      )}
      <p className="visually-hidden" aria-live="polite">{announcement}</p>
      <AnalyticsRuntime consentStatus={consent.status} sceneReady={sceneReady} />

      <div className="scroll-runway" aria-hidden="true" />
    </main>
  );
}
