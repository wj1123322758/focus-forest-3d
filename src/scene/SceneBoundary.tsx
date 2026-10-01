import { Component, type ReactNode } from 'react'
import FallbackScene from './FallbackScene'

interface Props {
  children: ReactNode
}

interface State {
  crashed: boolean
}

// Keeps a WebGL/runtime failure inside the 3D scene from taking the whole app
// down: HUD and session logic stay alive on the 2D fallback.
export default class SceneBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('[focus-forest] 3D scene crashed, falling back to 2D:', error)
  }

  render(): ReactNode {
    return this.state.crashed ? <FallbackScene /> : this.props.children
  }
}
