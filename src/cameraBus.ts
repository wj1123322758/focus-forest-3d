// Camera zoom intent bus.
// ui/ and scene/ never import each other (module boundary), and the focus
// store stays session-only, so zoom intents travel through this shared root
// module: HUD buttons emit, 3D Scene applies them to OrbitControls. The 2D
// fallback scene simply has no listener, where zoom is not applicable.

const listeners = new Set<(factor: number) => void>()

export function onZoomRequest(listener: (factor: number) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function requestZoom(factor: number) {
  listeners.forEach((listener) => listener(factor))
}
