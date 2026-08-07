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

  uniform vec2 uResolution;
  uniform float uCompactLayout;
  uniform vec2 uPointerScreen;
  uniform float uPointerStrength;
  uniform float uPointerMotion;
  uniform float uPress;
  uniform float uTime;
  uniform float uScroll;
  uniform float uVelocity;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += noise21(p) * amplitude;
      p = mat2(1.58, -1.16, 1.16, 1.58) * p + 7.13;
      amplitude *= 0.48;
    }
    return value;
  }

  float softLight(vec2 p, vec2 center, vec2 radius) {
    return exp(-dot((p - center) / radius, (p - center) / radius));
  }

  void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 pointer = (uPointerScreen - 0.5) * vec2(aspect, 1.0);
    float activeTime = uTime * 0.055;
    vec2 drift = vec2(sin(activeTime * 0.7), cos(activeTime * 0.52)) * 0.11;
    float cloud = fbm(p * 1.42 + drift + vec2(uScroll * 0.26, -uScroll * 0.12));
    float cloudFine = fbm(p * 4.8 - drift * 1.7 + 19.0);

    float drive = 1.0 - smoothstep(0.12, 0.3, uScroll);
    float duel = smoothstep(0.12, 0.28, uScroll) * (1.0 - smoothstep(0.4, 0.56, uScroll));
    float island = smoothstep(0.39, 0.57, uScroll) * (1.0 - smoothstep(0.68, 0.84, uScroll));
    float cosmic = smoothstep(0.67, 0.88, uScroll);

    vec3 ink = vec3(0.006, 0.003, 0.014);
    vec3 plum = vec3(0.072, 0.012, 0.12);
    vec3 violet = vec3(0.24, 0.03, 0.54);
    vec3 blue = vec3(0.015, 0.16, 0.52);
    vec3 pink = vec3(0.46, 0.018, 0.2);
    vec3 ice = vec3(0.08, 0.46, 0.62);
    vec3 color = ink;

    float baseHaze = smoothstep(0.28, 0.91, cloud) * (0.055 + cloudFine * 0.03);
    color += mix(plum, violet, cloudFine) * baseHaze;

    float roadHaze = exp(-pow(abs(p.y + 0.3 + sin(p.x * 1.45 - uTime * 0.09) * 0.06) * 3.0, 1.45));
    roadHaze *= 1.0 - smoothstep(0.15, 1.35, abs(p.x));
    color += mix(blue, violet, cloud) * roadHaze * drive * 0.075;

    float leftDuel = softLight(p, vec2(-0.46, 0.02), vec2(0.4, 0.62));
    float rightDuel = softLight(p, vec2(0.48, 0.04), vec2(0.4, 0.62));
    color += (leftDuel * vec3(0.17, 0.15, 0.16) + rightDuel * violet) * duel * 0.13;

    float islandLift = softLight(p, vec2(0.28, -0.2), vec2(0.75, 0.4));
    color += mix(violet, ice, cloudFine) * islandLift * island * 0.095;

    vec2 galaxyP = p - vec2(0.12, 0.05);
    galaxyP = mat2(0.88, -0.48, 0.48, 0.88) * galaxyP;
    float galaxyBand = exp(-abs(galaxyP.y + sin(galaxyP.x * 2.3) * 0.08) * 7.0) *
      (1.0 - smoothstep(0.1, 1.45, abs(galaxyP.x)));
    color += mix(violet, pink, cloud) * galaxyBand * cosmic * 0.13;

    vec2 starCell = floor((uv + vec2(uTime * 0.0009, 0.0)) * uResolution / mix(2.2, 3.1, uCompactLayout));
    float starHash = hash21(starCell);
    float stars = step(mix(0.9976, 0.9962, cosmic), starHash) *
      (0.42 + fract(starHash * 37.0) * 0.58);
    color += mix(vec3(0.46, 0.54, 0.8), vec3(0.85, 0.79, 0.96), starHash) * stars *
      mix(0.08, 0.44, cosmic);

    float pointerField = 1.0 - smoothstep(0.02, 0.54, length(p - pointer));
    vec3 pointerTone = spectralShift(uTime, uv.x + uv.y);
    color += pointerTone * pointerField * uPointerStrength *
      (0.012 + uPointerMotion * 0.025 + uPress * 0.012);

    float vignette = 1.0 - smoothstep(0.45, 1.25, length(p * vec2(0.7, 1.12)));
    float grain = hash21(gl_FragCoord.xy + floor(uTime * 0.4)) - 0.5;
    color *= 0.52 + vignette * 0.48;
    color += grain * 0.008 + uVelocity * cloudFine * 0.004;
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

export const semanticBloomFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uStrength;
  uniform float uRadius;
  uniform vec3 uSignalColor;

  varying vec2 vUv;

  float semanticLuma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  vec3 semanticLight(vec3 color) {
    float spectral = max(max(color.r, color.b) - color.g * 0.28, 0.0);
    float signal = max(color.g - max(color.r, color.b) * 0.62, 0.0);
    float pale = smoothstep(0.54, 0.92, semanticLuma(color));
    float gate = clamp(max(pale, spectral * 0.72) + signal * 0.92, 0.0, 1.0);
    return color * gate;
  }

  void main() {
    vec4 sourceSample = texture2D(tDiffuse, vUv);
    vec2 texel = uRadius / uResolution;
    vec3 nearBloom = vec3(0.0);
    nearBloom += semanticLight(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
    nearBloom += semanticLight(texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb);
    nearBloom += semanticLight(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
    nearBloom += semanticLight(texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb);
    vec2 farTexel = texel * 2.35;
    vec3 farBloom = vec3(0.0);
    farBloom += semanticLight(texture2D(tDiffuse, vUv + farTexel).rgb);
    farBloom += semanticLight(texture2D(tDiffuse, vUv - farTexel).rgb);
    farBloom += semanticLight(texture2D(tDiffuse, vUv + vec2(farTexel.x, -farTexel.y)).rgb);
    farBloom += semanticLight(texture2D(tDiffuse, vUv + vec2(-farTexel.x, farTexel.y)).rgb);
    vec3 bloom = nearBloom * 0.18 + farBloom * 0.075;
    gl_FragColor = vec4(sourceSample.rgb + bloom * uStrength, sourceSample.a);
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
    float asciiStrength = field * (0.045 + edge * 0.11 + uInteraction * 0.62);
    float ditherHole = step(threshold * mix(0.9, 0.78, uInteraction), luma + edge * 0.48);

    vec3 bone = vec3(0.91, 0.898, 0.863);
    vec3 glyphColor = mix(
      bone * (0.34 + quantized * 0.72),
      uSignalColor,
      min(0.16, uInteraction * 0.06 + edge * 0.04)
    );
    vec3 dithered = source * mix(1.0, mix(0.58, 1.0, ditherHole), uInteraction);
    vec3 color = mix(dithered, glyphColor, glyph * asciiStrength);
    color += source * (0.18 + uStage * 0.08);
    float particleChroma = max(source.g - max(source.r, source.b), 0.0);
    color = mix(color, source * 1.16, smoothstep(0.035, 0.24, particleChroma));
    gl_FragColor = vec4(color, sourceSample.a);
  }
`;
