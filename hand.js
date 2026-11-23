// Sees your hand through the camera (on the phone, nothing uploaded) so the pet can put toys in it.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandSeer {
  constructor(video) {
    this.video = video;
    this.palm = null;        // { x, y } in screen pixels
    this.lastSeen = 0;
    this.running = false;
    this.busy = false;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    try {
      const { FilesetResolver, HandLandmarker } = await import(`${MP}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
      const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try { this.lm = await make('GPU'); } catch { this.lm = await make('CPU'); }
    } catch (e) { console.warn('Hand tracking unavailable', e); this.running = false; return; }
    this.loop();
  }

  stop() { this.running = false; this.palm = null; }

  get visible() { return !!this.palm && performance.now() - this.lastSeen < 600; }

  loop = () => {
    if (!this.running) return;
    const v = this.video;
    if (v.readyState >= 2 && !this.busy) {
      this.busy = true;
      try {
        const res = this.lm.detectForVideo(v, performance.now());
        const pts = res.landmarks?.[0];
        if (pts) {
          // Palm centre ≈ average of wrist and the knuckles.
          const ids = [0, 5, 9, 13, 17];
          let nx = 0, ny = 0; for (const i of ids) { nx += pts[i].x; ny += pts[i].y; }
          nx /= ids.length; ny /= ids.length;
          const pt = this.toScreen(nx, ny);
          if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) { this.palm = pt; this.lastSeen = performance.now(); }
        }
      } catch {}
      this.busy = false;
    }
    setTimeout(this.loop, 90);   // ~11 times a second is plenty
  };

  // The video is shown with object-fit: cover, so map through the crop.
  toScreen(nx, ny) {
    const v = this.video, W = innerWidth, H = innerHeight;
    if (!v.videoWidth || !v.videoHeight) return { x: NaN, y: NaN };
    const s = Math.max(W / v.videoWidth, H / v.videoHeight);
    const dw = v.videoWidth * s, dh = v.videoHeight * s;
    return { x: (W - dw) / 2 + nx * dw, y: (H - dh) / 2 + ny * dh };
  }
}
