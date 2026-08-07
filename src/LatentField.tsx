import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  asciiDitherPostFragmentShader,
  backgroundFragmentShader,
  backgroundVertexShader,
  postVertexShader,
} from "./latentShader";
import { createFrameProbe } from "./frameProbe";
import { createRenderProfile } from "./renderProfile";
import type { SceneQaConfig } from "./sceneQa";
import { dispatchShowcaseImpulse } from "./showcaseEvents";
import { createShowcaseMorphSystem } from "./showcaseMorph.ts";
import { toShowcaseTimeline, type ShowcaseTimelineState } from "./showcaseTimeline";
import { dispatchStageChange } from "./stageSignal";
import { SIGNAL_PROGRESS_PER_SECOND } from "./tipSignal";

gsap.registerPlugin(ScrollTrigger);

type LatentFieldProps = {
  onDiscover: () => void;
  onSceneStateChange: (ready: boolean) => void;
  qa?: SceneQaConfig | null;
};

const MAX_ACTIVE_SIGNALS = 5;
const SIGNAL_LIFETIME = 1.7;
const SCENE_REVEAL_DURATION = 1_200;

function forcedTimeline(qa: SceneQaConfig | null | undefined, fallback: ShowcaseTimelineState) {
  if (qa?.showcaseAct === null || qa?.showcaseAct === undefined) return fallback;
  const act = qa.showcaseAct;
  const amount = qa.showcaseTransition ?? 0;
  return {
    stage: act,
    fromAct: act,
    toAct: Math.min(3, act + 1),
    transition: act === 3 ? 0 : amount,
    actProgress: act === 3 ? amount : 0.32,
  } satisfies ShowcaseTimelineState;
}

export function LatentField({ onDiscover, onSceneStateChange, qa }: LatentFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.dataset.sceneReady = "false";
    onSceneStateChange(false);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)");
    const motionIsReduced = () => reducedMotion.matches || Boolean(qa?.reducedMotion);
    let disposed = false;
    let needsRender = true;
    let artworkReady = false;
    let sceneReady = false;
    let shaderHealthy = true;
    let validFrameCount = 0;
    let readinessStartedAt = 0;
    let sceneRevealStartedAt = 0;
    const sceneReveal = { value: 0 };
    const reportSceneState = (ready: boolean) => {
      if (sceneReady === ready) return;
      sceneReady = ready;
      validFrameCount = 0;
      readinessStartedAt = 0;
      sceneRevealStartedAt = ready ? performance.now() : 0;
      sceneReveal.value = ready && motionIsReduced() ? 1 : 0;
      host.dataset.sceneReady = String(ready);
      if (import.meta.env.DEV) host.dataset.sceneReport = ready ? "ready" : "waiting";
      onSceneStateChange(ready);
    };

    let renderProfile = createRenderProfile(
      Math.max(host.clientWidth, 1),
      Math.max(host.clientHeight, 1),
      window.devicePixelRatio || 1,
      coarsePointer.matches,
    );
    let renderer: THREE.WebGLRenderer;
    try {
      if (qa?.sceneFault === "renderer") throw new Error("Forced renderer failure");
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      onSceneStateChange(false);
      return;
    }

    renderer.setClearColor(0x030208, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.domElement.className = "signal-canvas";
    host.appendChild(renderer.domElement);
    renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
      shaderHealthy = false;
      reportSceneState(false);
      console.error("SUPERNEO shader compilation failed", {
        program: gl.getProgramInfoLog(program),
        vertex: gl.getShaderInfoLog(vertexShader),
        fragment: gl.getShaderInfoLog(fragmentShader),
      });
    };

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.8, 2.8, 1.7, -1.7, 0.1, 30);
    camera.position.set(4.2, 3.2, 5.4);
    camera.lookAt(0.25, -0.02, 0);
    camera.updateMatrixWorld(true);

    const pointerWorld = { value: new THREE.Vector3() };
    const pointerDelta = { value: new THREE.Vector3() };
    const pointerScreen = { value: new THREE.Vector2(0.5, 0.5) };
    const pointerStrength = { value: 0 };
    const pointerMotion = { value: 0 };
    const press = { value: 0 };
    const timeUniform = { value: 0 };
    const scrollUniform = { value: 0 };
    const velocity = { value: 0 };
    const signalProgressValues = new Float32Array(MAX_ACTIVE_SIGNALS).fill(SIGNAL_LIFETIME);
    const signalColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--signal")
      .trim() || "#baf628";
    const signalColorUniform = { value: new THREE.Color(signalColor) };

    const artwork = new THREE.Texture();
    let loadedArtwork: THREE.Texture | null = null;
    const backgroundGeometry = new THREE.PlaneGeometry(1, 1);
    const backgroundMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uArtwork: { value: artwork },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uArtworkResolution: { value: new THREE.Vector2(1536, 1024) },
        uCompactLayout: { value: renderProfile.compact ? 1 : 0 },
        uPointerScreen: pointerScreen,
        uPointerStrength: pointerStrength,
        uPointerMotion: pointerMotion,
        uPress: press,
        uTime: timeUniform,
        uScroll: scrollUniform,
        uVelocity: velocity,
        uSignalColor: signalColorUniform,
      },
      vertexShader: backgroundVertexShader,
      fragmentShader: qa?.sceneFault === "shader"
        ? `${backgroundFragmentShader}\nQA_INVALID_SHADER_TOKEN`
        : backgroundFragmentShader,
      depthWrite: false,
      depthTest: false,
    });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    background.renderOrder = 0;
    scene.add(background);

    const showcase = createShowcaseMorphSystem(renderProfile.compact, signalColorUniform.value);
    const objectGroup = new THREE.Group();
    objectGroup.add(showcase.group);
    scene.add(objectGroup);

    const textureLoader = new THREE.TextureLoader();
    const artworkPaths = qa?.sceneFault === "texture"
      ? ["qa-missing-texture.jpg"]
      : renderProfile.compact
        ? ["latent-field-mobile.jpg"]
        : ["latent-field.avif", "latent-field.jpg"];
    const showArtworkFallback = () => {
      artworkReady = false;
      background.visible = false;
      host.classList.add("has-background-fallback");
      reportSceneState(false);
      needsRender = true;
    };
    const loadArtwork = (candidateIndex: number) => {
      textureLoader.load(
        new URL(artworkPaths[candidateIndex], document.baseURI).href,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = Math.min(
            renderer.capabilities.getMaxAnisotropy(),
            renderProfile.compact ? 2 : 4,
          );
          const image = texture.image as HTMLImageElement;
          backgroundMaterial.uniforms.uArtworkResolution.value.set(
            image.naturalWidth || image.width || 1,
            image.naturalHeight || image.height || 1,
          );
          loadedArtwork?.dispose();
          loadedArtwork = texture;
          backgroundMaterial.uniforms.uArtwork.value = texture;
          artworkReady = true;
          if (import.meta.env.DEV) host.dataset.artworkReady = "true";
          background.visible = !qa?.objectMask;
          host.classList.remove("has-background-fallback");
          needsRender = true;
        },
        undefined,
        () => {
          if (disposed) return;
          if (candidateIndex + 1 < artworkPaths.length) loadArtwork(candidateIndex + 1);
          else showArtworkFallback();
        },
      );
    };
    loadArtwork(0);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.42, 0.46);
    const asciiPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uInteraction: { value: 0 },
        uStage: { value: 0 },
        uSignalColor: signalColorUniform,
      },
      vertexShader: postVertexShader,
      fragmentShader: asciiDitherPostFragmentShader,
    });
    const outputPass = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(asciiPass);
    composer.addPass(outputPass);

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const worldHit = new THREE.Vector3();
    const targetPointerWorld = new THREE.Vector3();
    const targetPointerDelta = new THREE.Vector3();
    const previousPointerWorld = new THREE.Vector3();
    const targetPointerScreen = new THREE.Vector2(0.5, 0.5);
    let targetPointerStrength = 0;
    let targetPointerMotion = 0;
    let targetPress = 0;
    let targetVelocity = 0;
    let previousPointerTime = performance.now();
    let previousFrame = performance.now();
    let previousTelemetry = 0;
    let motionAccumulator = 0;
    let currentStage = 0;
    let showcaseState = forcedTimeline(qa, toShowcaseTimeline(0));
    let discovered = false;
    let resizeTimer: number | null = null;
    let pointerMoveFrame: number | null = null;
    let pendingPointerX = 0;
    let pendingPointerY = 0;
    let lastViewportWidth = 0;
    let lastViewportHeight = 0;
    let lastPixelRatio = 0;
    const frameProbe = createFrameProbe();
    const scrollRailFill = document.querySelector<HTMLElement>(".scroll-rail-fill");

    const discover = () => {
      if (discovered) return;
      discovered = true;
      onDiscover();
    };

    const resize = () => {
      const width = Math.max(Math.round(host.clientWidth), 1);
      const height = Math.max(Math.round(host.clientHeight), 1);
      const nextProfile = createRenderProfile(
        width,
        height,
        window.devicePixelRatio || 1,
        coarsePointer.matches,
      );
      const sizeChanged = width !== lastViewportWidth || height !== lastViewportHeight ||
        Math.abs(nextProfile.pixelRatio - lastPixelRatio) > 0.001;
      if (!sizeChanged) return;
      renderProfile = nextProfile;
      renderer.setPixelRatio(renderProfile.pixelRatio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(renderProfile.pixelRatio);
      composer.setSize(width, height);
      lastViewportWidth = width;
      lastViewportHeight = height;
      lastPixelRatio = renderProfile.pixelRatio;

      const aspect = width / Math.max(height, 1);
      const viewHeight = renderProfile.compact ? 4.25 : 3.35;
      const viewWidth = viewHeight * aspect;
      camera.left = -viewWidth * 0.5;
      camera.right = viewWidth * 0.5;
      camera.top = viewHeight * 0.5;
      camera.bottom = -viewHeight * 0.5;
      camera.updateProjectionMatrix();
      objectGroup.scale.setScalar(
        renderProfile.objectScale * (renderProfile.compact ? 0.74 : 1),
      );
      objectGroup.position.set(
        renderProfile.compact ? 0 : 0.48,
        renderProfile.compact ? 0.3 : -0.05,
        0,
      );
      objectGroup.updateMatrixWorld(true);

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      background.position.copy(camera.position).addScaledVector(forward, 16);
      background.quaternion.copy(camera.quaternion);
      background.scale.set(viewWidth, viewHeight, 1);
      backgroundMaterial.uniforms.uResolution.value.set(
        width * renderProfile.pixelRatio,
        height * renderProfile.pixelRatio,
      );
      backgroundMaterial.uniforms.uCompactLayout.value = renderProfile.compact ? 1 : 0;
      asciiPass.uniforms.uResolution.value.set(
        width * renderProfile.pixelRatio,
        height * renderProfile.pixelRatio,
      );
      bloomPass.enabled = renderProfile.bloomEnabled;
      needsRender = true;
    };

    const scheduleResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        resize();
      }, 120);
    };

    const projectPointer = (clientX: number, clientY: number) => {
      const width = lastViewportWidth || Math.max(host.clientWidth, 1);
      const height = lastViewportHeight || Math.max(host.clientHeight, 1);
      pointerNdc.set(clientX / width * 2 - 1, 1 - clientY / height * 2);
      raycaster.setFromCamera(pointerNdc, camera);
      if (!raycaster.ray.intersectPlane(interactionPlane, worldHit)) return false;
      objectGroup.worldToLocal(worldHit);
      targetPointerWorld.copy(worldHit);
      return true;
    };

    const isInterfaceTarget = (target: EventTarget | null) =>
      target instanceof Element && Boolean(
        target.closest("a, button, input, label, [data-no-scene]"),
      );

    const setPointerPosition = (clientX: number, clientY: number) => {
      const now = performance.now();
      const elapsed = Math.max(now - previousPointerTime, 8);
      targetPointerScreen.set(
        clientX / (lastViewportWidth || Math.max(host.clientWidth, 1)),
        1 - clientY / (lastViewportHeight || Math.max(host.clientHeight, 1)),
      );
      if (!projectPointer(clientX, clientY)) return;
      targetPointerDelta.copy(targetPointerWorld).sub(previousPointerWorld);
      const speed = Math.min(targetPointerDelta.length() * (1000 / elapsed) * 0.4, 1);
      previousPointerWorld.copy(targetPointerWorld);
      previousPointerTime = now;
      targetPointerStrength = 1;
      targetPointerMotion = Math.max(targetPointerMotion, speed);
      needsRender = true;
      discover();
    };

    const schedulePointer = (event: PointerEvent) => {
      if (isInterfaceTarget(event.target)) return;
      pendingPointerX = event.clientX;
      pendingPointerY = event.clientY;
      if (pointerMoveFrame !== null) return;
      pointerMoveFrame = window.requestAnimationFrame(() => {
        pointerMoveFrame = null;
        setPointerPosition(pendingPointerX, pendingPointerY);
      });
    };

    const pressSurface = (event: PointerEvent) => {
      if (event.button !== 0 || isInterfaceTarget(event.target)) return;
      setPointerPosition(event.clientX, event.clientY);
      const available = signalProgressValues.findIndex((value) => value >= SIGNAL_LIFETIME);
      if (available >= 0) {
        signalProgressValues[available] = 0;
        dispatchShowcaseImpulse(
          showcaseState.transition > 0.5 ? showcaseState.toAct : showcaseState.fromAct,
          0.72 + Math.min(event.pressure || 0, 0.28),
          THREE.MathUtils.clamp(targetPointerWorld.x * 0.42, -0.8, 0.8),
        );
      }
      targetPress = Math.max(0.66, event.pressure || 0);
      targetPointerMotion = Math.max(targetPointerMotion, 0.72);
      needsRender = true;
    };

    const releaseSurface = () => {
      targetPress = 0;
      needsRender = true;
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        targetPointerStrength = 0;
        targetPress = 0;
      }
    };

    const scrollState = { progress: 0 };
    const scrollTween = gsap.to(scrollState, {
      progress: 1,
      ease: "none",
      onUpdate: () => {
        const progress = scrollState.progress;
        scrollUniform.value = progress;
        showcaseState = forcedTimeline(qa, toShowcaseTimeline(progress));
        if (showcaseState.stage !== currentStage) {
          const previousStage = currentStage;
          currentStage = showcaseState.stage;
          dispatchStageChange(currentStage, previousStage);
        }
        if (scrollRailFill) scrollRailFill.style.transform = `scaleY(${progress.toFixed(4)})`;
        needsRender = true;
      },
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        fastScrollEnd: 2800,
        onUpdate: (self) => {
          targetVelocity = Math.min(Math.abs(self.getVelocity()) / 2300, 1);
          if (self.progress > 0.006) discover();
        },
      },
    });

    const renderFrame = (time: number) => {
      if (disposed || document.hidden) return;
      if (motionIsReduced() && sceneReady && !needsRender) return;
      const timestamp = time * 1000;
      const delta = Math.min((timestamp - previousFrame) / 1000, 0.05);
      previousFrame = timestamp;
      if (sceneReady && sceneReveal.value < 1) {
        const progress = THREE.MathUtils.clamp(
          (performance.now() - sceneRevealStartedAt) / SCENE_REVEAL_DURATION,
          0,
          1,
        );
        sceneReveal.value = motionIsReduced() ? 1 : progress * progress * (3 - 2 * progress);
      }

      pointerWorld.value.lerp(targetPointerWorld, 0.14);
      pointerDelta.value.lerp(targetPointerDelta, 0.18);
      pointerScreen.value.lerp(targetPointerScreen, 0.14);
      targetPointerDelta.multiplyScalar(0.8);
      pointerStrength.value += (targetPointerStrength - pointerStrength.value) * 0.09;
      pointerMotion.value += (targetPointerMotion - pointerMotion.value) * 0.18;
      press.value += (targetPress - press.value) * 0.16;
      velocity.value += (targetVelocity - velocity.value) * 0.15;
      targetPointerMotion *= 0.86;
      targetVelocity *= 0.88;

      let signalEnergy = 0;
      for (let index = 0; index < MAX_ACTIVE_SIGNALS; index += 1) {
        signalProgressValues[index] = Math.min(
          SIGNAL_LIFETIME,
          signalProgressValues[index] + delta * SIGNAL_PROGRESS_PER_SECOND,
        );
        const travel = Math.min(signalProgressValues[index], 1);
        signalEnergy = Math.max(signalEnergy, Math.sin(travel * Math.PI) * (1 - travel));
      }

      timeUniform.value = motionIsReduced() || qa?.freezeScene ? 6.4 : time;
      showcase.update({
        time: timeUniform.value,
        fromAct: showcaseState.fromAct,
        toAct: showcaseState.toAct,
        transition: showcaseState.transition,
        actProgress: showcaseState.actProgress,
        pointer: pointerWorld.value,
        pointerStrength: pointerStrength.value,
        signalProgress: signalProgressValues,
        reducedMotion: motionIsReduced() || Boolean(qa?.freezeScene),
      });

      const interactionEnergy = Math.max(
        pointerMotion.value * 0.72,
        press.value,
        velocity.value * 0.45,
      );
      const ambientEnergy = motionIsReduced()
        ? 0
        : 0.04 + Math.abs(Math.sin(time * 0.34)) * 0.022;
      const motionEnergy = Math.min(
        1,
        ambientEnergy + Math.max(interactionEnergy * 0.72, signalEnergy * 0.56),
      );
      motionAccumulator += motionEnergy * delta * 18;
      if (timestamp - previousTelemetry >= 110) {
        previousTelemetry = timestamp;
        window.dispatchEvent(new CustomEvent("superneo:motion", {
          detail: {
            iteration: 24 + Math.floor(motionAccumulator),
            delta: 0.006 + motionEnergy * 0.094,
          },
        }));
      }

      asciiPass.uniforms.uInteraction.value = interactionEnergy * 0.46 +
        showcaseState.transition * 0.32;
      asciiPass.uniforms.uStage.value = scrollUniform.value;
      bloomPass.strength = 0.13 + interactionEnergy * 0.14 + signalEnergy * 0.1;
      bloomPass.radius = 0.34 + interactionEnergy * 0.05;
      const renderStarted = performance.now();
      try {
        composer.render(delta);
        if (!sceneReady && artworkReady && shaderHealthy) {
          const context = renderer.getContext();
          if (!context.isContextLost() && context.getError() === context.NO_ERROR) {
            validFrameCount += 1;
            if (import.meta.env.DEV) host.dataset.validFrames = String(validFrameCount);
            if (readinessStartedAt === 0) readinessStartedAt = performance.now();
            if (
              validFrameCount >= 2 &&
              performance.now() - readinessStartedAt >= (qa?.sceneDelay ?? 0)
            ) reportSceneState(true);
            else needsRender = true;
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error("SUPERNEO scene render failed", error);
        reportSceneState(false);
        needsRender = false;
        return;
      }
      const renderEnded = performance.now();
      frameProbe?.sample(renderEnded, renderEnded - renderStarted);
      needsRender = (sceneReady && sceneReveal.value < 1) ||
        (!sceneReady && artworkReady && shaderHealthy);
    };

    const handleVisibility = () => {
      previousFrame = performance.now();
      needsRender = true;
    };
    const handleMotionPreference = () => { needsRender = true; };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      reportSceneState(false);
    };
    const handleContextRestored = () => {
      reportSceneState(false);
      needsRender = true;
    };

    resize();
    window.addEventListener("resize", scheduleResize, { passive: true });
    window.addEventListener("pointerdown", pressSurface, { passive: true });
    window.addEventListener("pointermove", schedulePointer, { passive: true });
    window.addEventListener("pointerup", releaseSurface, { passive: true });
    window.addEventListener("pointercancel", releaseSurface, { passive: true });
    window.addEventListener("pointerout", handlePointerOut, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);
    reducedMotion.addEventListener("change", handleMotionPreference);
    coarsePointer.addEventListener("change", scheduleResize);
    if (qa?.sceneFault === "context") {
      renderer.getContext().getExtension("WEBGL_lose_context")?.loseContext();
    }
    gsap.ticker.add(renderFrame);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      disposed = true;
      gsap.ticker.remove(renderFrame);
      scrollTween.scrollTrigger?.kill();
      scrollTween.kill();
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (pointerMoveFrame !== null) window.cancelAnimationFrame(pointerMoveFrame);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointerdown", pressSurface);
      window.removeEventListener("pointermove", schedulePointer);
      window.removeEventListener("pointerup", releaseSurface);
      window.removeEventListener("pointercancel", releaseSurface);
      window.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      coarsePointer.removeEventListener("change", scheduleResize);
      scrollRailFill?.style.removeProperty("transform");
      renderPass.dispose();
      bloomPass.dispose();
      asciiPass.dispose();
      outputPass.dispose();
      composer.dispose();
      frameProbe?.dispose();
      showcase.dispose();
      backgroundGeometry.dispose();
      loadedArtwork?.dispose();
      artwork.dispose();
      backgroundMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onDiscover, onSceneStateChange, qa]);

  return <div ref={hostRef} className="signal-stage" aria-hidden="true" />;
}
