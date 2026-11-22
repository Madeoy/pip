// Pip — an original little creature built entirely from code (no downloaded art).
import * as THREE from 'three';

const mat = (color, rough = 0.65) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
const ball = (r, m, seg = 32) => { const g = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), m); g.castShadow = true; return g; };

export class Pet extends THREE.Group {
  constructor(sfx, opts = {}) {
    super();
    this.sfx = sfx;
    this.opts = opts = { color: '#ff9f6e', belly: '#ffe2c4', ears: 'pointy', eyes: 1, name: 'Pip', ...opts };
    this.name = opts.name;
    const furCol = new THREE.Color(opts.color);
    const fur = mat(furCol), belly = mat(opts.belly), dark = mat(furCol.clone().multiplyScalar(0.78)), pink = mat('#ff8fb1', 0.5);
    this.furMat = fur; this.furColor = furCol.clone(); this.cheekMat = pink;
    this.speedMul = 1; this.sick = false; this.tired = false;
    this.allMats = [fur, belly, dark, pink];
    const white = mat('#ffffff', 0.25), black = mat('#1b1430', 0.2);

    this.bodyRig = new THREE.Group();          // squash & stretch pivot at the feet
    this.add(this.bodyRig);
    const body = ball(0.09, fur, 48); body.position.y = 0.09; body.scale.set(1, 0.92, 1);
    const tummy = ball(0.066, belly); tummy.position.set(0, 0.078, 0.042); tummy.scale.set(1, 1, 0.75);
    this.bodyRig.add(body, tummy);

    // Face
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(0.034 * s, 0.118, 0.07); eye.scale.setScalar(opts.eyes); eye.baseScale = opts.eyes;
      const w = ball(0.022, white); w.scale.set(1, 1.1, 0.7);
      const p = ball(0.0135, black); p.position.z = 0.012;
      const h = ball(0.0045, white); h.position.set(0.004, 0.006, 0.024);
      eye.add(w, p, h); eye.pupil = p; eye.shine = h;
      this.bodyRig.add(eye); this.eyes.push(eye);
      const cheek = ball(0.013, pink); cheek.position.set(0.058 * s, 0.092, 0.06); cheek.scale.set(1, 0.6, 0.4);
      this.bodyRig.add(cheek);
    }
    this.mouth = ball(0.011, black); this.mouth.position.set(0, 0.094, 0.083); this.mouth.scale.set(1.4, 0.5, 0.5);
    this.bodyRig.add(this.mouth);

    // Ears
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(0.045 * s, 0.155, -0.005); ear.rotation.z = -0.38 * s;
      let outer, inner;
      if (opts.ears === 'round') {
        ear.position.y = 0.15;
        outer = ball(0.026, fur); outer.scale.set(1, 1, 0.45); outer.position.y = 0.02;
        inner = ball(0.016, pink); inner.scale.set(1, 1, 0.3); inner.position.set(0, 0.02, 0.009);
      } else if (opts.ears === 'bunny') {
        ear.rotation.z = -0.15 * s;
        outer = ball(0.02, fur); outer.scale.set(0.9, 3.2, 0.5); outer.position.y = 0.06;
        inner = ball(0.012, pink); inner.scale.set(0.8, 3.6, 0.3); inner.position.set(0, 0.058, 0.008);
      } else {
        outer = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.075, 24), fur); outer.position.y = 0.03;
        inner = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 24), pink); inner.position.set(0, 0.024, 0.012);
      }
      outer.castShadow = true;
      ear.add(outer, inner); this.bodyRig.add(ear); this.ears.push(ear);
    }
    // Tail
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.06, -0.085);
    const tb = ball(0.026, belly); tb.position.z = -0.012; this.tail.add(tb);
    this.bodyRig.add(this.tail);
    // Feet
    this.feet = [];
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const f = ball(0.021, dark); f.scale.set(1, 0.7, 1.2); f.position.set(0.045 * x, 0.014, 0.038 * z);
      f.base = f.position.clone(); this.add(f); this.feet.push(f);
    }
    // Mouth slot for carrying things
    this.mouthSlot = new THREE.Object3D(); this.mouthSlot.position.set(0, 0.085, 0.11); this.bodyRig.add(this.mouthSlot);

    this.state = 'idle';
    this.target = null;
    this.speed = 0;
    this.t = 0;
    this.nextBlink = 2;
    this.nextIdleThing = 3;
    this.jump = 0;          // jump timer
    this.happyHops = 0;
    this.carrying = null;
    this.onHearts = null;
    this.onArrive = null;
  }

  // Mood visuals: a little green when sick, droopy and slow when tired.
  setCondition({ sick, tired }) {
    this.sick = sick; this.tired = tired;
    this.furMat.color.copy(this.furColor).lerp(new THREE.Color('#9fd16b'), sick ? 0.45 : 0);
    this.cheekMat.color.set(sick ? '#b7d98a' : '#ff8fb1');
    this.speedMul = sick ? 0.5 : tired ? 0.65 : 1;
  }

  // Fade out when hidden behind real furniture (0 = fully hidden).
  setVisibility(v) {
    for (const m of this.allMats) { m.transparent = v < 0.99; m.opacity = v; }
    this.visible = v > 0.02;
  }

  goTo(point, run = false, onArrive = null) {
    this.target = new THREE.Vector3(point.x, this.position.y, point.z);
    this.speed = (run ? 0.75 : 0.42) * this.speedMul;
    this.state = 'walk';
    this.onArrive = onArrive;
    this.sfx?.chirp(run ? 1.25 : 1);
  }

  sit() { this.target = null; this.state = 'sit'; this.sfx?.chirp(0.9); }
  lieDown() { this.target = null; this.state = 'down'; this.sfx?.chirp(0.8); }

  // Jump to a point at a different height (onto a table, or back down).
  leapTo(point, onLand) {
    this.target = null;
    this.leapFrom = this.position.clone(); this.leapTo = point.clone();
    const d = Math.hypot(point.x - this.position.x, point.z - this.position.z);
    this.leapT = 0; this.leapDur = 0.45 + d * 0.5;
    this.leapH = 0.12 + Math.max(0, point.y - this.position.y) * 0.5;
    this.state = 'leap'; this.onLand = onLand; this.sfx?.chirp(1.7);
  }

  static TRICKS = {
    rollover: 1.3, playdead: 3.2, paw: 1.8, highfive: 1.6, wave: 2.2, speak: 1.0, beg: 2.4, dance: 3.2,
    bow: 2.0, chasetail: 2.6, jumphigh: 0.9, sing: 2.6, shy: 2.2, stretch: 1.8, sniff: 1.8, scratch: 1.8, shakeoff: 1.1, backflip: 1.0,
  };
  trickNow(name) {
    this.target = null; this.state = 'trick'; this.trick = name; this.trickT = 0; this.trickDur = Pet.TRICKS[name] || 1.5;
  }

  animateTrick(dt, t, lift, sx, sy) {
    this.trickT += dt;
    const p = Math.min(1, this.trickT / this.trickDur);
    const [fl, fr, bl] = this.feet;
    const R = this.bodyRig.rotation;
    this.mouthOpen = false;
    switch (this.trick) {
      case 'rollover': R.z = p * Math.PI * 2; lift = Math.sin(p * Math.PI) * 0.035; break;
      case 'backflip': R.x = -p * Math.PI * 2; lift = Math.sin(p * Math.PI) * 0.16; sy = p < 0.1 ? 0.8 : 1; break;
      case 'playdead': {
        const k = p < 0.12 ? p / 0.12 : p > 0.9 ? (1 - p) / 0.1 : 1;
        R.z = k * 1.45; lift = -k * 0.02; this.eyesShut = k > 0.5;
        fl.position.y = fl.base.y + k * 0.03; fr.position.y = fr.base.y + k * 0.03; break;
      }
      case 'paw': case 'highfive': {
        const up = Math.sin(Math.min(1, p * 1.6) * Math.PI / 2) * (p > 0.85 ? (1 - p) / 0.15 : 1);
        fr.position.y = fr.base.y + up * (this.trick === 'highfive' ? 0.1 : 0.055);
        fr.position.z = fr.base.z + up * 0.03; R.x = -0.18 * up; sy = 1 + 0.05 * up; break;
      }
      case 'wave': fr.position.y = fr.base.y + 0.08; fr.position.x = fr.base.x + Math.sin(t * 14) * 0.02; R.x = -0.15; break;
      case 'speak': this.mouthOpen = Math.sin(p * Math.PI * 3) > 0; lift = Math.max(0, Math.sin(p * Math.PI * 3)) * 0.015; break;
      case 'beg': sy = 1.16; sx = 0.92; R.x = -0.38; fl.position.y = fl.base.y + 0.05; fr.position.y = fr.base.y + 0.05; fl.position.z = fr.position.z = fl.base.z + 0.02; break;
      case 'dance': R.z = Math.sin(t * 10) * 0.28; lift = Math.abs(Math.sin(t * 10)) * 0.03; this.rotation.y += Math.sin(t * 5) * dt * 3; this.mouthOpen = true; break;
      case 'bow': R.x = 0.45 * Math.sin(Math.min(1, p * 3) * Math.PI / 2) * (p > 0.85 ? (1 - p) / 0.15 : 1); break;
      case 'chasetail': this.rotation.y += dt * 11; lift = Math.abs(Math.sin(t * 22)) * 0.012; break;
      case 'jumphigh': lift = Math.sin(p * Math.PI) * 0.26; sy = p < 0.12 ? 0.75 : 1.15; sx = 2 - sy; break;
      case 'sing': this.mouthOpen = Math.sin(t * 9) > 0; R.z = Math.sin(t * 3) * 0.12; sy = 1.05; break;
      case 'shy': this.eyesShut = true; sy = 0.88; sx = 1.08; R.x = 0.15; this.ears.forEach((e) => (e.rotation.x = 0.5)); break;
      case 'stretch': R.x = p < 0.5 ? 0.4 * Math.sin(p * 2 * Math.PI) : -0.25 * Math.sin((p - 0.5) * 2 * Math.PI); sx = 1.1; break;
      case 'sniff': R.x = 0.3 + Math.sin(t * 25) * 0.04; lift = 0; break;
      case 'scratch': bl.position.y = bl.base.y + 0.03 + Math.sin(t * 30) * 0.015; R.z = -0.2; break;
      case 'shakeoff': this.bodyRig.rotation.y = Math.sin(t * 45) * 0.35 * (1 - p); break;
    }
    if (p >= 1) { this.state = 'idle'; this.mouthOpen = false; R.set(0, 0, 0); }
    return { lift, sx, sy };
  }
  spin() { this.target = null; this.state = 'spin'; this.spinLeft = Math.PI * 4; this.sfx?.chirp(1.4); }
  sleep() { this.target = null; this.state = 'sleep'; this.zzz = 0.3; }
  hop() { this.target = null; this.state = 'hop'; this.jump = 0; this.sfx?.chirp(1.5); }
  hideAt(point) {
    this.goTo(point, true, () => { this.state = 'hiding'; });
  }

  happy(hops = 3) {
    this.state = 'happy'; this.target = null; this.happyHops = hops; this.jump = 0;
    this.onHearts?.(this.localToWorld(new THREE.Vector3(0, 0.2, 0)), 5);
    this.sfx?.happy();
  }

  update(dt, cameraPos) {
    this.t += dt;
    const t = this.t;
    let walking = false;

    // Leaping up onto (or down off) a table.
    if (this.state === 'leap') {
      this.leapT += dt;
      const p = Math.min(1, this.leapT / this.leapDur);
      const e = p * p * (3 - 2 * p);
      this.position.lerpVectors(this.leapFrom, this.leapTo, e);
      this.position.y += Math.sin(p * Math.PI) * this.leapH;
      const to = this.leapTo.clone().sub(this.leapFrom);
      if (to.x || to.z) this.rotation.y = lerpAngle(this.rotation.y, Math.atan2(to.x, to.z), 1 - Math.exp(-dt * 12));
      if (p >= 1) { this.state = 'idle'; const cb = this.onLand; this.onLand = null; cb?.(); }
    }

    // Movement
    if (this.state === 'leap') {
      // handled above
    } else if (this.target) {
      const to = this.target.clone().sub(this.position); to.y = 0;
      const dist = to.length();
      const wantYaw = Math.atan2(to.x, to.z);
      this.rotation.y = lerpAngle(this.rotation.y, wantYaw, 1 - Math.exp(-dt * 10));
      if (dist > 0.03) {
        const facing = Math.abs(angleDiff(this.rotation.y, wantYaw)) < 0.9;
        if (facing) this.position.addScaledVector(to.normalize(), Math.min(dist, this.speed * dt));
        walking = true;
      } else {
        this.target = null;
        this.state = 'idle';
        const cb = this.onArrive; this.onArrive = null; cb?.();
      }
    } else if (!['eat', 'spin', 'sleep', 'hiding', 'trick'].includes(this.state) && cameraPos) {
      // Face where we're walking together, otherwise look at you.
      let yaw;
      if (this.faceYaw != null) yaw = this.faceYaw;
      else { const to = cameraPos.clone().sub(this.position); yaw = Math.atan2(to.x, to.z); }
      this.rotation.y = lerpAngle(this.rotation.y, yaw, 1 - Math.exp(-dt * 3));
    }

    // Body animation
    let lift = 0, sx = 1, sy = 1;
    if (walking) {
      const ph = t * (this.speed > 0.6 ? 20 : 15);
      lift = Math.abs(Math.sin(ph)) * 0.014;
      this.feet.forEach((f, i) => {
        const o = Math.sin(ph + (i % 2 === (i < 2 ? 0 : 1) ? 0 : Math.PI));
        f.position.z = f.base.z + o * 0.018; f.position.y = f.base.y + Math.max(0, o) * 0.012;
      });
      this.bodyRig.rotation.z = Math.sin(ph) * 0.06;
    } else {
      this.feet.forEach((f) => { f.position.lerp(f.base, 0.2); });
      this.bodyRig.rotation.z *= 0.9;
      const breathe = Math.sin(t * 2.4) * 0.018;
      sy = 1 + breathe; sx = 1 - breathe * 0.5;
    }

    if (this.state === 'happy') {
      this.jump += dt * 2.6;
      const p = this.jump % 1;
      lift = Math.sin(p * Math.PI) * 0.09;
      if (p < 0.12) { sy = 0.8; sx = 1.15; } else { sy = 1.12; sx = 0.94; }
      this.rotation.y += dt * 4;
      if (this.jump >= this.happyHops) { this.state = 'idle'; this.jump = 0; }
    } else if (this.state === 'idle' && !this.target) {
      this.nextIdleThing -= dt;
      if (this.nextIdleThing < 0) {
        this.nextIdleThing = 3 + Math.random() * 4;
        if (Math.random() < 0.5) { this.state = 'hop'; this.jump = 0; this.sfx?.chirp(1.5); }
      }
    }
    if (this.state === 'hop') {
      this.jump += dt * 3; lift = Math.sin(Math.min(1, this.jump) * Math.PI) * 0.04;
      if (this.jump >= 1) { this.state = 'idle'; this.jump = 0; }
    }
    if (this.state === 'eat') {
      const ph = t * 18; sy = 1 + Math.sin(ph) * 0.05; this.bodyRig.rotation.x = 0.25 + Math.sin(ph) * 0.05;
    } else if (this.state === 'sit') {
      sy = 0.86; sx = 1.08; this.bodyRig.rotation.x = -0.18;
    } else if (this.state === 'sleep') {
      sy = 0.8 + Math.sin(t * 1.5) * 0.03; sx = 1.12; this.bodyRig.rotation.x = 0.12;
      this.zzz = (this.zzz || 0) - dt;
      if (this.zzz < 0) { this.zzz = 1.6; this.onEmote?.(this, 'z z z'); }
    } else if (this.state === 'hiding') {
      // Crouch low, peek up now and then.
      const peek = Math.max(0, Math.sin(t * 1.3)) ** 6;
      sy = 0.55 + peek * 0.45; sx = 1.2 - peek * 0.2;
    } else this.bodyRig.rotation.x *= 0.85;
    if (this.state === 'spin') {
      this.spinLeft -= dt * 9; this.rotation.y += dt * 9; lift = Math.abs(Math.sin(this.spinLeft)) * 0.02;
      if (this.spinLeft <= 0) { this.state = 'idle'; }
    }
    if (this.state === 'down') { sy = 0.68; sx = 1.18; this.bodyRig.rotation.x = 0.08; }
    if (this.state === 'leap') { const p = this.leapT / this.leapDur; sy = p < 0.15 ? 0.8 : p > 0.85 ? 0.85 : 1.12; sx = 2 - sy; }
    this.eyesShut = false;
    this.bodyRig.rotation.y *= 0.8;
    if (this.state === 'trick') ({ lift, sx, sy } = this.animateTrick(dt, t, lift, sx, sy));

    this.bodyRig.position.y = lift;
    this.bodyRig.scale.set(sx, sy, sx);

    // Ears, tail, mouth
    this.ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 3 + i) * 0.08 - (walking ? 0.2 : 0); });
    const wag = this.state === 'happy' || (this.state === 'trick' && ['bow', 'beg', 'dance', 'speak'].includes(this.trick));
    this.tail.rotation.y = Math.sin(t * (wag ? 22 : 6)) * 0.6;
    const mouthOpen = this.state === 'happy' || this.state === 'eat' || this.mouthOpen ? 1.4 : 0.5;
    this.mouth.scale.y += (mouthOpen - this.mouth.scale.y) * 0.2;

    // Eyes: blink + look at camera
    this.nextBlink -= dt;
    const blink = this.nextBlink < 0.12 ? 0.12 : 1;
    if (this.nextBlink < 0) this.nextBlink = 2 + Math.random() * 4;
    const closed = this.state === 'sleep' || this.eyesShut ? 0.1 : (this.tired || this.sick) ? 0.62 : 1;
    for (const e of this.eyes) {
      e.scale.y = blink * closed * e.baseScale;
      if (cameraPos) {
        const local = this.bodyRig.worldToLocal(cameraPos.clone()).sub(e.position).normalize();
        e.pupil.position.x = THREE.MathUtils.clamp(local.x * 0.009, -0.007, 0.007);
        e.pupil.position.y = THREE.MathUtils.clamp(local.y * 0.009, -0.007, 0.007);
      }
    }
  }
}

export class Ball extends THREE.Mesh {
  constructor() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#7c5cff'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#ffd25e'; g.fillRect(0, 24, 128, 16);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    super(new THREE.SphereGeometry(0.028, 32, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
    this.castShadow = true;
    this.vel = new THREE.Vector3();
    this.held = false;
    this.r = 0.028;
  }
  step(dt, floorY, sfx) {
    if (this.held) return;
    this.vel.y -= 9.8 * dt;
    this.position.addScaledVector(this.vel, dt);
    if (this.position.y < floorY + this.r) {
      this.position.y = floorY + this.r;
      if (Math.abs(this.vel.y) > 0.5) sfx?.bounce(Math.min(1, Math.abs(this.vel.y) / 4));
      this.vel.y = -this.vel.y * 0.55;
      this.vel.x *= 0.82; this.vel.z *= 0.82;
      if (Math.abs(this.vel.y) < 0.15) this.vel.y = 0;
    }
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.rotation.x += this.vel.z * dt / this.r; this.rotation.z -= this.vel.x * dt / this.r;
    if (this.position.y <= floorY + this.r + 0.001 && sp < 0.02) { this.vel.set(0, 0, 0); }
  }
  get resting() { return !this.held && this.vel.lengthSq() < 0.0004; }
}

export function makeBowl() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.03, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#7c5cff', roughness: 0.5, side: THREE.DoubleSide }));
  bowl.position.y = 0.015; bowl.castShadow = true;
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.042, 40), bowl.material); base.rotation.x = -Math.PI / 2; base.position.y = 0.001;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.05, 40), new THREE.MeshStandardMaterial({ color: '#5ad1e6', roughness: 0.1, transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.024;
  g.add(bowl, base, water); g.water = water;
  return g;
}

export function makeTreat() {
  const g = new THREE.Group();
  const cookie = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 32), new THREE.MeshStandardMaterial({ color: '#d99a52', roughness: 0.9 }));
  cookie.castShadow = true; cookie.position.y = 0.006; g.add(cookie);
  const chip = new THREE.MeshStandardMaterial({ color: '#4a2a17', roughness: 0.8 });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1, r = 0.006 + (i % 3) * 0.007;
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 6), chip);
    c.position.set(Math.cos(a) * r, 0.013, Math.sin(a) * r); g.add(c);
  }
  g.vy = 0;
  return g;
}

// Little floating hearts
const heartTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff4f8b';
  g.beginPath(); g.moveTo(32, 54);
  g.bezierCurveTo(4, 36, 6, 10, 22, 10); g.bezierCurveTo(28, 10, 32, 15, 32, 19);
  g.bezierCurveTo(32, 15, 36, 10, 42, 10); g.bezierCurveTo(58, 10, 60, 36, 32, 54); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
export class Hearts extends THREE.Group {
  burst(pos, n = 5) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, Math.random() * 0.04, (Math.random() - 0.5) * 0.12));
      s.scale.setScalar(0.035 + Math.random() * 0.02);
      s.life = 0; s.delay = i * 0.08; s.vx = (Math.random() - 0.5) * 0.05;
      this.add(s);
    }
  }
  update(dt) {
    for (const s of [...this.children]) {
      if (s.delay > 0) { s.delay -= dt; s.visible = false; continue; }
      s.visible = true; s.life += dt;
      s.position.y += dt * 0.12; s.position.x += s.vx * dt;
      s.material.opacity = Math.max(0, 1 - s.life / 1.4);
      if (s.life > 1.4) { this.remove(s); s.material.dispose(); }
    }
  }
}

function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function lerpAngle(a, b, k) { return a + angleDiff(a, b) * k; }
