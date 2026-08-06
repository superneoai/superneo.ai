const morphVertexChunk = /* glsl */ `
  attribute vec3 aTarget1;
  attribute vec3 aTarget2;
  attribute vec3 aTarget3;
  attribute float aSeed;
  attribute float aAlong;
  attribute float aStrand;

  uniform vec3 uPointerWorld;
  uniform vec3 uPointerDelta;
  uniform float uPointerStrength;
  uniform float uPointerMotion;
  uniform float uPress;
  uniform float uTime;
  uniform float uScroll;
  uniform float uStagePhase;
  uniform float uVelocity;
  uniform vec3 uSignalColor;
  uniform float uSignalProgress[5];
  uniform float uClickAlong[5];
  uniform float uSignalVariation[5];
  uniform float uDisplacementScale;
  uniform float uMorphBias;

  vec3 morphPosition() {
    float ambientMorph =
      sin(uTime * 0.16) * 0.042 +
      sin(uTime * 0.061 + 1.7) * 0.016;
    float basePhase = uStagePhase;
    // Let the shells separate while travelling, then converge on every named
    // stage so a previous silhouette never trails the next label.
    float transitionWave = sin(basePhase * 3.14159265);
    float transitionEnvelope = transitionWave * transitionWave;
    float phase = clamp(
      basePhase + (uMorphBias + ambientMorph) * 4.0 * transitionEnvelope,
      0.0,
      3.0
    );
    vec3 current;
    if (phase < 1.0) {
      float blend = smoothstep(0.0, 1.0, phase);
      current = mix(position, aTarget1, blend);
    } else if (phase < 2.0) {
      float blend = smoothstep(0.0, 1.0, phase - 1.0);
      current = mix(aTarget1, aTarget2, blend);
    } else {
      float blend = smoothstep(0.0, 1.0, phase - 2.0);
      current = mix(aTarget2, aTarget3, blend);
    }
    return current;
  }

  float stageInfluence(float phase, float center) {
    return 1.0 - smoothstep(0.0, 1.0, abs(phase - center));
  }

  float tipTravelSpeed(float tipSide, float variation) {
    float strandIndex = floor(aStrand * 2.0 + 0.5);
    float randomSpeed = fract(sin(
      (strandIndex + 1.0) * 12.9898 +
      tipSide * 78.233 +
      variation * 127.117
    ) * 43758.5453);
    return mix(0.68, 1.34, smoothstep(0.0, 1.0, randomSpeed));
  }

  float signalTravelDistance(float progress, float clickAlong, float speed) {
    float longestRoute = max(clickAlong, 1.0 - clickAlong);
    return progress * speed * (longestRoute + 0.38);
  }

  float clickTravelPulseAt(float progress, float clickAlong, float variation) {
    float distanceFromClick = abs(aAlong - clickAlong);
    float tipSide = step(clickAlong, aAlong);
    float travel = signalTravelDistance(
      progress,
      clickAlong,
      tipTravelSpeed(tipSide, variation)
    );
    float head = 1.0 - smoothstep(0.018, 0.074, abs(distanceFromClick - travel));
    float tail = smoothstep(travel - 0.24, travel - 0.055, distanceFromClick) *
      (1.0 - smoothstep(travel - 0.055, travel + 0.015, distanceFromClick));
    return head * 1.08 + tail * 0.4;
  }

  float endpointArrival(
    float routeLength,
    float progress,
    float clickAlong,
    float speed
  ) {
    float longestRoute = max(clickAlong, 1.0 - clickAlong);
    float arrivalProgress = routeLength / max(longestRoute + 0.38, 0.001);
    float timeSinceArrival = progress * speed - arrivalProgress;
    float easedArrival = smoothstep(-0.08, 0.04, timeSinceArrival);
    float seamlessDissolve = 1.0 - smoothstep(0.05, 0.82, timeSinceArrival);
    return easedArrival * seamlessDissolve;
  }

  float clickEndpointGlowAt(float progress, float clickAlong, float variation) {
    float leftTip = 1.0 - smoothstep(0.025, 0.14, aAlong);
    float rightTip = smoothstep(0.86, 0.975, aAlong);
    float leftArrival = endpointArrival(
      clickAlong,
      progress,
      clickAlong,
      tipTravelSpeed(0.0, variation)
    );
    float rightArrival = endpointArrival(
      1.0 - clickAlong,
      progress,
      clickAlong,
      tipTravelSpeed(1.0, variation)
    );
    return leftTip * leftArrival + rightTip * rightArrival;
  }

  void sampleClickSignals(out float travelPulse, out float endpointGlow) {
    travelPulse = 0.0;
    endpointGlow = 0.0;
    for (int signalIndex = 0; signalIndex < 5; signalIndex++) {
      travelPulse = max(
        travelPulse,
        clickTravelPulseAt(
          uSignalProgress[signalIndex],
          uClickAlong[signalIndex],
          uSignalVariation[signalIndex]
        )
      );
      endpointGlow = max(
        endpointGlow,
        clickEndpointGlowAt(
          uSignalProgress[signalIndex],
          uClickAlong[signalIndex],
          uSignalVariation[signalIndex]
        )
      );
    }
  }

  vec3 deformSurface(vec3 current, out float interaction) {
    float ambientWeave =
      sin(uTime * 0.34 + aAlong * 13.0 + aStrand * 5.0) * 0.58 +
      cos(uTime * 0.21 - aAlong * 7.0 + aSeed * 4.0) * 0.42;
    float ambientPulse = 0.72 + sin(uTime * 0.16 + aStrand * 6.28318) * 0.28;
    current.z += ambientWeave * ambientPulse * 0.012 * uDisplacementScale;
    current.xy += vec2(
      cos(uTime * 0.13 + aAlong * 8.0),
      sin(uTime * 0.11 + aAlong * 6.0)
    ) * ambientWeave * 0.0025 * uDisplacementScale;

    float semanticPhase = uStagePhase;
    float latentMotion = stageInfluence(semanticPhase, 0.0);
    float inferenceMotion = stageInfluence(semanticPhase, 1.0);
    float emergenceMotion = stageInfluence(semanticPhase, 2.0);
    float openMotion = stageInfluence(semanticPhase, 3.0);

    // LATENT: contained pressure, breathing toward and away from the core.
    float latentBreath = sin(uTime * 0.58 + aAlong * 2.4 + aStrand) *
      (0.012 + aSeed * 0.006);
    current.xy *= 1.0 + latentMotion * latentBreath;
    current.z += latentMotion * cos(uTime * 0.41 + aAlong * 5.0) * 0.009;

    // INFERENCE: a directional signal travels along the routed form.
    float routeWave = sin(aAlong * 22.0 - uTime * 1.45 + aStrand * 2.2);
    current.x += inferenceMotion * routeWave * 0.008;
    current.z += inferenceMotion * routeWave * 0.024 * uDisplacementScale;

    // EMERGENCE: pulses split from the center and lift through the branches.
    float branchDirection = sin(aStrand * 6.28318);
    float growthWave = sin(uTime * 0.82 - aAlong * 10.0 + aStrand * 4.0);
    current.x += emergenceMotion * branchDirection * growthWave * 0.014;
    current.y += emergenceMotion * growthWave * (0.009 + aAlong * 0.009);

    // OPEN: layers counter-move without closing into a fixed silhouette.
    float openAngle = openMotion * (
      sin(uTime * 0.24 + aSeed * 2.0) +
      cos(uTime * 0.13 + aStrand * 4.0)
    ) * 0.009;
    mat2 openRotation = mat2(
      cos(openAngle), -sin(openAngle),
      sin(openAngle), cos(openAngle)
    );
    current.xy = openRotation * current.xy;
    current.z += openMotion * sin(
      uTime * 0.29 + aStrand * 6.28318 + aAlong * 3.0
    ) * 0.027 * uDisplacementScale;

    vec2 pointerVector = current.xy - uPointerWorld.xy;
    float pointerDistance = length(pointerVector);
    float pointerField = (1.0 - smoothstep(0.08, 0.68, pointerDistance)) *
      uPointerStrength;

    float cursorWake = sin(pointerDistance * 20.0 - uTime * 4.5 + aSeed * 2.0) *
      pointerField * uPointerMotion;
    vec3 outward = normalize(vec3(
      (current.xy - uPointerWorld.xy) * 0.16,
      1.0
    ));
    float displacement = cursorWake * 0.058;
    displacement -= pointerField * uPress * 0.11;
    displacement += pointerField * uPointerMotion * 0.032;
    current += outward * displacement * uDisplacementScale;
    current.xy += uPointerDelta.xy * pointerField * uPointerMotion *
      (0.3 + uDisplacementScale * 0.22);

    float velocityRidge = sin(current.y * 18.0 + aSeed * 5.0) * uVelocity * 0.025;
    current += outward * velocityRidge * uDisplacementScale;
    interaction = clamp(pointerField * (0.25 + uPointerMotion + uPress), 0.0, 1.0);
    return current;
  }
`;

export const surfaceVertexShader = /* glsl */ `
  ${morphVertexChunk}

  varying vec3 vObjectPosition;
  varying vec3 vViewPosition;
  varying float vInteraction;
  varying float vSeed;
  varying float vStage;
  varying float vAlong;
  varying float vStrand;
  varying float vSignalPulse;
  varying float vEndpointGlow;

  void main() {
    float interaction;
    vec3 transformed = deformSurface(morphPosition(), interaction);
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vObjectPosition = transformed;
    vViewPosition = viewPosition.xyz;
    vInteraction = interaction;
    vSeed = aSeed;
    vStage = uScroll;
    vAlong = aAlong;
    vStrand = aStrand;
    sampleClickSignals(vSignalPulse, vEndpointGlow);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const spectralColorChunk = /* glsl */ `
  vec3 cubicPalette(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return clamp(0.5 * (
      2.0 * p1 +
      (-p0 + p2) * t +
      (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
      (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    ), 0.0, 1.0);
  }

  vec3 spectralShift(float time, float offset) {
    float phase = fract(time * 0.07 + offset * 0.028);
    float segment = phase * 10.0;
    float blend = fract(segment);
    vec3 hotPinkTone = vec3(1.0, 0.06, 0.5);
    vec3 magentaTone = vec3(0.82, 0.04, 1.0);
    vec3 ultravioletTone = vec3(0.58, 0.1, 1.0);
    vec3 violetTone = vec3(0.36, 0.04, 0.94);
    vec3 indigoTone = vec3(0.18, 0.12, 1.0);
    vec3 electricBlue = vec3(0.02, 0.32, 1.0);
    vec3 flameBlue = vec3(0.0, 0.58, 1.0);
    vec3 iceBlue = vec3(0.16, 0.86, 1.0);
    vec3 periwinkleTone = vec3(0.42, 0.58, 1.0);
    vec3 orchidTone = vec3(0.78, 0.28, 1.0);
    vec3 spectral;
    if (segment < 1.0) {
      spectral = cubicPalette(orchidTone, hotPinkTone, magentaTone, ultravioletTone, blend);
    } else if (segment < 2.0) {
      spectral = cubicPalette(hotPinkTone, magentaTone, ultravioletTone, violetTone, blend);
    } else if (segment < 3.0) {
      spectral = cubicPalette(magentaTone, ultravioletTone, violetTone, indigoTone, blend);
    } else if (segment < 4.0) {
      spectral = cubicPalette(ultravioletTone, violetTone, indigoTone, electricBlue, blend);
    } else if (segment < 5.0) {
      spectral = cubicPalette(violetTone, indigoTone, electricBlue, flameBlue, blend);
    } else if (segment < 6.0) {
      spectral = cubicPalette(indigoTone, electricBlue, flameBlue, iceBlue, blend);
    } else if (segment < 7.0) {
      spectral = cubicPalette(electricBlue, flameBlue, iceBlue, periwinkleTone, blend);
    } else if (segment < 8.0) {
      spectral = cubicPalette(flameBlue, iceBlue, periwinkleTone, orchidTone, blend);
    } else if (segment < 9.0) {
      spectral = cubicPalette(iceBlue, periwinkleTone, orchidTone, hotPinkTone, blend);
    } else {
      spectral = cubicPalette(periwinkleTone, orchidTone, hotPinkTone, magentaTone, blend);
    }
    float spectralBreath = 0.92 + sin(time * 0.47 + offset * 0.3) * 0.08;
    return spectral * spectralBreath;
  }
`;

export const surfaceFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uPointerWorld;
  uniform float uPointerMotion;
  uniform float uPress;
  uniform float uVelocity;
  uniform float uSurfaceOpacity;
  uniform float uTime;
  uniform float uStagePhase;
  uniform vec3 uSignalColor;

  varying vec3 vObjectPosition;
  varying vec3 vViewPosition;
  varying float vInteraction;
  varying float vSeed;
  varying float vStage;
  varying float vAlong;
  varying float vStrand;
  varying float vSignalPulse;
  varying float vEndpointGlow;

  ${spectralColorChunk}
  float bayer4(vec2 cell) {
    float x = mod(floor(cell.x), 4.0);
    float y = mod(floor(cell.y), 4.0);
    float value = 0.0;
    if (y < 0.5) {
      if (x < 0.5) value = 0.0;
      else if (x < 1.5) value = 8.0;
      else if (x < 2.5) value = 2.0;
      else value = 10.0;
    } else if (y < 1.5) {
      if (x < 0.5) value = 12.0;
      else if (x < 1.5) value = 4.0;
      else if (x < 2.5) value = 14.0;
      else value = 6.0;
    } else if (y < 2.5) {
      if (x < 0.5) value = 3.0;
      else if (x < 1.5) value = 11.0;
      else if (x < 2.5) value = 1.0;
      else value = 9.0;
    } else {
      if (x < 0.5) value = 15.0;
      else if (x < 1.5) value = 7.0;
      else if (x < 2.5) value = 13.0;
      else value = 5.0;
    }
    return (value + 0.5) / 16.0;
  }

  float stageInfluence(float phase, float center) {
    return 1.0 - smoothstep(0.0, 1.0, abs(phase - center));
  }

  void main() {
    vec3 normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    if (!gl_FrontFacing) normal *= -1.0;

    vec3 keyLight = normalize(vec3(0.34, 0.62, 0.72));
    float diffuse = max(dot(normal, keyLight), 0.0);
    float rim = pow(1.0 - abs(dot(normal, normalize(-vViewPosition))), 2.4);
    float pointerDistance = length(vObjectPosition.xy - uPointerWorld.xy);
    float contact = 1.0 - smoothstep(0.05, 0.62, pointerDistance);
    float highlight = pow(max(dot(normal, normalize(vec3(
      uPointerWorld.xy - vObjectPosition.xy,
      0.58
    ))), 0.0), 8.0) * contact;

    float shade = clamp(0.1 + diffuse * 0.62 + rim * 0.52 + highlight * 0.8, 0.0, 1.0);
    float threshold = bayer4(gl_FragCoord.xy);
    float levels = mix(3.0, 6.0, smoothstep(0.42, 0.9, vStage));
    float dithered = floor(shade * levels + threshold) / levels;
    float routedSignal = max(vSignalPulse, vEndpointGlow);
    routedSignal = clamp(routedSignal, 0.0, 1.0);
    routedSignal = smoothstep(0.04, 0.72, routedSignal);
    float coverage = clamp(
      shade * 0.82 + rim * 0.34 + vInteraction * 0.32 + routedSignal * 0.46,
      0.0,
      1.0
    );
    if (coverage < threshold * 0.94) discard;

    vec3 ink = vec3(0.012, 0.015, 0.012);
    vec3 bone = vec3(0.91, 0.898, 0.863);
    vec3 color = mix(ink, bone, dithered * 0.84);
    vec3 spectral = spectralShift(uTime, vStrand * 1.7 + vSeed * 0.4);
    float spectralPresence = 0.3 + rim * 0.24 + (1.0 - dithered) * 0.08;
    color = mix(color, spectral, spectralPresence);
    color += spectral * rim * 0.1;
    float signal = clamp(
      vInteraction * 0.72 + vSignalPulse * 0.82 + vEndpointGlow * 0.74 +
      highlight * (0.2 + uPointerMotion * 0.8) + uPress * contact * 0.38,
      0.0,
      1.0
    );
    float semanticPhase = uStagePhase;
    float latentEffect = stageInfluence(semanticPhase, 0.0) *
      (1.0 - smoothstep(0.16, 0.72, length(vObjectPosition.xy))) *
      (0.45 + sin(uTime * 0.58 + vSeed * 3.0) * 0.2);
    float routeEffect = stageInfluence(semanticPhase, 1.0) * pow(
      0.5 + sin(vAlong * 20.0 - uTime * 1.7) * 0.5,
      9.0
    );
    float emergenceEffect = stageInfluence(semanticPhase, 2.0) * pow(
      0.5 + sin(vAlong * 12.0 - uTime * 0.92 + vStrand * 4.0) * 0.5,
      7.0
    );
    float openEffect = stageInfluence(semanticPhase, 3.0) * rim *
      (0.58 + sin(uTime * 0.34 + vStrand * 6.28318) * 0.24);
    float semanticSignal = clamp(
      latentEffect * 0.2 + routeEffect * 0.62 +
      emergenceEffect * 0.56 + openEffect * 0.58,
      0.0,
      1.0
    );
    signal = clamp(signal + semanticSignal * 0.48, 0.0, 1.0);
    color = mix(color, uSignalColor, signal * (0.16 + rim * 0.34));
    color += uSignalColor * semanticSignal * (0.07 + rim * 0.11);
    color += bone * rim * 0.13;
    color += uSignalColor * uVelocity * rim * 0.08;
    vec3 routedColor = uSignalColor * (0.46 + rim * 0.08);
    color = mix(color, routedColor, routedSignal * 0.96);

    float fade = 0.74 + threshold * 0.2 + rim * 0.06;
    gl_FragColor = vec4(color * fade, uSurfaceOpacity);
  }
`;

export const particleVertexShader = /* glsl */ `
  ${morphVertexChunk}

  attribute float aPointWeight;
  uniform float uPixelRatio;
  uniform float uShell;
  uniform float uPointScale;

  varying float vInteraction;
  varying float vSeed;
  varying float vStage;
  varying float vSignalPulse;
  varying float vEndpointGlow;
  varying float vPointWeight;

  void main() {
    float interaction;
    vec3 transformed = deformSurface(morphPosition(), interaction);
    transformed *= 1.0 + uShell * (0.62 + aSeed * 0.58);
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vInteraction = interaction;
    vSeed = aSeed;
    vStage = uScroll;
    vPointWeight = aPointWeight;
    sampleClickSignals(vSignalPulse, vEndpointGlow);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = 4.2 / max(-viewPosition.z, 0.5);
    gl_PointSize = (3.8 + aSeed * 4.2 + interaction * 3.2 +
      vSignalPulse * 4.8 + vEndpointGlow * 3.6) *
      uPointScale * uPixelRatio * perspective;
  }
`;

export const particleFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uPointerMotion;
  uniform float uPress;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uStagePhase;
  uniform vec3 uSignalColor;

  varying float vInteraction;
  varying float vSeed;
  varying float vStage;
  varying float vSignalPulse;
  varying float vEndpointGlow;
  varying float vPointWeight;

  ${spectralColorChunk}
  float lineMask(float distanceToLine, float width) {
    return 1.0 - smoothstep(width, width + 0.055, distanceToLine);
  }

  float dotMask(vec2 p, float radius) {
    return 1.0 - smoothstep(radius, radius + 0.07, length(p));
  }

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float glyphPhase = uStagePhase;
    float dotPair = max(
      dotMask(p - vec2(0.0, 0.17), 0.075),
      dotMask(p + vec2(0.0, 0.17), 0.075)
    );
    float latentGlyph = mix(dotMask(p, 0.105), dotPair, step(0.58, vSeed));
    float inferenceGlyph = max(
      lineMask(abs(p.y - (0.22 - p.x)), 0.045),
      lineMask(abs(p.y + (0.22 - p.x)), 0.045)
    ) * step(-0.24, p.x) * step(p.x, 0.28);
    float stem = lineMask(abs(p.x), 0.042) * step(-0.31, p.y) * step(p.y, 0.08);
    float branches = max(
      lineMask(abs(p.y - p.x - 0.04), 0.045),
      lineMask(abs(p.y + p.x - 0.04), 0.045)
    ) * step(0.0, p.y);
    float emergenceGlyph = max(stem, branches);
    float openGlyph = 1.0 - smoothstep(0.038, 0.068, abs(length(p) - 0.23));
    float mask = mix(
      latentGlyph,
      inferenceGlyph,
      smoothstep(0.32, 0.68, glyphPhase)
    );
    mask = mix(
      mask,
      emergenceGlyph,
      smoothstep(1.32, 1.68, glyphPhase)
    );
    mask = mix(mask, openGlyph, smoothstep(2.32, 2.68, glyphPhase));

    if (mask < 0.02) discard;
    vec3 bone = vec3(0.91, 0.898, 0.863);
    vec3 spectral = spectralShift(uTime, vSeed * 1.3 + vStage * 0.4);
    float signal = clamp(
      vInteraction + uPointerMotion * vInteraction + uPress * 0.2 +
      vSignalPulse * 0.88 + vEndpointGlow * 0.8,
      0.0,
      1.0
    );
    float routedSignal = max(vSignalPulse, vEndpointGlow);
    routedSignal = clamp(routedSignal, 0.0, 1.0);
    routedSignal = smoothstep(0.04, 0.72, routedSignal);
    vec3 dormantColor = mix(
      bone * (0.42 + vSeed * 0.36),
      spectral,
      0.38 + vSeed * 0.18
    );
    vec3 color = mix(dormantColor, uSignalColor, signal * 0.62);
    color = mix(color, uSignalColor * 0.58, routedSignal * 0.96);
    float alpha = mask * (0.24 + vSeed * 0.34 + signal * 0.42) *
      (1.0 + vEndpointGlow * 0.2) * uOpacity * vPointWeight;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const backgroundVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const backgroundFragmentShader = /* glsl */ `
  precision highp float;

  ${spectralColorChunk}

  uniform sampler2D uArtwork;
  uniform vec2 uResolution;
  uniform vec2 uArtworkResolution;
  uniform float uCompactLayout;
  uniform vec2 uPointerScreen;
  uniform float uPointerStrength;
  uniform float uPointerMotion;
  uniform float uPress;
  uniform float uTime;
  uniform float uScroll;
  uniform float uVelocity;

  varying vec2 vUv;

  float signalLuma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float bayer4(vec2 cell) {
    float x = mod(floor(cell.x), 4.0);
    float y = mod(floor(cell.y), 4.0);
    float value = 0.0;
    if (y < 0.5) {
      if (x < 0.5) value = 0.0;
      else if (x < 1.5) value = 8.0;
      else if (x < 2.5) value = 2.0;
      else value = 10.0;
    } else if (y < 1.5) {
      if (x < 0.5) value = 12.0;
      else if (x < 1.5) value = 4.0;
      else if (x < 2.5) value = 14.0;
      else value = 6.0;
    } else if (y < 2.5) {
      if (x < 0.5) value = 3.0;
      else if (x < 1.5) value = 11.0;
      else if (x < 2.5) value = 1.0;
      else value = 9.0;
    } else {
      if (x < 0.5) value = 15.0;
      else if (x < 1.5) value = 7.0;
      else if (x < 2.5) value = 13.0;
      else value = 5.0;
    }
    return (value + 0.5) / 16.0;
  }

  vec2 coverUv(vec2 uv) {
    float viewportAspect = uResolution.x / uResolution.y;
    float artworkAspect = uArtworkResolution.x / uArtworkResolution.y;
    vec2 scale = vec2(1.0);
    if (viewportAspect > artworkAspect) {
      scale.y = artworkAspect / viewportAspect;
    } else {
      scale.x = viewportAspect / artworkAspect;
    }
    return (uv - 0.5) * scale + 0.5;
  }

  float glyph(vec2 p, float seed) {
    float type = floor(mod(seed * 17.0 + floor(uScroll * 9.0), 4.0));
    float dotGlyph = 1.0 - smoothstep(0.09, 0.15, length(p));
    float vertical = (1.0 - smoothstep(0.035, 0.075, abs(p.x))) * step(abs(p.y), 0.28);
    float horizontal = (1.0 - smoothstep(0.035, 0.075, abs(p.y))) * step(abs(p.x), 0.28);
    float diagonal = (1.0 - smoothstep(0.035, 0.08, abs(p.y - p.x))) * step(abs(p.x), 0.3);
    if (type < 1.0) return dotGlyph;
    if (type < 2.0) return vertical;
    if (type < 3.0) return max(vertical, horizontal);
    return diagonal;
  }

  void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectScale = vec2(aspect, 1.0);
    vec2 pixelUv = gl_FragCoord.xy / uResolution;
    vec2 artworkUv = coverUv(vUv);
    float ambientBreath = sin(uTime * 0.11) * 0.5 + 0.5;
    float imageZoom = mix(0.93, 1.0, uCompactLayout) +
      sin(uTime * 0.17) * 0.018 +
      sin(uTime * 0.061 + 1.3) * 0.007;
    vec2 imagePan = vec2(
      sin(uTime * 0.19) + sin(uTime * 0.073 + 1.1),
      cos(uTime * 0.143 + 0.8) + sin(uTime * 0.057)
    ) * vec2(0.0095, 0.008);
    artworkUv = (artworkUv - 0.5) * imageZoom + 0.5 + imagePan;
    vec2 pointerVector = (pixelUv - uPointerScreen) * aspectScale;
    float pointerDistance = length(pointerVector);
    vec2 pointerDirection = pointerVector / max(pointerDistance, 0.001) / aspectScale;
    float pointerField = (1.0 - smoothstep(0.025, 0.4, pointerDistance)) *
      uPointerStrength;
    float sceneActivity = clamp(
      uPointerMotion * 1.35 + uVelocity * 0.9 + uPress,
      0.0,
      1.0
    );
    float idleWeight = 1.0 - smoothstep(0.025, 0.34, sceneActivity);
    vec2 idleOrbit = vec2(
      0.5 + sin(uTime * 0.13) * 0.28,
      0.5 + cos(uTime * 0.093 + 0.6) * 0.2
    );
    vec2 idleVector = (pixelUv - idleOrbit) * aspectScale;
    float idleDistance = length(idleVector);
    float idleRipple = sin(idleDistance * 17.0 - uTime * 0.52) *
      exp(-idleDistance * 2.7) * idleWeight;
    vec2 idleDirection = idleVector /
      max(idleDistance, 0.001) / aspectScale;

    float foldA = sin(artworkUv.y * 26.0 + uScroll * 9.0 + uTime * 0.17) *
      sin(artworkUv.x * 11.0 - uScroll * 4.0 - uTime * 0.09);
    float foldB = sin(
      artworkUv.x * 31.0 - artworkUv.y * 13.0 + uScroll * 12.0 - uTime * 0.13
    );
    vec2 ambientFlow = vec2(
      sin(artworkUv.y * 8.0 + uTime * 0.19),
      cos(artworkUv.x * 7.0 - uTime * 0.16)
    ) * (0.0011 + ambientBreath * 0.0012);
    float latentState = 1.0 - smoothstep(0.08, 0.31, uScroll);
    float inferenceState = smoothstep(0.08, 0.31, uScroll) *
      (1.0 - smoothstep(0.38, 0.58, uScroll));
    float emergenceState = smoothstep(0.4, 0.63, uScroll) *
      (1.0 - smoothstep(0.7, 0.9, uScroll));
    float openState = smoothstep(0.72, 0.96, uScroll);
    vec2 warpedUv = artworkUv;
    warpedUv = (warpedUv - 0.5) *
      (1.0 + latentState * 0.03 - openState * 0.035) + 0.5;
    warpedUv.x += inferenceState * sin(artworkUv.y * 18.0) * 0.006;
    warpedUv.x += emergenceState * sign(pixelUv.x - 0.5) *
      smoothstep(0.08, 0.48, abs(pixelUv.y - 0.5)) * 0.008;
    warpedUv.x += foldA * (0.0015 + uVelocity * 0.008);
    warpedUv.y += foldB * uScroll * 0.0028;
    warpedUv += ambientFlow;
    warpedUv += idleDirection * idleRipple * 0.0058;
    warpedUv += pointerDirection * pointerField *
      (0.003 + uPointerMotion * 0.016 + uPress * 0.012);

    vec2 texel = 1.0 / uArtworkResolution;
    vec2 layerParallax = vec2(
      cos(uTime * 0.16 + 0.5),
      sin(uTime * 0.127)
    ) * 0.007;
    vec3 clean = texture2D(uArtwork, warpedUv).rgb;
    vec3 layerA = texture2D(
      uArtwork,
      warpedUv + layerParallax + vec2(foldB, foldA) *
        (0.001 + ambientBreath * 0.0007 + uPointerMotion * 0.003)
    ).rgb;
    vec3 layerB = texture2D(
      uArtwork,
      warpedUv - layerParallax * 0.72 - vec2(foldA, foldB) * 0.001
    ).rgb;
    vec3 surface = mix(clean, layerA, 0.28 + uScroll * 0.2);
    surface = mix(
      surface,
      layerB,
      clamp(idleWeight * 0.16 + uPointerMotion * pointerField * 0.16, 0.0, 0.28)
    );

    float edgeX = abs(
      signalLuma(texture2D(uArtwork, warpedUv + vec2(texel.x * 4.0, 0.0)).rgb) -
      signalLuma(texture2D(uArtwork, warpedUv - vec2(texel.x * 4.0, 0.0)).rgb)
    );
    float edgeY = abs(
      signalLuma(texture2D(uArtwork, warpedUv + vec2(0.0, texel.y * 4.0)).rgb) -
      signalLuma(texture2D(uArtwork, warpedUv - vec2(0.0, texel.y * 4.0)).rgb)
    );
    float edge = clamp((edgeX + edgeY) * 4.0, 0.0, 1.0);
    float luma = signalLuma(surface);
    float threshold = bayer4(gl_FragCoord.xy);
    float quantized = floor(clamp(luma * 1.35, 0.0, 1.0) * 5.0 + threshold) / 5.0;

    vec2 glyphGrid = gl_FragCoord.xy / mix(12.0, 8.0, uPointerMotion * pointerField);
    vec2 glyphCell = floor(glyphGrid);
    vec2 glyphUv = fract(glyphGrid) - 0.5;
    float glyphMask = glyph(glyphUv, hash21(glyphCell)) *
      step(threshold * 0.7, edge * 0.78) *
      step(0.025, luma + edge);

    vec3 bone = vec3(0.91, 0.898, 0.863);
    vec3 color = surface * (0.34 + quantized * 0.7);
    color += bone * edge * (0.08 + uScroll * 0.12);
    float paleStructure = smoothstep(0.16, 0.72, luma) * (0.35 + edge * 0.65);
    color += bone * paleStructure * uCompactLayout * 0.11;
    color = mix(color, uSignalColor, glyphMask * (0.16 + pointerField * 0.34));
    color += uSignalColor * pointerField * edge * (uPointerMotion + uPress) * 0.12;

    float vignette = 1.0 - smoothstep(0.32, 0.96, length((pixelUv - 0.5) * vec2(0.66, 1.0)));
    float movingLight = 0.5 + 0.5 * sin(
      pixelUv.x * 7.0 + pixelUv.y * 5.0 - uTime * 0.21 + foldA * 0.55
    );
    float idleScan = pow(
      0.5 + 0.5 * sin(
        pixelUv.x * 4.8 + pixelUv.y * 3.2 - uTime * 0.24
      ),
      7.0
    ) * idleWeight;
    vec3 atmosphericSpectral = spectralShift(
      uTime,
      pixelUv.x * 0.52 + pixelUv.y * 0.31
    );
    float idleWake = abs(idleRipple) * 0.055;
    float atmosphericPresence = (
      0.03 + movingLight * 0.075 + idleScan * 0.16 + idleWake
    ) * vignette;
    color = mix(
      color,
      color + atmosphericSpectral * (0.22 + edge * 0.12),
      atmosphericPresence
    );
    float grain = (hash21(gl_FragCoord.xy + floor(uTime * 0.3)) - 0.5) * 0.012;
    color = color * (0.46 + vignette * 0.54) + grain;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const postVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const asciiDitherPostFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uInteraction;
  uniform float uStage;
  uniform vec3 uSignalColor;

  varying vec2 vUv;

  float signalLuma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  float bayer4(vec2 cell) {
    float x = mod(floor(cell.x), 4.0);
    float y = mod(floor(cell.y), 4.0);
    float value = 0.0;
    if (y < 0.5) {
      if (x < 0.5) value = 0.0;
      else if (x < 1.5) value = 8.0;
      else if (x < 2.5) value = 2.0;
      else value = 10.0;
    } else if (y < 1.5) {
      if (x < 0.5) value = 12.0;
      else if (x < 1.5) value = 4.0;
      else if (x < 2.5) value = 14.0;
      else value = 6.0;
    } else if (y < 2.5) {
      if (x < 0.5) value = 3.0;
      else if (x < 1.5) value = 11.0;
      else if (x < 2.5) value = 1.0;
      else value = 9.0;
    } else {
      if (x < 0.5) value = 15.0;
      else if (x < 1.5) value = 7.0;
      else if (x < 2.5) value = 13.0;
      else value = 5.0;
    }
    return (value + 0.5) / 16.0;
  }

  float glyphMask(vec2 p, float level) {
    float dotGlyph = 1.0 - smoothstep(0.08, 0.15, length(p));
    float vertical = (1.0 - smoothstep(0.035, 0.075, abs(p.x))) * step(abs(p.y), 0.3);
    float horizontal = (1.0 - smoothstep(0.035, 0.075, abs(p.y))) * step(abs(p.x), 0.3);
    float slash = (1.0 - smoothstep(0.035, 0.08, abs(p.y - p.x))) * step(abs(p.x), 0.31);
    float cross = max(
      1.0 - smoothstep(0.035, 0.08, abs(p.y - p.x)),
      1.0 - smoothstep(0.035, 0.08, abs(p.y + p.x))
    ) * step(abs(p.x), 0.31);
    if (level < 0.2) return dotGlyph;
    if (level < 0.4) return vertical;
    if (level < 0.6) return max(vertical, horizontal);
    if (level < 0.8) return slash;
    return cross;
  }

  void main() {
    vec4 sourceSample = texture2D(tDiffuse, vUv);
    vec3 source = sourceSample.rgb;
    float cellSize = mix(10.0, 8.4, clamp(uInteraction, 0.0, 1.0));
    vec2 grid = gl_FragCoord.xy / cellSize;
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    vec2 sampleUv = (cell * cellSize + cellSize * 0.5) / uResolution;
    vec3 cellColor = texture2D(tDiffuse, sampleUv).rgb;
    float luma = signalLuma(cellColor);
    vec2 texel = cellSize / uResolution;
    float edge = abs(luma - signalLuma(texture2D(tDiffuse, sampleUv + vec2(texel.x, 0.0)).rgb)) +
      abs(luma - signalLuma(texture2D(tDiffuse, sampleUv + vec2(0.0, texel.y)).rgb));
    edge = clamp(edge * 2.8, 0.0, 1.0);

    float threshold = bayer4(cell);
    float quantized = floor(clamp(luma * 1.3, 0.0, 1.0) * 5.0 + threshold) / 5.0;
    float glyph = glyphMask(local, quantized);
    float field = smoothstep(0.018, 0.48, luma + edge * 0.8);
    float asciiStrength = field * (0.3 + edge * 0.46 + uInteraction * 0.1);
    float ditherHole = step(threshold * mix(0.9, 0.78, uInteraction), luma + edge * 0.48);

    vec3 bone = vec3(0.91, 0.898, 0.863);
    vec3 glyphColor = mix(
      bone * (0.34 + quantized * 0.72),
      uSignalColor,
      min(0.16, uInteraction * 0.06 + edge * 0.04)
    );
    vec3 dithered = source * mix(0.5, 1.0, ditherHole);
    vec3 color = mix(dithered, glyphColor, glyph * asciiStrength);
    color += source * (0.18 + uStage * 0.08);
    float particleChroma = max(source.g - max(source.r, source.b), 0.0);
    color = mix(color, source * 1.16, smoothstep(0.035, 0.24, particleChroma));
    gl_FragColor = vec4(color, sourceSample.a);
  }
`;
