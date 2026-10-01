import { requestZoom } from '../cameraBus'

const ZOOM_IN = 0.82
const ZOOM_OUT = 1 / ZOOM_IN

export default function ZoomButtons() {
  return (
    <div className="hud-zoom">
      <button
        type="button"
        className="hud-zoom__btn"
        aria-label="放大"
        onClick={() => requestZoom(ZOOM_IN)}
      >
        ＋
      </button>
      <button
        type="button"
        className="hud-zoom__btn"
        aria-label="缩小"
        onClick={() => requestZoom(ZOOM_OUT)}
      >
        －
      </button>
    </div>
  )
}
