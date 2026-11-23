// Learns where the real floor is from the camera picture, so the ball bounces
// off walls/cabinets and the pet walks around them instead of through them.
import * as THREE from 'three';

const CELL = 0.1, R = 40, N = R * 2 + 1;           // 8 m x 8 m map around you
const MW = 64;                                     // mask width in pixels

export class WalkMap {
  constructor(camera, video) {
    this.camera = camera; this.video = video;
    this.s = new Float32Array(N * N);              // <0 blocked, >0 floor, 0 unknown
    this.cv = document.createElement('canvas');
    this.cx = this.cv.getContext('2d', { willReadFrequently: true });
    this.t = 0; this.v = new THREE.Vector3();
  }
  reset() { this.s.fill(0); }
  idx(x, z) { const i = Math.round(x / CELL) + R, j = Math.round(z / CELL) + R; return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; }
  blocked(x, z) { const k = this.idx(x, z); return k >= 0 && this.s[k] < -0.3; }
  free(x, z) { const k = this.idx(x, z); return k >= 0 && this.s[k] >= -0.3; }

  // Look at the camera picture and learn floor vs. not-floor.
  update(dt, seedPts = []) {
    this.t -= dt; if (this.t > 0) return; this.t = 0.3;
    const v = this.video; if (!v.videoWidth) return;
    const W = innerWidth, H = innerHeight, vw = v.videoWidth, vh = v.videoHeight;
    const sc = Math.max(W / vw, H / vh), sw = W / sc, sh = H / sc;
    const MH = Math.round(MW * H / W); this.cv.width = MW; this.cv.height = MH;
    this.cx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, MW, MH);
    const d = this.cx.getImageData(0, 0, MW, MH).data;
    const cam = this.camera;
    // Only trust it when looking down at the floor a bit.
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); if (fwd.y > -0.15) return;
    // Seeds: bottom-centre of the screen + points known to be floor (e.g. under the pet).
    const seeds = [];
    for (let x = MW * 0.4; x <= MW * 0.6; x += 2) seeds.push([x | 0, MH - 2]);
    for (const p of seedPts) { const q = this.v.set(p.x, 0, p.z).project(cam); if (q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95) seeds.push([((q.x + 1) / 2 * MW) | 0, ((1 - q.y) / 2 * MH) | 0]); }
    let rr = 0, gg = 0, bb = 0;
    for (const [x, y] of seeds) { const o = (y * MW + x) * 4; rr += d[o]; gg += d[o + 1]; bb += d[o + 2]; }
    rr /= seeds.length; gg /= seeds.length; bb /= seeds.length;
    const lum = (rr + gg + bb) / 3, T = 40 + lum * 0.25;
    const fl = new Uint8Array(MW * MH), st = [];
    for (const [x, y] of seeds) { const k = y * MW + x; if (!fl[k]) { fl[k] = 1; st.push(k); } }
    while (st.length) {
      const k = st.pop(), x = k % MW;
      for (const n of [k - 1, k + 1, k - MW, k + MW]) {
        if (n < 0 || n >= MW * MH || fl[n] || Math.abs((n % MW) - x) > 1) continue;
        const o = n * 4, dr = d[o] - rr, dg = d[o + 1] - gg, db = d[o + 2] - bb;
        if (Math.sqrt(dr * dr + dg * dg + db * db) < T) { fl[n] = 1; st.push(n); }
      }
    }
    this.mask = fl; this.MH = MH;
    // Write what we saw into the room map.
    const cp = new THREE.Vector3(); cam.getWorldPosition(cp);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i - R) * CELL, z = (j - R) * CELL, dist = Math.hypot(x - cp.x, z - cp.z);
      if (dist < 0.3 || dist > 3.5) continue;
      const q = this.v.set(x, 0, z).project(cam);
      if (q.z > 1 || Math.abs(q.x) > 0.97 || Math.abs(q.y) > 0.97) continue;
      const px = ((q.x + 1) / 2 * MW) | 0, py = ((1 - q.y) / 2 * MH) | 0, k = j * N + i;
      this.s[k] = Math.max(-1, Math.min(1, this.s[k] + (fl[py * MW + px] ? 0.35 : -0.35)));
    }
  }

  // Direction pointing from the wall back into the room (for bounces).
  normal(x, z) {
    let nx = 0, nz = 0;
    for (let a = 0; a < 8; a++) {
      const ax = Math.cos(a * Math.PI / 4), az = Math.sin(a * Math.PI / 4);
      if (this.free(x + ax * 0.25, z + az * 0.25)) { nx += ax; nz += az; }
    }
    const l = Math.hypot(nx, nz); return l ? [nx / l, nz / l] : null;
  }

  nearestFree(p) {
    if (this.free(p.x, p.z)) return p;
    for (let r = 1; r < 15; r++) for (let a = 0; a < 16; a++) {
      const x = p.x + Math.cos(a / 16 * Math.PI * 2) * r * CELL, z = p.z + Math.sin(a / 16 * Math.PI * 2) * r * CELL;
      if (this.free(x, z)) return new THREE.Vector3(x, p.y, z);
    }
    return p;
  }

  clear(a, b) {   // straight line stays on the floor?
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.5));
    for (let i = 1; i <= n; i++) { const t = i / n; if (this.blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; }
    return true;
  }

  // A* around walls; returns waypoints (excluding the start) or null.
  plan(from, to) {
    if (this.clear(from, to)) return [to];
    const s = this.idx(from.x, from.z), g = this.idx(to.x, to.z); if (s < 0 || g < 0) return null;
    const cost = new Float32Array(N * N).fill(1e9), prev = new Int32Array(N * N).fill(-1), open = [s];
    const gx = g % N, gz = (g / N) | 0, h = (k) => Math.hypot(k % N - gx, ((k / N) | 0) - gz);
    cost[s] = 0; let it = 0;
    while (open.length && it++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (cost[open[i]] + h(open[i]) < cost[open[bi]] + h(open[bi])) bi = i;
      const k = open.splice(bi, 1)[0]; if (k === g) break;
      const kx = k % N, kz = (k / N) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = kx + dx, nz = kz + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const n = nz * N + nx; if (this.s[n] < -0.3) continue;
        const c = cost[k] + (dx && dz ? 1.414 : 1); if (c < cost[n]) { cost[n] = c; prev[n] = k; if (!open.includes(n)) open.push(n); }
      }
    }
    if (prev[g] < 0) return null;
    const pts = []; for (let k = g; k !== s && k >= 0; k = prev[k]) pts.unshift(new THREE.Vector3((k % N - R) * CELL, to.y, (((k / N) | 0) - R) * CELL));
    pts[pts.length - 1] = to.clone();
    // Smooth: keep only the turns we need.
    const out = []; let a = from;
    for (let i = 0; i < pts.length; i++) { if (i === pts.length - 1 || !this.clear(a, pts[i + 1])) { out.push(pts[i]); a = pts[i]; } }
    return out;
  }
}
