export type RendererSupport = 'webgpu' | 'webgl2' | 'none'

let cached: RendererSupport | null = null

// The 3D scene runs on WebGPURenderer, which silently switches to a WebGL2
// backend when WebGPU is missing, so either capability is enough. The only
// environment that needs the 2D fallback is one with no usable GPU backend
// at all (some embedded / in-app browsers, remote desktops).
export function detectRendererSupport(): RendererSupport {
  if (cached !== null) return cached
  cached = 'none'
  try {
    if ('gpu' in navigator) {
      cached = 'webgpu'
    } else {
      // Probing costs one throwaway context, released immediately via
      // WEBGL_lose_context so it does not eat into the browser's context budget.
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
        cached = 'webgl2'
      }
    }
  } catch {
    cached = 'none'
  }
  return cached
}

export function useRendererSupport(): RendererSupport {
  return detectRendererSupport()
}
