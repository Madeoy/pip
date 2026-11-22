// Pip — an original little creature built entirely from code (no downloaded art).
import * as THREE from 'three';

const mat = (color, rough = 0.65) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
const ball = (r, m, seg = 32) => { const g = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), m); g.castShadow = true; return g; };

export class Pet extends THREE.Group {
  constructor(sfx, opts = {}) {
    super();
    this.sfx = sfx;
    this.opts = opts = {
      color: '#ff9f6e', belly: '#ffe2c4', ears: 'pointy', eyes: 1, name: 'Pip', snout: 'none', nose: 'pink',
      tail: 'puff', pattern: 'none', extra: 'none', accessory: 'none', size: 1, ...opts,
    };
    this.name = opts.name;
    this.allMats = [];
    const m = (c, r = 0.65) => { const x = mat(c, r); this.allMats.push(x); return x; };
    const furCol = new THREE.Color(opts.color);
    const fur = m(furCol), belly = m(opts.belly), dark = m(furCol.clone().multiplyScalar(0.72)), pink = m('#ff8fb1', 0.5);
    const white = m('#ffffff', 0.25), black = m('#1b1430', 0.2);
    const earCol = opts.earColor ? m(opts.earColor) : fur;
    this.furMat = fur; this.furColor = furCol.clone(); this.cheekMat = pink;
    this.speedMul = 1; this.sick = false; this.tired = false;
    this.scale.setScalar(1);
    this.bodyRig = new THREE.Group();          // squash & stretch pivot at the feet
    this.add(this.bodyRig);
    const R = this.bodyRig;
    const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); R.add(mesh); return mesh; };

    // Body + tummy
    const body = add(ball(0.09, fur, 48), 0, 0.09, 0); body.scale.set(1, 0.92, 1);
    if (opts.belly !== opts.color) { const t = add(ball(0.066, belly), 0, 0.078, 0.042); t.scale.set(1, 1, 0.75); }

    // Patterns
    if (opts.pattern === 'panda') {
      for (const s of [-1, 1]) { const p = add(ball(0.026, black), 0.035 * s, 0.116, 0.062); p.scale.set(1, 1.25, 0.6); p.rotation.z = 0.5 * s; }
    } else if (opts.pattern === 'spots') {
      for (let i = 0; i < 7; i++) {
        const a = i * 1.7 + 0.5, h = 0.05 + (i % 3) * 0.035;
        const sp = add(ball(0.014 + (i % 2) * 0.006, dark), Math.sin(a) * 0.085, h, Math.cos(a) * 0.085 - 0.01); sp.scale.set(1, 1, 0.35); sp.lookAt(0, h, 0);
      }
    } else if (opts.pattern === 'mask') {
      const mk = add(ball(0.06, belly), 0, 0.095, 0.055); mk.scale.set(1.2, 0.7, 0.6);
    } else if (opts.pattern === 'stripes') {
      for (let i = 0; i < 4; i++) { const st = add(new THREE.Mesh(new THREE.TorusGeometry(0.088 - i * 0.004, 0.006, 8, 40, Math.PI), dark), 0, 0.15 - i * 0.025, -0.01); st.rotation.x = Math.PI / 2; st.rotation.z = Math.PI; }
    }

    // Eyes
    this.eyes = [];
    const eyeY = opts.ears === 'none' && opts.extra === 'frogeyes' ? 0.17 : 0.118;
    for (const s of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(0.034 * s, eyeY, 0.07); eye.scale.setScalar(opts.eyes); eye.baseScale = opts.eyes;
      if (opts.extra === 'frogeyes') { const bump = ball(0.03, fur); bump.position.set(0, -0.004, -0.012); eye.add(bump); }
      const w = ball(0.022, white); w.scale.set(1, 1.1, 0.7);
      const p = ball(0.0135, black); p.position.z = 0.012;
      const h = ball(0.0045, white); h.position.set(0.004, 0.006, 0.024);
      eye.add(w, p, h); eye.pupil = p; eye.shine = h;
      R.add(eye); this.eyes.push(eye);
      const cheek = add(ball(0.013, pink), 0.058 * s, 0.09, 0.06); cheek.scale.set(1, 0.6, 0.4);
    }

    // Snout / beak / nose
    let mouthZ = 0.083, mouthY = 0.094;
    if (opts.snout === 'dog' || opts.snout === 'bear') {
      const sn = add(ball(opts.snout === 'bear' ? 0.03 : 0.027, belly), 0, 0.09, 0.078); sn.scale.set(1.15, 0.8, 0.9);
      mouthZ = 0.1; mouthY = 0.082;
    } else if (opts.snout === 'pig') {
      const sn = add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 32), pink), 0, 0.092, 0.088); sn.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) add(ball(0.005, dark), 0.008 * s, 0.092, 0.099);
      mouthY = 0.068;
    } else if (opts.snout === 'beak') {
      const bk = add(new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.035, 20), m('#ffb347', 0.5)), 0, 0.094, 0.095); bk.rotation.x = Math.PI / 2;
      mouthY = 0.08;
    }
    if (opts.nose === 'black' || opts.nose === 'pink') {
      const z = opts.snout === 'dog' || opts.snout === 'bear' ? 0.105 : 0.088;
      const ns = add(ball(opts.snout === 'none' ? 0.008 : 0.011, opts.nose === 'black' ? black : pink), 0, 0.1 + (opts.snout !== 'none' ? 0.004 : 0), z); ns.scale.set(1.3, 0.9, 0.8);
    } else if (opts.nose === 'koala') {
      const ns = add(ball(0.02, black), 0, 0.098, 0.084); ns.scale.set(0.9, 1.3, 0.7);
    }
    if (opts.extra === 'whiskers' || opts.extra === 'mane+whiskers') {
      const wm = m('#ffffff', 0.4);
      for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
        const wk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 4), wm), 0.04 * s, 0.093 + k * 0.006, 0.085);
        wk.rotation.z = Math.PI / 2 + k * 0.15 * s;
      }
    }
    this.mouth = add(ball(0.011, black), 0, mouthY, mouthZ); this.mouth.scale.set(1.4, 0.5, 0.5);

    // Ears
    this.ears = [];
    for (const s of [-1, 1]) {
      if (opts.ears === 'none') break;
      const ear = new THREE.Group(); ear.position.set(0.045 * s, 0.155, -0.005); ear.rotation.z = -0.38 * s;
      let outer, inner;
      switch (opts.ears) {
        case 'round':
          ear.position.y = 0.15;
          outer = ball(0.026, earCol); outer.scale.set(1, 1, 0.45); outer.position.y = 0.02;
          inner = ball(0.016, pink); inner.scale.set(1, 1, 0.3); inner.position.set(0, 0.02, 0.009); break;
        case 'koala':
          ear.position.set(0.07 * s, 0.14, -0.01); ear.rotation.z = -0.9 * s;
          outer = ball(0.04, earCol); outer.scale.set(1, 1, 0.5); outer.position.y = 0.02;
          inner = ball(0.026, white); inner.scale.set(1, 1, 0.35); inner.position.set(0, 0.02, 0.012); break;
        case 'mouse':
          ear.position.set(0.055 * s, 0.155, -0.01); ear.rotation.z = -0.55 * s;
          outer = ball(0.038, earCol); outer.scale.set(1, 1, 0.3); outer.position.y = 0.03;
          inner = ball(0.028, pink); inner.scale.set(1, 1, 0.25); inner.position.set(0, 0.03, 0.007); break;
        case 'bunny':
          ear.rotation.z = -0.15 * s;
          outer = ball(0.02, earCol); outer.scale.set(0.9, 3.2, 0.5); outer.position.y = 0.06;
          inner = ball(0.012, pink); inner.scale.set(0.8, 3.6, 0.3); inner.position.set(0, 0.058, 0.008); break;
        case 'floppy':
          ear.position.set(0.075 * s, 0.14, 0); ear.rotation.z = -2.6 * s;
          outer = ball(0.024, opts.earColor ? earCol : dark); outer.scale.set(0.8, 2.3, 0.5); outer.position.y = 0.035;
          inner = new THREE.Object3D(); break;
        case 'tiny':
          outer = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.035, 20), earCol); outer.position.y = 0.012;
          inner = new THREE.Object3D(); break;
        case 'tufts':
          ear.position.set(0.05 * s, 0.16, 0); ear.rotation.z = -0.5 * s;
          outer = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.06, 16), dark); outer.position.y = 0.025;
          inner = new THREE.Object3D(); break;
        default:
          outer = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.075, 24), earCol); outer.position.y = 0.03;
          inner = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 24), pink); inner.position.set(0, 0.024, 0.012);
      }
      outer.castShadow = true;
      ear.add(outer, inner); R.add(ear); this.ears.push(ear);
    }

    // Extras: mane, horn, horns, wings
    if (opts.extra === 'mane' || opts.extra === 'mane+whiskers' || opts.extra === 'unicorn') {
      const maneMat = opts.extra === 'unicorn' ? null : m(opts.maneColor || '#c46a2b', 0.9);
      const rainbow = ['#ff7eb3', '#ffb347', '#ffd25e', '#7ee08a', '#5ad1e6', '#8f7bff'];
      const n = opts.extra === 'unicorn' ? 6 : 14;
      for (let i = 0; i < n; i++) {
        const a = opts.extra === 'unicorn' ? -0.2 - i * 0.28 : (i / n) * Math.PI * 2;
        const mm = maneMat || m(rainbow[i % rainbow.length], 0.8);
        if (opts.extra === 'unicorn') { const tuft = add(ball(0.02, mm), 0, 0.13 + Math.cos(-a) * 0.06, Math.sin(a) * 0.08); tuft.scale.set(0.7, 1, 1); }
        else { const tuft = add(ball(0.03, mm), Math.cos(a) * 0.075, 0.11 + Math.sin(a) * 0.075, -0.015); tuft.scale.set(1, 1, 0.6); }
      }
    }
    if (opts.extra === 'unicorn' || opts.extra === 'horn') {
      const hn = add(new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.07, 20), m('#ffd25e', 0.3)), 0, 0.19, 0.04); hn.rotation.x = 0.25;
    }
    if (opts.extra === 'horns' || opts.extra === 'dragon') {
      for (const s of [-1, 1]) { const h = add(new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.04, 12), m('#fff4d6', 0.4)), 0.03 * s, 0.17, -0.005); h.rotation.z = -0.3 * s; h.rotation.x = -0.3; }
    }
    this.wings = [];
    if (opts.extra === 'wings' || opts.extra === 'dragon') {
      const wm = m(opts.wingColor || (opts.extra === 'dragon' ? '#8f7bff' : '#ffffff'), 0.5);
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(0.07 * s, 0.11, -0.04);
        const blade = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 10), wm); blade.scale.set(1.2, 0.6, 0.15); blade.position.x = 0.04 * s; blade.castShadow = true;
        w.add(blade); w.rotation.y = 0.5 * s; R.add(w); this.wings.push(w); w.side = s;
      }
    }

    // Accessories
    switch (opts.accessory) {
      case 'bow': { const bm = m('#ff4f8b', 0.4); for (const s of [-1, 1]) { const lobe = add(ball(0.018, bm), 0.03 + 0.016 * s, 0.168, 0.02); lobe.scale.set(1.2, 0.8, 0.5); } add(ball(0.009, bm), 0.03, 0.168, 0.025); break; }
      case 'partyhat': { const ht = add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 24), m('#5ad1e6', 0.5)), 0.01, 0.2, 0); ht.rotation.z = -0.2; add(ball(0.01, m('#ffd25e', 0.4)), 0.018, 0.235, 0); break; }
      case 'santa': { add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 24), m('#e53935', 0.6)), 0, 0.2, -0.005).rotation.z = 0.35; const rim = add(new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 10, 30), white), 0, 0.165, -0.005); rim.rotation.x = Math.PI / 2; add(ball(0.013, white), -0.03, 0.235, -0.005); break; }
      case 'crown': { const cm = m('#ffd25e', 0.2); const base = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24, 1, true), cm), 0, 0.18, 0); base.material.side = THREE.DoubleSide; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.02, 8), cm), Math.cos(a) * 0.027, 0.198, Math.sin(a) * 0.027); } break; }
      case 'scarf': { const sm = m('#e53935', 0.8); const sc = add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 10, 40), sm), 0, 0.06, 0.005); sc.rotation.x = Math.PI / 2 - 0.15; const tl = add(ball(0.014, sm), 0.035, 0.035, 0.07); tl.scale.set(0.8, 2, 0.5); break; }
      case 'glasses': { const gm = m('#1b1430', 0.3); for (const s of [-1, 1]) { const rim = add(new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 8, 24), gm), 0.034 * s, eyeY, 0.088); } add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.003), gm), 0, eyeY + 0.004, 0.09); break; }
      case 'flower': { const fm = m('#ffffff', 0.5); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(ball(0.009, fm), -0.04 + Math.cos(a) * 0.012, 0.165 + Math.sin(a) * 0.012, 0.03); } add(ball(0.007, m('#ffd25e', 0.5)), -0.04, 0.165, 0.035); break; }
    }

    // Tail
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.06, -0.085);
    switch (opts.tail) {
      case 'none': break;
      case 'long': case 'thin': {
        const thick = opts.tail === 'thin' ? 0.006 : 0.011;
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.03, -0.04), new THREE.Vector3(0, 0.08, -0.05), new THREE.Vector3(0, 0.11, -0.03)]);
        const tm = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, thick, 8), opts.tail === 'thin' ? pink : fur); tm.castShadow = true; this.tail.add(tm);
        if (opts.extra === 'mane' || opts.extra === 'mane+whiskers') { const tuft = ball(0.016, m(opts.maneColor || '#c46a2b', 0.9)); tuft.position.set(0, 0.115, -0.025); this.tail.add(tuft); }
        break;
      }
      case 'fluffy': {
        const tf = ball(0.035, fur); tf.scale.set(0.8, 0.8, 1.8); tf.position.set(0, 0.03, -0.05); tf.rotation.x = -0.6;
        const tip = ball(0.022, white); tip.position.set(0, 0.075, -0.1); this.tail.add(tf, tip); break;
      }
      case 'curly': {
        const tc = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 8, 24, Math.PI * 1.6), pink); tc.position.set(0, 0.015, -0.015); tc.rotation.y = Math.PI / 2; this.tail.add(tc); break;
      }
      case 'spiky': {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.02, -0.05), new THREE.Vector3(0, -0.03, -0.11)]);
        const tm = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.014, 8), fur); tm.castShadow = true; this.tail.add(tm);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.03, 4), m(opts.wingColor || '#8f7bff', 0.5)); tip.position.set(0, -0.03, -0.12); tip.rotation.x = -Math.PI / 2; this.tail.add(tip);
        break;
      }
      default: { const tb = ball(0.026, belly); tb.position.z = -0.012; this.tail.add(tb); }
    }
    R.add(this.tail);

    // Feet
    this.feet = [];
    const footMat = opts.feetColor ? m(opts.feetColor, 0.5) : dark;
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const f = ball(0.021, footMat); f.scale.set(1, 0.7, 1.2); f.position.set(0.045 * x, 0.014, 0.038 * z);
      f.base = f.position.clone(); this.add(f); this.feet.push(f);
    }
    // Mouth slot for carrying things
    this.mouthSlot = new THREE.Object3D(); this.mouthSlot.position.set(0, 0.085, 0.11); R.add(this.mouthSlot);

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

  // Ready-made animals (you can still change every part afterwards).
  static ANIMALS = {
    puppy:   { emoji: '🐶', color: '#e0a96d', belly: '#fff1dc', ears: 'floppy', earColor: '#8a5a33', snout: 'dog', nose: 'black', tail: 'long', pattern: 'none', extra: 'none' },
    kitten:  { emoji: '🐱', color: '#b9b4c7', belly: '#ffffff', ears: 'pointy', snout: 'none', nose: 'pink', tail: 'long', pattern: 'stripes', extra: 'whiskers' },
    bunny:   { emoji: '🐰', color: '#f4f1f8', belly: '#ffffff', ears: 'bunny', snout: 'none', nose: 'pink', tail: 'puff', pattern: 'none', extra: 'whiskers' },
    koala:   { emoji: '🐨', color: '#9aa3ad', belly: '#e9edf1', ears: 'koala', snout: 'none', nose: 'koala', tail: 'none', pattern: 'none', extra: 'none' },
    bear:    { emoji: '🐻', color: '#8a5a33', belly: '#d9b48a', ears: 'round', snout: 'bear', nose: 'black', tail: 'puff', pattern: 'none', extra: 'none' },
    panda:   { emoji: '🐼', color: '#ffffff', belly: '#ffffff', ears: 'round', earColor: '#1b1430', feetColor: '#1b1430', snout: 'none', nose: 'black', tail: 'puff', pattern: 'panda', extra: 'none' },
    fox:     { emoji: '🦊', color: '#ff8a3d', belly: '#ffffff', ears: 'pointy', snout: 'dog', nose: 'black', tail: 'fluffy', pattern: 'mask', extra: 'none', feetColor: '#3a2a2a' },
    mouse:   { emoji: '🐭', color: '#c9c3d6', belly: '#f4f1f8', ears: 'mouse', snout: 'none', nose: 'pink', tail: 'thin', pattern: 'none', extra: 'whiskers' },
    piggy:   { emoji: '🐷', color: '#ffb3c7', belly: '#ffd1e0', ears: 'tiny', snout: 'pig', nose: 'none', tail: 'curly', pattern: 'none', extra: 'none' },
    frog:    { emoji: '🐸', color: '#7ee08a', belly: '#e8ffd9', ears: 'none', snout: 'none', nose: 'none', tail: 'none', pattern: 'spots', extra: 'frogeyes' },
    lion:    { emoji: '🦁', color: '#ffcc66', belly: '#fff1c9', ears: 'round', snout: 'bear', nose: 'black', tail: 'long', pattern: 'none', extra: 'mane+whiskers', maneColor: '#c46a2b' },
    unicorn: { emoji: '🦄', color: '#ffffff', belly: '#fff0fb', ears: 'pointy', snout: 'none', nose: 'pink', tail: 'puff', pattern: 'none', extra: 'unicorn' },
    dragon:  { emoji: '🐲', color: '#5ac88a', belly: '#e8ffd9', ears: 'tiny', snout: 'bear', nose: 'none', tail: 'spiky', pattern: 'none', extra: 'dragon', wingColor: '#8f7bff' },
    penguin: { emoji: '🐧', color: '#2a2a3a', belly: '#ffffff', ears: 'none', snout: 'beak', nose: 'none', tail: 'none', pattern: 'none', extra: 'none', feetColor: '#ffb347' },
    monkey:  { emoji: '🐵', color: '#8a5a33', belly: '#f2d3b0', ears: 'round', earColor: '#f2d3b0', snout: 'bear', nose: 'none', tail: 'long', pattern: 'mask', extra: 'none' },
    owl:     { emoji: '🦉', color: '#9b6b43', belly: '#f2d3b0', ears: 'tufts', snout: 'beak', nose: 'none', tail: 'none', pattern: 'none', extra: 'wings', wingColor: '#7a4f30' },
    dino:    { emoji: '🦖', color: '#8f7bff', belly: '#d9d2ff', ears: 'none', snout: 'bear', nose: 'none', tail: 'spiky', pattern: 'spots', extra: 'horns', wingColor: '#ff7eb3' },
    blob:    { emoji: '🫧', color: '#ff9f6e', belly: '#ffe2c4', ears: 'pointy', snout: 'none', nose: 'pink', tail: 'puff', pattern: 'none', extra: 'none' },
  };

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

    // Ears, wings, tail, mouth
    this.ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 3 + i) * 0.08 - (walking ? 0.2 : 0); });
    const flap = this.state === 'happy' || this.state === 'leap' || (this.state === 'trick' && this.trick === 'jumphigh') ? 22 : walking ? 10 : 2.5;
    for (const w of this.wings) w.rotation.z = w.side * (0.15 + Math.sin(t * flap) * (flap > 5 ? 0.45 : 0.12));
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
