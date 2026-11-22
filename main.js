import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pet, Ball, makeTreat, Hearts } from './pet.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'pip-pet-v1';
const saved = load();

/* ---------------- sound (tiny synth, no files) ---------------- */
let ac = null;
const audio = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
function tone(f0, f1, dur, type = 'sine', vol = 0.18, delay = 0) {
  try {
    const a = audio(), t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
const sfx = {
  chirp: (m = 1) => tone(700 * m, 1250 * m, 0.13),
  happy: () => { tone(800, 1300, 0.1); tone(1000, 1600, 0.1, 'sine', 0.18, 0.12); tone(1200, 2000, 0.14, 'sine', 0.18, 0.24); },
  confused: () => { tone(900, 600, 0.18, 'triangle'); tone(600, 900, 0.18, 'triangle', 0.15, 0.2); },
  nope: () => { tone(500, 300, 0.12, 'square', 0.06); tone(500, 300, 0.12, 'square', 0.06, 0.15); },
  bounce: (v = 1) => tone(160, 90, 0.08, 'sine', 0.25 * v),
  munch: () => { for (let i = 0; i < 4; i++) tone(220 + Math.random() * 80, 120, 0.06, 'square', 0.05, i * 0.13); },
  whoosh: () => tone(300, 1200, 0.18, 'sawtooth', 0.04),
  squeak: () => tone(1500, 2200, 0.09, 'triangle', 0.1),
};

/* ---------------- three.js setup ---------------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 30);
camera.position.set(0, 0.32, 0.62);
scene.add(camera);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.08, 0);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 0.3; controls.maxDistance = 1.6;
controls.maxPolarAngle = Math.PI * 0.47;

scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a9a', 1.3));
const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -0.8, right: 0.8, top: 0.8, bottom: -0.8, near: 0.1, far: 4 });
sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
scene.add(sun, sun.target);

// Cozy preview room (hidden in AR)
const room = new THREE.Group();
{
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.MeshStandardMaterial({ color: '#3b2c6e', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.55, 64), new THREE.MeshStandardMaterial({ color: '#ff8fb1', roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.002; rug.receiveShadow = true; room.add(rug);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 64), new THREE.MeshStandardMaterial({ color: '#ffd1e0', roughness: 1 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; room.add(ring);
  const prop = (geo, color, x, z, y, ry = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; room.add(m); return m;
  };
  prop(new THREE.BoxGeometry(0.3, 0.26, 0.24), '#ffb347', -0.75, -0.55, 0.13, 0.4);            // box
  prop(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 40), '#7c5cff', 0.7, -0.7, 0.06);          // cushion
  prop(new THREE.CylinderGeometry(0.1, 0.08, 0.2, 32), '#e8e2f5', 0.95, 0.25, 0.1);            // plant pot
  const leaves = prop(new THREE.SphereGeometry(0.17, 24, 16), '#4fc38a', 0.95, 0.25, 0.33); leaves.scale.y = 1.2;
  prop(new THREE.BoxGeometry(0.5, 0.32, 0.18), '#5ad1e6', -0.2, -1.05, 0.16);                  // bench
}
scene.add(room);
const hidingSpots = [new THREE.Vector3(-0.85, 0, -0.78), new THREE.Vector3(0.75, 0, -0.98), new THREE.Vector3(1.12, 0, 0.42), new THREE.Vector3(-0.2, 0, -1.3)];
scene.background = null;
renderer.setClearColor('#1a1240', 1);

// AR helpers
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.32 }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.receiveShadow = true; shadowCatcher.visible = false; scene.add(shadowCatcher);
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);

const hearts = new Hearts(); scene.add(hearts);
const emotes = new THREE.Group(); scene.add(emotes);

/* ---------------- state ---------------- */
let pet = null;
let mode = 'create';               // create | play | ar
let floorY = 0;
let placed = false;
const thrown = [];                 // flying / resting items
let inHand = null;                 // item held in front of camera
let hideGame = null;               // { since }
let nextMischief = 45;
const skills = { come: 0.55, sit: 0.25, spin: 0.15, hop: 0.3, fetch: 0.45, hide: 0.2, sleep: 0.3, ...(saved?.skills || {}) };
let lastSuccess = null;

/* ---------------- creator ---------------- */
const look = { color: '#ff9f6e', ears: 'pointy', eyes: 1, name: 'Pip', ...(saved?.look || {}) };
const COLORS = ['#ff9f6e', '#ff7eb3', '#8f7bff', '#5ad1e6', '#7ee08a', '#ffd25e', '#c9c3d6'];
const EARS = [['pointy', 'Pointy'], ['round', 'Round'], ['bunny', 'Bunny']];
const EYES = [[0.8, 'Small'], [1, 'Normal'], [1.3, 'Big']];

function buildCreator() {
  const colors = $('colors');
  for (const c of COLORS) {
    const b = document.createElement('button'); b.className = 'swatch'; b.style.background = c;
    b.onclick = () => { look.color = c; refreshPet(); mark(); }; b.dataset.v = c; colors.appendChild(b);
  }
  for (const [v, l] of EARS) { const b = chip(l, () => { look.ears = v; refreshPet(); mark(); }); b.dataset.v = v; $('ears').appendChild(b); }
  for (const [v, l] of EYES) { const b = chip(l, () => { look.eyes = v; refreshPet(); mark(); }); b.dataset.v = v; $('eyes').appendChild(b); }
  $('name').value = look.name;
  $('name').oninput = () => { look.name = $('name').value.trim() || 'Pip'; };
  mark();
}
function chip(label, fn) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = label; b.onclick = fn; return b; }
function mark() {
  for (const b of $('colors').querySelectorAll('.swatch')) b.classList.toggle('on', b.dataset.v === look.color);
  for (const b of $('ears').querySelectorAll('.chip')) b.classList.toggle('on', b.dataset.v === look.ears);
  for (const b of $('eyes').querySelectorAll('.chip')) b.classList.toggle('on', +b.dataset.v === look.eyes);
}
function refreshPet() {
  const keep = pet ? { p: pet.position.clone(), r: pet.rotation.y } : null;
  if (pet) scene.remove(pet);
  pet = new Pet(sfx, look);
  pet.onHearts = (p, n) => hearts.burst(p, n);
  pet.onEmote = (p, text) => emote(text);
  if (keep) { pet.position.copy(keep.p); pet.rotation.y = keep.r; }
  scene.add(pet);
  sfx.chirp(1 + Math.random() * 0.3);
}

/* ---------------- emote bubbles ---------------- */
function emote(text, color = '#ffffff') {
  if (!pet) return;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = '800 64px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = 'rgba(20,12,50,.85)'; g.strokeText(text, 128, 66);
  g.fillStyle = color; g.fillText(text, 128, 66);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 10;
  s.scale.set(0.14, 0.07, 1);
  s.position.copy(pet.localToWorld(new THREE.Vector3(0, 0.26, 0)));
  s.life = 0; emotes.add(s);
}
function updateEmotes(dt) {
  for (const s of [...emotes.children]) {
    s.life += dt; s.position.y += dt * 0.05;
    s.material.opacity = s.life < 1.2 ? 1 : Math.max(0, 1 - (s.life - 1.2) / 0.5);
    if (s.life > 1.7) { emotes.remove(s); s.material.map.dispose(); s.material.dispose(); }
  }
}

/* ---------------- play modes ---------------- */
async function startPlay() {
  mode = 'play';
  audio().resume?.();
  $('create').hidden = true; $('hud').hidden = false;
  setNames();
  pet.position.set(0, 0, 0); pet.rotation.y = 0;
  frameCamera('play');
  persist();
  setTimeout(() => { emote('Hi!'); pet.happy(2); }, 400);
  toast(`Tap the mic and say "${look.name}, sit!"`);
}

async function startAR() {
  audio().resume?.();
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: $('ui') },
  }).catch((e) => { toast('AR could not start: ' + e.message); return null; });
  if (!session) return;
  mode = 'ar'; placed = false;
  room.visible = false; shadowCatcher.visible = true; controls.enabled = false;
  renderer.setClearColor('#000000', 0);
  $('create').hidden = true; $('hud').hidden = false; setNames();
  $('ui').style.pointerEvents = 'auto';   // so swipes in AR reach our handlers
  scene.remove(pet);
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace('viewer');
  hitSource = await session.requestHitTestSource({ space: viewer });
  toast('Slowly point your phone at the floor…');
  session.addEventListener('end', () => {
    $('ui').style.pointerEvents = '';
    hitSource = null; mode = 'create'; room.visible = true; shadowCatcher.visible = false; controls.enabled = true; reticle.visible = false;
    renderer.setClearColor('#1a1240', 1); frameCamera('create');
    $('hud').hidden = true; $('create').hidden = false; scene.add(pet); pet.position.set(0, 0, 0); floorY = 0;
    clearThrown(); stopListening();
  });
  // Keep UI taps from also counting as "tap the room".
  for (const el of document.querySelectorAll('#ui button, #ui .pill, #ui .panel')) el.addEventListener('beforexrselect', (e) => e.preventDefault());
}
let hitSource = null;

const ctrl = renderer.xr.getController(0);
scene.add(ctrl);
let lastThrowAt = 0;
ctrl.addEventListener('select', () => {
  if (mode !== 'ar' || inHand || performance.now() - lastThrowAt < 400) return;
  if (!placed) {
    if (!reticle.visible) return;
    const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
    floorY = p.y; pet.position.copy(p); pet.scale.setScalar(0.01); pet.popIn = 0;
    scene.add(pet); placed = true;
    shadowCatcher.position.y = floorY + 0.001;
    emote('Hi!'); sfx.happy();
    toast(`Say "${look.name}, come!" or flick a ball`);
    return;
  }
  const ray = new THREE.Raycaster();
  const m = ctrl.matrixWorld;
  ray.ray.origin.setFromMatrixPosition(m);
  ray.ray.direction.set(0, 0, -1).transformDirection(m);
  handleTap(ray);
});

/* ---------------- tapping the scene (preview) ---------------- */
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || mode !== 'play') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  if (moved < 8 && performance.now() - downAt.t < 400) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    handleTap(ray);
  }
  downAt = null;
});

function handleTap(ray) {
  if (!pet) return;
  if (ray.intersectObject(pet, true).length) {
    if (hideGame) return foundPet();
    if (pet.state === 'sleep') { pet.hop(); emote('!'); return; }
    sfx.squeak(); pet.happy(2); emote('♥', '#ff7eb3');
    praise();
    return;
  }
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY), hit)) {
    if (hideGame) return;
    pet.goTo(hit);
  }
}

/* ---------------- throwing: hold an item, then swipe or flick ---------------- */
function holdItem(kind) {
  if (inHand) { camera.remove(inHand); }
  const obj = kind === 'treat' ? makeTreat() : new Ball();
  obj.kind = kind; obj.r = kind === 'treat' ? 0.015 : 0.028;
  obj.position.set(0, -0.1, -0.34);
  if (kind === 'treat') obj.rotation.x = 0.9;
  camera.add(obj);
  inHand = obj;
  controls.enabled = false;   // swipes throw instead of turning the camera
  toast(isTouch ? 'Swipe up — or flick your phone — to throw!' : 'Drag upward to throw!');
  sfx.chirp(1.6);
  armFlick();
}
$('ballBtn').onclick = () => holdItem('ball');
$('treatBtn').onclick = () => holdItem('treat');

// Swipe to throw (anywhere on screen)
let swipe = null;
addEventListener('pointerdown', (e) => { if (inHand && !e.target.closest('button')) swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
addEventListener('pointerup', (e) => {
  if (!swipe || !inHand) return;
  const dy = swipe.y - e.clientY, dx = e.clientX - swipe.x, dt = Math.max(30, performance.now() - swipe.t);
  swipe = null;
  if (dy < 40) return;
  const speed = Math.min(1, (dy / dt) / 1.6);          // px/ms → 0..1
  throwHeld(0.35 + speed * 0.65, dx / Math.max(dy, 1));
}, true);
if (!('PointerEvent' in window)) console.warn('No pointer events');

// Flick the phone (accelerometer spike)
let flickArmed = false;
function armFlick() {
  if (flickArmed) return; flickArmed = true;
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') DME.requestPermission().catch(() => {});
  addEventListener('devicemotion', (e) => {
    if (!inHand) return;
    const a = e.acceleration || {};
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (mag > 14) throwHeld(Math.min(1, 0.45 + (mag - 14) / 25), 0);
  });
}

function throwHeld(power, sideways = 0) {
  if (!inHand) return;
  const obj = inHand; inHand = null; lastThrowAt = performance.now();
  setTimeout(() => { if (mode === 'play') controls.enabled = true; }, 50);
  const wp = new THREE.Vector3(); obj.getWorldPosition(wp);
  camera.remove(obj); scene.add(obj); obj.position.copy(wp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
  const right = new THREE.Vector3(-flat.z, 0, flat.x);
  const dir = flat.clone().addScaledVector(right, THREE.MathUtils.clamp(sideways, -0.8, 0.8) * 0.6).normalize();
  const sp = 1.2 + power * 2.6;
  obj.vel = dir.multiplyScalar(sp).add(new THREE.Vector3(0, 1.2 + power * 1.4, 0));
  obj.spin = new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0);
  obj.landed = false;
  thrown.push(obj);
  sfx.whoosh();
  if (hideGame) return;
  pet.state = 'idle'; pet.target = null;
  emote(obj.kind === 'treat' ? '!!' : '!');
}

function stepThrown(dt) {
  for (const o of thrown) {
    if (o.held) continue;
    o.vel.y -= 9.8 * dt;
    o.position.addScaledVector(o.vel, dt);
    if (o.spin) { o.rotation.x += o.spin.x * dt; o.rotation.y += o.spin.y * dt; }
    if (o.position.y < floorY + o.r) {
      o.position.y = floorY + o.r;
      const bounce = o.kind === 'treat' ? 0.2 : 0.55;
      if (Math.abs(o.vel.y) > 0.6) sfx.bounce(Math.min(1, Math.abs(o.vel.y) / 4));
      o.vel.y = -o.vel.y * bounce; o.vel.x *= 0.78; o.vel.z *= 0.78;
      if (o.spin) o.spin.multiplyScalar(0.6);
      if (Math.abs(o.vel.y) < 0.2) o.vel.y = 0;
      if (o.kind === 'treat') { o.rotation.set(0, o.rotation.y, 0); o.spin = null; }
    }
    // keep things in the preview room
    if (mode === 'play') {
      const d = Math.hypot(o.position.x, o.position.z);
      if (d > 1.9) { o.position.x *= 1.9 / d; o.position.z *= 1.9 / d; o.vel.x *= -0.5; o.vel.z *= -0.5; }
    }
    const resting = o.position.y <= floorY + o.r + 0.002 && Math.hypot(o.vel.x, o.vel.z) < 0.05;
    if (resting) o.vel.set(0, 0, 0);
    if (!o.landed && o.position.y <= floorY + o.r + 0.02 && o.vel.y <= 0.3) { o.landed = true; onLanded(o); }
  }
}

function onLanded(o) {
  if (!pet || hideGame || pet.state === 'sleep') return;
  if (o.kind === 'treat') {
    pet.goTo(o.position, true, () => eatTreat(o));
  } else {
    // Always chases. Whether it brings it back depends on training (and mood).
    const willReturn = Math.random() < 0.35 + (skills.fetch ?? 0.5) * 0.6;
    setTimeout(() => chase(o, willReturn), 250);
  }
}
function chase(o, willReturn = true) {
  if (!thrown.includes(o)) return;
  pet.goTo(o.position, true, () => {
    if (o.position.distanceTo(pet.position) > 0.12) return chase(o, willReturn);
    o.held = true; scene.remove(o); pet.mouthSlot.add(o); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); sfx.squeak();
    const drop = (msg) => {
      const wp = new THREE.Vector3(); o.getWorldPosition(wp);
      pet.mouthSlot.remove(o); scene.add(o); o.position.copy(wp); o.held = false; o.vel = new THREE.Vector3(0, 0.3, 0); o.landed = true;
      emote(msg);
    };
    if (!willReturn) {
      // Keep-away! Runs off with it, then drops it somewhere else.
      emote('Mine!', '#ffd25e'); sfx.nope();
      const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
      const away = pet.position.clone().sub(cp); away.y = 0; away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 2);
      pet.goTo(clampToPlay(pet.position.clone().addScaledVector(away, 0.5)), true, () => { drop('hehe'); pet.hop(); skills.fetch = Math.min(1, skills.fetch + 0.02); persist(); });
      return;
    }
    pet.goTo(frontOfYou(0.35), true, () => {
      const wp = new THREE.Vector3(); o.getWorldPosition(wp);
      pet.mouthSlot.remove(o); scene.add(o); o.position.copy(wp); o.held = false; o.vel = new THREE.Vector3(0, 0.3, 0); o.landed = true;
      pet.happy(2); emote('Again?');
      success('fetch');
    });
  });
}
function eatTreat(o) {
  pet.state = 'eat'; sfx.munch();
  const t0 = performance.now();
  const shrink = () => {
    const p = (performance.now() - t0) / 1200;
    o.scale.setScalar(Math.max(0.01, 1 - p));
    if (p < 1) requestAnimationFrame(shrink);
    else { removeThrown(o); pet.state = 'idle'; pet.happy(2); emote('Yum!', '#ffd25e'); praise(true); }
  };
  shrink();
}
function removeThrown(o) { const i = thrown.indexOf(o); if (i >= 0) thrown.splice(i, 1); o.parent?.remove(o); }
function clearThrown() { for (const o of [...thrown]) removeThrown(o); if (inHand) { camera.remove(inHand); inHand = null; } }

function frontOfYou(dist = 0.4) {
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  return new THREE.Vector3(cp.x + fwd.x * dist, floorY, cp.z + fwd.z * dist);
}

/* ---------------- training: obey sometimes, better with practice ---------------- */
const TRICK_NAMES = { come: 'Come', sit: 'Sit', spin: 'Spin', hop: 'Jump', fetch: 'Fetch', hide: 'Hide', sleep: 'Nap' };
function obey(cmd, quiet = false) {
  const s = skills[cmd] ?? 0.3;
  // A little mischief: sometimes it just runs off!
  if (Math.random() < 0.07 && cmd !== 'fetch') { runAway(); return false; }
  if (Math.random() < 0.3 + s * 0.65) return true;
  if (!quiet) {
    // Confused: does the wrong thing or tilts its head.
    if (Math.random() < 0.5) { emote('?'); sfx.confused(); }
    else { const wrong = ['hop', 'spin', 'sit'].filter((x) => x !== cmd)[Math.floor(Math.random() * 2)]; doTrick(wrong, true); emote('?'); }
  } else { emote('Meh'); sfx.confused(); }
  skills[cmd] = Math.min(1, s + 0.02); persist();
  return false;
}
function success(cmd) {
  skills[cmd] = Math.min(1, (skills[cmd] ?? 0.3) + 0.07);
  lastSuccess = { cmd, t: performance.now() };
  persist();
}
function praise(treat = false) {
  if (lastSuccess && performance.now() - lastSuccess.t < 8000) {
    const c = lastSuccess.cmd;
    skills[c] = Math.min(1, skills[c] + (treat ? 0.12 : 0.06));
    toast(`${look.name} is learning "${TRICK_NAMES[c]}"  ${stars(skills[c])}`);
    lastSuccess = null; persist();
  }
}
const stars = (v) => '★'.repeat(Math.round(v * 5)) + '☆'.repeat(5 - Math.round(v * 5));
$('tricksBtn').onclick = () => {
  toast(Object.entries(TRICK_NAMES).map(([k, n]) => `${n} ${stars(skills[k])}`).slice(0, 4).join('  ·  '));
  setTimeout(() => toast(Object.entries(TRICK_NAMES).map(([k, n]) => `${n} ${stars(skills[k])}`).slice(4).join('  ·  ')), 2800);
};

function doTrick(cmd, forced = false) {
  if (!forced && !obey(cmd)) return;
  switch (cmd) {
    case 'come': pet.goTo(frontOfYou(0.3), false, () => { pet.hop(); success('come'); }); emote('!'); return;
    case 'sit': pet.sit(); break;
    case 'spin': pet.spin(); break;
    case 'hop': pet.hop(); break;
    case 'sleep': pet.sleep(); break;
    case 'hide': startHide(); return;
  }
  if (!forced) setTimeout(() => success(cmd), 200);
}

function runAway() {
  emote('Nope!', '#ffd25e'); sfx.nope();
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const away = pet.position.clone().sub(cp); away.y = 0; away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.6);
  const p = clampToPlay(pet.position.clone().addScaledVector(away, 0.6 + Math.random() * 0.4));
  pet.goTo(p, true, () => { emote('hehe'); setTimeout(() => { if (pet.state === 'idle' && !hideGame) pet.goTo(frontOfYou(0.4)); }, 2500); });
}
function clampToPlay(p) {
  if (mode === 'play') { const d = Math.hypot(p.x, p.z); if (d > 1.5) { p.x *= 1.5 / d; p.z *= 1.5 / d; } }
  p.y = floorY; return p;
}

/* ---------------- hide and seek ---------------- */
function startHide(self = false) {
  let spot;
  if (mode === 'play') {
    spot = hidingSpots[Math.floor(Math.random() * hidingSpots.length)].clone();
  } else {
    // In your room: dash somewhere out of view (to the side or behind you).
    const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const ang = (Math.random() < 0.5 ? 1 : -1) * (1.9 + Math.random() * 0.9);
    const dir = fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    spot = new THREE.Vector3(cp.x + dir.x * 1.3, floorY, cp.z + dir.z * 1.3);
  }
  spot.y = floorY;
  emote(self ? 'Catch me!' : 'Count to 3!', '#ffd25e'); sfx.happy();
  pet.hideAt(spot);
  hideGame = { since: performance.now() };
  toast(`${look.name} is hiding! Look around to find them 👀`);
}
function foundPet() {
  hideGame = null; $('arrow').hidden = true;
  pet.state = 'idle'; pet.happy(3); emote('Found me!', '#7ee08a');
  success('hide');
}
$('hideBtn').onclick = () => { if (!hideGame) doTrick('hide', true); };

function checkFound() {
  // On screen, you find it by tapping it; in your room, by looking at it.
  if (!hideGame || pet.state !== 'hiding' || mode !== 'ar') return;
  // Found when it's near the middle of your view and reasonably close.
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  if (Math.abs(p.x) < 0.45 && Math.abs(p.y) < 0.6 && p.z < 1 && cp.distanceTo(pet.position) < 2.2 && performance.now() - hideGame.since > 2500) foundPet();
}

/* ---------------- voice ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
const COMMANDS = [
  [/\b(come|here|come here|over here)\b/, 'come'],
  [/\b(sit|sit down)\b/, 'sit'],
  [/\b(spin|dance|twirl|turn around)\b/, 'spin'],
  [/\b(jump|hop|up up)\b/, 'hop'],
  [/\b(fetch|ball|catch|throw)\b/, 'fetch'],
  [/\b(treat|cookie|hungry|eat|snack)\b/, 'treat'],
  [/\b(hide|seek|hiding|peekaboo)\b/, 'hide'],
  [/\b(sleep|nap|bed|night night|goodnight|good night)\b/, 'sleep'],
  [/\b(wake|wake up|get up)\b/, 'wake'],
  [/\b(good|love|cute|best|great job|nice|yay)\b/, 'praise'],
  [/\b(stay|stop|wait|freeze)\b/, 'stay'],
];
function onSpeech(text) {
  const t = text.toLowerCase();
  $('heard').innerHTML = `You said: <b>${escapeHtml(text)}</b>`;
  if (!pet || (mode === 'ar' && !placed)) return;
  const hit = COMMANDS.find(([re]) => re.test(t));
  if (!hit) {
    if (t.includes(look.name.toLowerCase())) { emote('?'); sfx.chirp(1.2); pet.target = null; pet.state = pet.state === 'sleep' ? 'idle' : pet.state; }
    else { emote('?'); sfx.confused(); }
    return;
  }
  const cmd = hit[1];
  if (pet.state === 'sleep' && !['wake', 'praise'].includes(cmd)) { emote('z z z'); return; }
  if (hideGame && cmd !== 'praise') { emote('shh!'); return; }
  switch (cmd) {
    case 'praise': sfx.happy(); pet.happy(2); emote('♥', '#ff7eb3'); praise(); return;
    case 'wake': pet.state = 'idle'; pet.hop(); emote('!'); return;
    case 'stay': pet.target = null; pet.state = 'idle'; emote('ok'); return;
    case 'fetch': holdItem('ball'); emote('!!'); return;
    case 'treat': holdItem('treat'); emote('!!'); return;
    default: doTrick(cmd);
  }
}
function startListening() {
  if (!SR) { toast('Voice needs Chrome (Android) or Safari'); return; }
  audio().resume?.();
  rec = new SR(); rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = (e) => { const r = e.results[e.results.length - 1]; if (r.isFinal) onSpeech(r[0].transcript.trim()); };
  rec.onend = () => { if (listening) { try { rec.start(); } catch {} } };
  rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stopListening(); toast('Microphone permission is needed to talk'); } };
  try { rec.start(); listening = true; $('micBtn').classList.add('on'); $('heard').innerHTML = `Listening… try <b>"${escapeHtml(look.name)}, sit!"</b>`; emote('?'); }
  catch (e) { toast('Could not start the microphone'); }
}
function stopListening() { listening = false; try { rec?.stop(); } catch {} $('micBtn').classList.remove('on'); }
$('micBtn').onclick = () => (listening ? stopListening() : startListening());

/* ---------------- HUD ---------------- */
function setNames() { $('petName').textContent = look.name; document.querySelectorAll('.pn').forEach((e) => (e.textContent = look.name)); }
$('exitBtn').onclick = () => {
  stopListening(); clearThrown(); hideGame = null; $('arrow').hidden = true;
  if (mode === 'ar') { renderer.xr.getSession()?.end(); return; }
  mode = 'create'; $('hud').hidden = true; $('create').hidden = false; pet.position.set(0, 0, 0); pet.state = 'idle'; pet.target = null;
  frameCamera('create');
};
$('goPlay').onclick = startPlay;
$('goAR').onclick = startAR;
let toastTimer;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }
function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const isTouch = matchMedia('(pointer: coarse)').matches;

function updateArrow() {
  const el = $('arrow');
  if (!pet || !(mode === 'play' || placed) || !pet.parent) { el.hidden = true; return; }
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const behind = p.z > 1;
  const off = behind || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
  if (!off) { el.hidden = true; return; }
  let x = p.x, y = p.y; if (behind) { x = -x; y = -y; }
  const ang = Math.atan2(y, x);
  const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
  const sx = (x / m) * 0.82, sy = (y / m) * 0.7;
  el.hidden = false;
  el.style.left = `${(sx * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-sy * 0.5 + 0.5) * innerHeight}px`;
  el.firstElementChild.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
}

/* ---------------- save ---------------- */
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ look, skills })); } catch {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } }

/* ---------------- main loop ---------------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min(0.05, clock.getDelta());
  if (mode === 'ar' && frame && hitSource) {
    const ref = renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitSource);
    reticle.visible = false;
    if (hits.length && !placed) {
      const pose = hits[0].getPose(ref);
      reticle.matrix.fromArray(pose.transform.matrix);
      const up = new THREE.Vector3(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(reticle.matrix));
      reticle.visible = up.y > 0.85;
      if (reticle.visible && !reticle.seen) { reticle.seen = true; toast(`Found the floor! Tap to place ${look.name}`); }
    }
  }
  const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);

  if (mode === 'create') {
    pet.rotation.y += dt * 0.5;
    pet.update(dt, null);
    controls.update();
  } else {
    if (mode === 'play') controls.update();
    if (pet && pet.parent) {
      if (pet.popIn !== undefined && pet.popIn < 1) { pet.popIn = Math.min(1, pet.popIn + dt * 3); const s = 1 - Math.pow(1 - pet.popIn, 3) * 1; pet.scale.setScalar(Math.max(0.01, s * (1 + Math.sin(pet.popIn * Math.PI) * 0.15))); }
      pet.update(dt, camPos);
    }
    stepThrown(dt);
    checkFound();
    // Self-started mischief every so often.
    nextMischief -= dt;
    if (nextMischief < 0 && pet && pet.parent && pet.state === 'idle' && !hideGame && !inHand && thrown.every((o) => !o.held)) {
      nextMischief = 50 + Math.random() * 50;
      if (Math.random() < 0.5) startHide(true); else runAway();
    }
  }
  // held item wobble
  if (inHand) { inHand.position.y = -0.1 + Math.sin(time / 300) * 0.004; inHand.rotation.y += dt * 1.5; }

  const fp = pet ? pet.position : new THREE.Vector3();
  sun.position.set(fp.x + 0.5, floorY + 1.4, fp.z + 0.4); sun.target.position.copy(fp);
  hearts.update(dt); updateEmotes(dt);
  updateArrow();
  renderer.render(scene, camera);
});

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// Frame the pet above the bottom panel on tall phone screens.
function frameCamera(which) {
  const portrait = innerHeight > innerWidth;
  if (which === 'create') { camera.position.set(0, 0.2, portrait ? 1.0 : 0.62); controls.target.set(0, portrait ? -0.07 : 0.06, 0); }
  else { camera.position.set(0, 0.5, portrait ? 1.25 : 0.85); controls.target.set(0, portrait ? -0.12 : 0.02, -0.1); }
  controls.update();
}

/* ---------------- boot ---------------- */
frameCamera('create');
buildCreator();
refreshPet();
(async () => {
  const ok = navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar').catch(() => false));
  $('goAR').hidden = !ok;
  if (ok) { $('goPlay').className = 'big alt'; $('goPlay').textContent = 'Play on screen instead'; }
  $('arNote').textContent = ok ? 'Your pet will appear on your real floor.' : 'On an Android phone in Chrome, your pet can walk on your real floor.';
})();
