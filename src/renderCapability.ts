const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software rasterizer/i;

export function isSoftwareWebGLRenderer(renderer: string | null | undefined) {
  return Boolean(renderer && SOFTWARE_RENDERER.test(renderer));
}
