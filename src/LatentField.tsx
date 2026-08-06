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
  particleFragmentShader,
  particleVertexShader,
  postVertexShader,
  surfaceFragmentShader,
  surfaceVertexShader,
} from "./latentShader";
import { createMorphGeometry, createPointGeometry } from "./morphGeometry";
import { toMorphPhase, toStageIndex } from "./morphTimeline";
import { createRenderProfile } from "./renderProfile";
import { createFrameProbe } from "./frameProbe";
import type { SceneQaConfig } from "./sceneQa";
import { dispatchStageChange } from "./stageSignal";
import {
  createTipArrivals,
  SIGNAL_PROGRESS_PER_SECOND,
  TIP_SIGNAL_EVENT,
} from "./tipSignal";

gsap.registerPlugin(ScrollTrigger);

type LatentFieldProps = {
  onDiscover: () => void;
  onSceneStateChange: (ready: boolean) => void;
  qa?: SceneQaConfig | null;
};

const MAX_ACTIVE_SIGNALS = 5;
const SIGNAL_LIFETIME = 1.7;
export function LatentField({ onDiscover, onSceneStateChange, qa }: LatentFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.dataset.sceneReady = "false";
    onSceneStateChange(false);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionIsReduced = () => reducedMotion.matches || Boolean(qa?.reducedMotion);
    const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)");
    let disposed = false;
    let needsRender = true;
    let artworkReady = false;
    let sceneReady = false;
    let shaderHealthy = true;
    let readinessStartedAt = 0;
    const reportSceneState = (ready: boolean) => {
      if (sceneReady === ready) return;
      sceneReady = ready;
      host.dataset.sceneReady = String(ready);
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

    renderer.setClearColor(0x030403, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
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
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0, 4.25);

    const artwork = new THREE.Texture();
    const pointerWorld = { value: new THREE.Vector3(0, 0, 0) };
    const pointerDelta = { value: new THREE.Vector3(0, 0, 0) };
    const pointerScreen = { value: new THREE.Vector2(0.5, 0.5) };
    const pointerStrength = { value: 0 };
    const pointerMotion = { value: 0 };
    const press = { value: 0 };
    const timeUniform = { value: 0 };
    const scrollUniform = { value: 0 };
    const stagePhaseUniform = { value: 0 };
    const velocity = { value: 0 };
    const signalProgressValues = new Float32Array(MAX_ACTIVE_SIGNALS).fill(SIGNAL_LIFETIME);
    const clickAlongValues = new Float32Array(MAX_ACTIVE_SIGNALS).fill(0.5);
    const signalVariationValues = new Float32Array(MAX_ACTIVE_SIGNALS).fill(0.5);
    const signalProgressUniform = { value: signalProgressValues };
    const clickAlongUniform = { value: clickAlongValues };
    const signalVariationUniform = { value: signalVariationValues };
    const signalColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--signal")
      .trim() || "#baf628";
    const signalColorUniform = { value: new THREE.Color(signalColor) };
    const sharedUniforms = {
      uPointerWorld: pointerWorld,
      uPointerDelta: pointerDelta,
      uPointerStrength: pointerStrength,
      uPointerMotion: pointerMotion,
      uPress: press,
      uTime: timeUniform,
      uScroll: scrollUniform,
      uStagePhase: stagePhaseUniform,
      uVelocity: velocity,
      uSignalProgress: signalProgressUniform,
      uClickAlong: clickAlongUniform,
      uSignalVariation: signalVariationUniform,
      uSignalColor: signalColorUniform,
    };

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
    background.position.z = -1.35;
    background.renderOrder = 0;
    scene.add(background);

    const geometry = createMorphGeometry(renderProfile.compact);
    const pointGeometry = createPointGeometry(geometry);
    const surfaceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uDisplacementScale: { value: 1 },
        uMorphBias: { value: 0 },
        uSurfaceOpacity: { value: 1 },
      },
      vertexShader: surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    const echoPastMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uDisplacementScale: { value: 1.08 },
        uMorphBias: { value: -0.18 },
        uSurfaceOpacity: { value: 0.2 },
      },
      vertexShader: surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const echoFutureMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uDisplacementScale: { value: 1.18 },
        uMorphBias: { value: 0.18 },
        uSurfaceOpacity: { value: 0.16 },
      },
      vertexShader: surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uPixelRatio: { value: 1 },
        uShell: { value: 0.024 },
        uPointScale: { value: 1 },
        uOpacity: { value: 0.96 },
        uDisplacementScale: { value: 1.65 },
        uMorphBias: { value: 0.055 },
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const haloMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uPixelRatio: particleMaterial.uniforms.uPixelRatio,
        uShell: { value: 0.19 },
        uPointScale: { value: 0.62 },
        uOpacity: { value: 0.22 },
        uDisplacementScale: { value: 2.05 },
        uMorphBias: { value: -0.09 },
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    const objectGroup = new THREE.Group();
    const echoPast = new THREE.Mesh(geometry, echoPastMaterial);
    const echoFuture = new THREE.Mesh(geometry, echoFutureMaterial);
    const surface = new THREE.Mesh(geometry, surfaceMaterial);
    const particles = new THREE.Points(pointGeometry, particleMaterial);
    const halo = new THREE.Points(pointGeometry, haloMaterial);
    halo.renderOrder = 1;
    echoPast.renderOrder = 2;
    echoFuture.renderOrder = 3;
    surface.renderOrder = 4;
    particles.renderOrder = 5;
    objectGroup.add(halo, echoPast, echoFuture, surface, particles);
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
      renderer.setClearColor(0x030403, 1);
      host.classList.add("has-background-fallback");
      reportSceneState(false);
      needsRender = true;
    };
    const loadArtwork = (candidateIndex: number) => {
      const artworkPath = artworkPaths[candidateIndex];
      textureLoader.load(
        new URL(artworkPath, document.baseURI).href,
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
          const textureImage = texture.image as HTMLImageElement;
          const artworkWidth = textureImage.naturalWidth || textureImage.width || 1;
          const artworkHeight = textureImage.naturalHeight || textureImage.height || 1;
          backgroundMaterial.uniforms.uArtworkResolution.value.set(
            artworkWidth,
            artworkHeight,
          );
          backgroundMaterial.uniforms.uArtwork.value = texture;
          artwork.dispose();
          artworkReady = true;
          background.visible = !qa?.objectMask;
          host.classList.remove("has-background-fallback");
          needsRender = true;
        },
        undefined,
        () => {
          if (disposed) return;
          if (candidateIndex + 1 < artworkPaths.length) {
            loadArtwork(candidateIndex + 1);
            return;
          }
          showArtworkFallback();
        },
      );
    };
    loadArtwork(0);
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.48, 0.38);
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
    let discovered = false;
    let resizeTimer: number | null = null;
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
      const nextRenderProfile = createRenderProfile(
        width,
        height,
        window.devicePixelRatio || 1,
        coarsePointer.matches,
      );
      const { pixelRatio } = nextRenderProfile;
      const sizeChanged = width !== lastViewportWidth ||
        height !== lastViewportHeight ||
        Math.abs(pixelRatio - lastPixelRatio) > 0.001;
      const profileChanged = nextRenderProfile.compact !== renderProfile.compact ||
        nextRenderProfile.bloomEnabled !== renderProfile.bloomEnabled ||
        Math.abs(nextRenderProfile.objectScale - renderProfile.objectScale) > 0.001 ||
        Math.abs(nextRenderProfile.fov - renderProfile.fov) > 0.001;
      if (!sizeChanged && !profileChanged) return;
      renderProfile = nextRenderProfile;
      if (sizeChanged) {
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        composer.setPixelRatio(pixelRatio);
        composer.setSize(width, height);
        lastViewportWidth = width;
        lastViewportHeight = height;
        lastPixelRatio = pixelRatio;
      }
      camera.aspect = width / Math.max(height, 1);
      camera.fov = renderProfile.fov;
      camera.updateProjectionMatrix();
      objectGroup.scale.setScalar(renderProfile.objectScale);
      objectGroup.updateMatrixWorld(true);
      bloomPass.enabled = renderProfile.bloomEnabled;
      echoPastMaterial.uniforms.uSurfaceOpacity.value = 0.2;
      echoFutureMaterial.uniforms.uSurfaceOpacity.value = 0.16;
      haloMaterial.uniforms.uOpacity.value = 0.22;
      particleMaterial.uniforms.uPointScale.value = 1;
      particleMaterial.uniforms.uPixelRatio.value = pixelRatio;
      const backgroundDistance = camera.position.z - background.position.z;
      const backgroundHeight =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * backgroundDistance;
      background.scale.set(backgroundHeight * camera.aspect, backgroundHeight, 1);
      backgroundMaterial.uniforms.uResolution.value.set(
        width * pixelRatio,
        height * pixelRatio,
      );
      backgroundMaterial.uniforms.uCompactLayout.value = renderProfile.compact ? 1 : 0;
      asciiPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
      needsRender = true;
    };

    const scheduleResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        resize();
      }, 120);
    };

    const projectPointer = (event: PointerEvent) => {
      pointerNdc.set(
        (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1,
        1 - (event.clientY / Math.max(window.innerHeight, 1)) * 2,
      );
      raycaster.setFromCamera(pointerNdc, camera);
      if (!raycaster.ray.intersectPlane(interactionPlane, worldHit)) return false;
      objectGroup.worldToLocal(worldHit);
      targetPointerWorld.copy(worldHit);
      return true;
    };

    const locateClickAlong = () => {
      const base = geometry.getAttribute("position") as THREE.BufferAttribute;
      const target1 = geometry.getAttribute("aTarget1") as THREE.BufferAttribute;
      const target2 = geometry.getAttribute("aTarget2") as THREE.BufferAttribute;
      const target3 = geometry.getAttribute("aTarget3") as THREE.BufferAttribute;
      const along = geometry.getAttribute("aAlong") as THREE.BufferAttribute;
      const phase = stagePhaseUniform.value;
      const from = phase < 1 ? base : phase < 2 ? target1 : target2;
      const to = phase < 1 ? target1 : phase < 2 ? target2 : target3;
      const localPhase = phase < 1 ? phase : phase < 2 ? phase - 1 : phase - 2;
      const blend = localPhase * localPhase * (3 - 2 * localPhase);
      let nearestDistance = Number.POSITIVE_INFINITY;
      let nearestAlong = 0.5;

      for (let index = 0; index < along.count; index += 1) {
        const x = THREE.MathUtils.lerp(from.getX(index), to.getX(index), blend);
        const y = THREE.MathUtils.lerp(from.getY(index), to.getY(index), blend);
        const z = THREE.MathUtils.lerp(from.getZ(index), to.getZ(index), blend);
        const dx = x - targetPointerWorld.x;
        const dy = y - targetPointerWorld.y;
        const dz = (z - targetPointerWorld.z) * 0.18;
        const distance = dx * dx + dy * dy + dz * dz;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestAlong = along.getX(index);
        }
      }

      return nearestAlong;
    };

    const isInterfaceTarget = (target: EventTarget | null) =>
      target instanceof Element && Boolean(
        target.closest("a, button, input, label, [data-no-scene]"),
      );

    const setPointer = (event: PointerEvent) => {
      if (isInterfaceTarget(event.target)) return;
      const now = performance.now();
      const elapsed = Math.max(now - previousPointerTime, 8);
      targetPointerScreen.set(
        event.clientX / Math.max(window.innerWidth, 1),
        1 - event.clientY / Math.max(window.innerHeight, 1),
      );
      if (!projectPointer(event)) return;
      targetPointerDelta.copy(targetPointerWorld).sub(previousPointerWorld);
      const speed = Math.min(targetPointerDelta.length() * (1000 / elapsed) * 0.42, 1);
      previousPointerWorld.copy(targetPointerWorld);
      previousPointerTime = now;
      targetPointerStrength = 1;
      targetPointerMotion = Math.max(targetPointerMotion, speed);
      needsRender = true;
      discover();
    };

    const pressSurface = (event: PointerEvent) => {
      if (event.button !== 0 || isInterfaceTarget(event.target)) return;
      setPointer(event);
      const availableSignal = signalProgressValues.findIndex(
        (progress) => progress >= SIGNAL_LIFETIME,
      );
      if (availableSignal >= 0) {
        const clickAlong = locateClickAlong();
        const variation = Math.random();
        clickAlongValues[availableSignal] = clickAlong;
        signalVariationValues[availableSignal] = variation;
        signalProgressValues[availableSignal] = 0;
        window.dispatchEvent(new CustomEvent(TIP_SIGNAL_EVENT, {
          detail: { arrivals: createTipArrivals(clickAlong, variation) },
        }));
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
        stagePhaseUniform.value = toMorphPhase(progress);
        const nextStage = toStageIndex(progress);
        if (nextStage !== currentStage) {
          const previousStage = currentStage;
          currentStage = nextStage;
          dispatchStageChange(nextStage, previousStage);
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
      if (motionIsReduced() && !needsRender) return;

      const timestamp = time * 1000;
      const delta = Math.min((timestamp - previousFrame) / 1000, 0.05);
      previousFrame = timestamp;
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
      for (let signalIndex = 0; signalIndex < MAX_ACTIVE_SIGNALS; signalIndex += 1) {
        const progress = Math.min(
          SIGNAL_LIFETIME,
          signalProgressValues[signalIndex] + delta * SIGNAL_PROGRESS_PER_SECOND,
        );
        signalProgressValues[signalIndex] = progress;
        const travelPhase = Math.min(progress, 1);
        signalEnergy = Math.max(
          signalEnergy,
          Math.sin(travelPhase * Math.PI) * (1 - travelPhase),
        );
      }
      timeUniform.value = motionIsReduced() || qa?.freezeScene ? 8 : time;
      if (!motionIsReduced() && !qa?.freezeScene) {
        const phase = stagePhaseUniform.value;
        const weight = (center: number) => {
          const distance = Math.min(1, Math.abs(phase - center));
          const smoothDistance = distance * distance * (3 - 2 * distance);
          return 1 - smoothDistance;
        };
        const latentWeight = weight(0);
        const inferenceWeight = weight(1);
        const emergenceWeight = weight(2);
        const openWeight = weight(3);
        const ambientTurn = time * 0.045;
        objectGroup.rotation.x =
          Math.sin(time * 0.1) * 0.045 +
          latentWeight * Math.sin(time * 0.17) * 0.012 +
          inferenceWeight * Math.sin(time * 0.24) * 0.025 +
          emergenceWeight * Math.sin(time * 0.31) * 0.062 +
          openWeight * Math.sin(time * 0.16) * 0.038;
        objectGroup.rotation.y =
          ambientTurn +
          latentWeight * Math.sin(time * 0.14) * 0.016 +
          inferenceWeight * Math.sin(time * 0.38) * 0.078 +
          emergenceWeight * Math.cos(time * 0.22) * 0.036 +
          openWeight * (
            Math.sin(time * 0.2) * 0.09 + Math.sin(time * 0.071) * 0.035
          );
        objectGroup.rotation.z = Math.sin(time * 0.073 + 0.8) * 0.032;
      }

      const interactionEnergy = Math.max(
        pointerMotion.value * 0.72,
        press.value,
        velocity.value * 0.45,
      );
      const ambientEnergy = motionIsReduced()
        ? 0
        : 0.045 + Math.abs(Math.sin(time * 0.34)) * 0.025;
      const motionEnergy = Math.min(
        1,
        ambientEnergy + Math.max(interactionEnergy * 0.74, signalEnergy * 0.52),
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
      asciiPass.uniforms.uInteraction.value = interactionEnergy * 0.68;
      asciiPass.uniforms.uStage.value = scrollUniform.value;
      bloomPass.strength = 0.16 + interactionEnergy * 0.2 + signalEnergy * 0.04;
      bloomPass.radius = 0.4 + interactionEnergy * 0.065;
      const renderStarted = performance.now();
      try {
        composer.render(delta);
        if (!sceneReady && artworkReady && shaderHealthy) {
          const context = renderer.getContext();
          if (!context.isContextLost() && context.getError() === context.NO_ERROR) {
            if (readinessStartedAt === 0) readinessStartedAt = performance.now();
            if (performance.now() - readinessStartedAt >= (qa?.sceneDelay ?? 0)) {
              reportSceneState(true);
            } else {
              needsRender = true;
            }
          }
        }
      } catch {
        reportSceneState(false);
        needsRender = false;
        return;
      }
      const renderEnded = performance.now();
      frameProbe?.sample(renderEnded, renderEnded - renderStarted);
      needsRender = !sceneReady && artworkReady && shaderHealthy &&
        (readinessStartedAt === 0 ||
          performance.now() - readinessStartedAt < (qa?.sceneDelay ?? 0));
    };

    const tick = (time: number) => {
      renderFrame(time);
    };

    const handleVisibility = () => {
      previousFrame = performance.now();
      needsRender = true;
    };

    const handleMotionPreference = () => {
      needsRender = true;
    };

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
    window.addEventListener("pointermove", setPointer, { passive: true });
    window.addEventListener("pointerup", releaseSurface, { passive: true });
    window.addEventListener("pointercancel", releaseSurface, { passive: true });
    window.addEventListener("pointerout", handlePointerOut, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);
    if (qa?.sceneFault === "context") {
      renderer.getContext().getExtension("WEBGL_lose_context")?.loseContext();
    }
    reducedMotion.addEventListener("change", handleMotionPreference);
    coarsePointer.addEventListener("change", scheduleResize);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      scrollTween.scrollTrigger?.kill();
      scrollTween.kill();
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointerdown", pressSurface);
      window.removeEventListener("pointermove", setPointer);
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
      geometry.dispose();
      pointGeometry.dispose();
      backgroundGeometry.dispose();
      surfaceMaterial.dispose();
      echoPastMaterial.dispose();
      echoFutureMaterial.dispose();
      particleMaterial.dispose();
      haloMaterial.dispose();
      backgroundMaterial.uniforms.uArtwork.value.dispose();
      backgroundMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onDiscover, onSceneStateChange]);

  return <div ref={hostRef} className="signal-stage" aria-hidden="true" />;
}
