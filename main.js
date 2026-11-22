import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pet, Ball, makeTreat, makeBowl, Hearts } from './pet.js';

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
  bark: () => { tone(620, 380, 0.11, 'square', 0.07); tone(680, 400, 0.11, 'square', 0.07, 0.18); },
  sing: () => { [660, 740, 880, 740, 990, 880].forEach((f, i) => tone(f, f * 1.02, 0.2, 'sine', 0.12, i * 0.22)); },
  purr: () => { for (let i = 0; i < 6; i++) tone(90, 80, 0.09, 'sawtooth', 0.04, i * 0.1); },
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
const skills = { come: 0.55, sit: 0.25, spin: 0.15, hop: 0.3, fetch: 0.45, hide: 0.2, sleep: 0.3, down: 0.3, stay: 0.3, jumphigh: 0.2,
  paw: 0.3, highfive: 0.2, wave: 0.15, speak: 0.4, rollover: 0.1, playdead: 0.1, beg: 0.2, bow: 0.15, dance: 0.25, sing: 0.2,
  chasetail: 0.35, backflip: 0.05, shy: 0.2, kiss: 0.6, sniff: 0.5, shakeoff: 0.4, up: 0.35, follow: 0.6, ...(saved?.skills || {}) };
let lastSuccess = null;

/* ---------------- needs: food, water, energy, happiness, tummy ---------------- */
const needs = { hunger: 80, thirst: 80, energy: 90, fun: 70, tummy: 0, ...(saved?.needs || {}) };
let sick = !!saved?.sick;
{ // Time passes while the app is closed (gently).
  const away = saved?.at ? Math.min(6 * 3600, (Date.now() - saved.at) / 1000) : 0;
  needs.hunger = Math.max(15, needs.hunger - away * 0.004);
  needs.thirst = Math.max(15, needs.thirst - away * 0.005);
  needs.energy = Math.min(100, needs.energy + away * 0.02);
  needs.tummy = Math.max(0, needs.tummy - away / 90);
}
const clamp01 = (v) => Math.max(0, Math.min(100, v));
function spend(kind, amt) { needs[kind] = clamp01(needs[kind] - amt); }
let needTalk = 12;
let napStart = 0;
let bowl = null;

function updateNeeds(dt) {
  if (!pet?.parent || mode === 'create') return;
  const sleeping = pet.state === 'sleep';
  needs.hunger = clamp01(needs.hunger - dt * 0.12);
  needs.thirst = clamp01(needs.thirst - dt * (pet.state === 'walk' ? 0.3 : 0.15));
  needs.fun = clamp01(needs.fun - dt * 0.08);
  needs.tummy = Math.max(0, needs.tummy - dt / 90);
  if (sleeping) needs.energy = clamp01(needs.energy + dt * 6);
  else needs.energy = clamp01(needs.energy - dt * (pet.state === 'walk' ? 0.25 : 0.06));

  // Too many cookies → tummy ache. Water + a nap make it better.
  if (!sick && needs.tummy >= 4) {
    sick = true; pet.state = 'idle'; pet.target = null;
    emote('ugh…', '#b7d98a'); sfx.confused();
    toast(`${look.name} ate too many cookies and has a tummy ache 🤢`);
  }
  if (sick && sleeping && needs.thirst > 60 && performance.now() - napStart > 12000) {
    sick = false; needs.tummy = 0;
    pet.state = 'idle'; pet.happy(3); emote('All better!', '#7ee08a');
    toast(`${look.name} feels better! 💚`);
  }
  // Waking up from a nap on its own.
  if (sleeping && !sick && needs.energy >= 100 && !pet.inBed) { pet.state = 'idle'; pet.hop(); emote('!'); }
  // Exhausted → falls asleep by itself.
  if (!sleeping && needs.energy < 6 && ['idle', 'sit'].includes(pet.state) && !hideGame) { goToBedAndNap(); }

  pet.setCondition({ sick, tired: needs.energy < 25 });

  // Say what it needs, every so often.
  needTalk -= dt;
  if (needTalk < 0 && !sleeping && !hideGame) {
    needTalk = 9 + Math.random() * 6;
    if (sick) emote(needs.thirst < 60 ? 'water…' : 'tummy hurts', '#b7d98a');
    else if (needs.thirst < 25) emote('thirsty…', '#5ad1e6');
    else if (needs.hunger < 25) emote('hungry…', '#ffd25e');
    else if (needs.energy < 25) emote('*yawn*');
    else if (needs.fun < 25) emote('play?', '#ff7eb3');
  }
}
function goNap() { pet.target = null; pet.sleep(); napStart = performance.now(); emote('z z z'); }

let meterTick = 0;
function updateMeters(dt) {
  meterTick -= dt; if (meterTick > 0) return; meterTick = 0.4;
  const set = (id, v) => { const b = $(id); b.style.width = `${v}%`; b.style.background = v < 25 ? '#ff6b6b' : v < 50 ? '#ffd25e' : '#7ee08a'; };
  set('mHunger', needs.hunger); set('mThirst', needs.thirst); set('mEnergy', needs.energy); set('mFun', needs.fun);
  const st = $('status');
  const msg = sick ? `${look.name} has a tummy ache 🤢 — water and a nap` : pet?.state === 'sleep' ? `${look.name} is napping 😴` : needs.energy < 25 ? `${look.name} is tired 🥱` : '';
  st.hidden = !msg; st.textContent = msg;
  persist();
}

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
  for (const old of [...emotes.children]) old.life = Math.max(old.life, 1.3);   // fade the previous bubble
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
  armKnock(); setTimeout(greet, 400);
  toast(`Tap the mic and say "${look.name}, sit!"`);
}

async function startAR() {
  audio().resume?.();
  const base = { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'local-floor'], domOverlay: { root: $('ui') } };
  // Ask for depth sensing so the pet can hide behind your real furniture; fall back without it.
  const withDepth = { ...base, optionalFeatures: [...base.optionalFeatures, 'depth-sensing'],
    depthSensing: { usagePreference: ['cpu-optimized', 'gpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] } };
  const session = await navigator.xr.requestSession('immersive-ar', withDepth)
    .catch(() => navigator.xr.requestSession('immersive-ar', base))
    .catch((e) => { toast('AR could not start: ' + e.message); return null; });
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
  depthCPU = session.depthUsage === 'cpu-optimized';
  floorMap.length = 0; $('roomChip').hidden = false; $('roomCount').textContent = '0';
  toast('Slowly point your phone at the floor…');
  session.addEventListener('end', () => {
    $('ui').style.pointerEvents = '';
    $('roomChip').hidden = true; pet.setVisibility(1); stopHideBuzz(); setWalk(false); setVoiceOnly(false); placed = false; hideGame = null;
    hitSource = null; mode = 'create'; room.visible = true; shadowCatcher.visible = false; controls.enabled = true; reticle.visible = false;
    renderer.setClearColor('#1a1240', 1); frameCamera('create');
    $('hud').hidden = true; $('create').hidden = false; scene.add(pet); pet.position.set(0, 0, 0); floorY = 0;
    clearThrown(); stopListening();
  });
  // Keep UI taps from also counting as "tap the room".
  for (const el of document.querySelectorAll('#ui button, #ui .pill, #ui .panel')) el.addEventListener('beforexrselect', (e) => e.preventDefault());
}
let hitSource = null;
let depthCPU = false;

/* ---------------- camera mode (phones without full AR): your camera + gyro ---------------- */
let camStream = null, orient = null, alphaOffset = null;
async function startCam() {
  audio().resume?.();
  try {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') await DOE.requestPermission();
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  } catch (e) { toast('Camera is needed to bring your pet into your room'); return; }
  const v = $('camfeed'); v.srcObject = camStream; v.hidden = false; await v.play().catch(() => {});
  mode = 'cam'; placed = true; floorY = 0; alphaOffset = null;
  room.visible = false; shadowCatcher.visible = true; shadowCatcher.position.y = 0.001; controls.enabled = false;
  renderer.setClearColor('#000000', 0);
  camera.fov = 62; camera.updateProjectionMatrix();
  camera.position.set(0, 1.15, 0); camera.quaternion.identity();
  // A ring of floor around you the pet can roam and hide on.
  floorMap.length = 0;
  for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2, r = 0.7 + Math.random() * 1.6; floorMap.push(new THREE.Vector3(Math.sin(a) * r, 0, -Math.cos(a) * r)); }
  pet.position.set(0, 0, -1.0); pet.rotation.y = 0; pet.scale.setScalar(0.01); pet.popIn = 0;
  $('create').hidden = true; $('hud').hidden = false; setNames();
  addEventListener('deviceorientation', onOrient);
  armKnock(); setTimeout(greet, 300);
  toast(`Point your phone at the floor — ${look.name} is there! Turn around to look for them.`);
}
function onOrient(e) { if (e.alpha == null) return; orient = e; if (alphaOffset == null) alphaOffset = e.alpha; }
const _euler = new THREE.Euler(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), _z = new THREE.Vector3(0, 0, 1);
function applyOrientation() {
  if (!orient) return;
  const d2r = Math.PI / 180;
  const screenAngle = (screen.orientation?.angle || 0) * d2r;
  _euler.set(orient.beta * d2r, (orient.alpha - alphaOffset) * d2r, -orient.gamma * d2r, 'YXZ');
  const q = new THREE.Quaternion().setFromEuler(_euler).multiply(_q1).multiply(_q0.setFromAxisAngle(_z, -screenAngle));
  camera.quaternion.slerp(q, 0.5);
}
function stopCam() {
  removeEventListener('deviceorientation', onOrient); orient = null;
  camStream?.getTracks().forEach((t) => t.stop()); camStream = null; $('camfeed').hidden = true;
  camera.fov = 55; camera.updateProjectionMatrix();
  room.visible = true; shadowCatcher.visible = false; controls.enabled = true; renderer.setClearColor('#1a1240', 1);
}

/* ---------------- learning your room ---------------- */
// Every floor spot your phone sees gets remembered, so the pet can roam and hide all over the room.
const floorMap = [];
function learnFloor(p) {
  if (placed && Math.abs(p.y - floorY) > 0.08) return;          // only the same floor level
  if (floorMap.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 0.09)) return; // keep ~30cm apart
  if (floorMap.length < 400) { floorMap.push(p.clone()); $('roomCount').textContent = floorMap.length; }
  if (floorMap.length === 12) toast(`${look.name} is learning your room — walk around! 🏠`);
}
let nextRoam = 8;
function maybeRoam(dt) {
  if (stayMode || (mode !== 'ar' && mode !== 'cam') || !placed || pet.state !== 'idle' || pet.target || hideGame || inHand || sick || needs.energy < 25) return;
  nextRoam -= dt; if (nextRoam > 0) return;
  nextRoam = 7 + Math.random() * 10;
  const near = floorMap.filter((q) => q.distanceTo(pet.position) < 2.5 && q.distanceTo(pet.position) > 0.4);
  if (!near.length) return;
  travel(near[Math.floor(Math.random() * near.length)]);
  if (Math.random() < 0.3) emote(['sniff sniff', 'ooh?', '♪'][Math.floor(Math.random() * 3)]);
}

/* ---------------- hiding behind real things (depth sensing) ---------------- */
let occl = 1;
function updateOcclusion(frame) {
  if (mode !== 'ar' || !placed || !depthCPU || !frame) { if (occl !== 1) { occl = 1; pet?.setVisibility(1); } return; }
  const ref = renderer.xr.getReferenceSpace();
  const pose = frame.getViewerPose(ref); if (!pose) return;
  const view = pose.views[0];
  let info = null; try { info = frame.getDepthInformation(view); } catch {}
  if (!info) return;
  const xrCam = renderer.xr.getCamera().cameras[0] || camera;
  const pts = [[0, 0.03, 0], [0, 0.1, 0], [0, 0.17, 0], [0.06, 0.08, 0], [-0.06, 0.08, 0]];
  let seen = 0;
  for (const [x, y, z] of pts) {
    const w = pet.localToWorld(new THREE.Vector3(x, y, z));
    const camSpace = w.clone().applyMatrix4(xrCam.matrixWorldInverse);
    const petDepth = -camSpace.z;
    const ndc = w.clone().project(xrCam);
    if (petDepth <= 0 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) { seen++; continue; }
    let real = Infinity;
    try { real = info.getDepthInMeters((ndc.x + 1) / 2, (1 - ndc.y) / 2); } catch {}
    if (!(real > 0) || real + 0.06 > petDepth) seen++;
  }
  const target = seen / pts.length;
  occl += (target - occl) * 0.25;
  pet.setVisibility(Math.max(0, Math.min(1, occl)));
}

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
    greet(); armKnock();
    toast(`Say "${look.name}, come!" or flick a ball`);
    return;
  }
  const ray = new THREE.Raycaster();
  const m = ctrl.matrixWorld;
  ray.ray.origin.setFromMatrixPosition(m);
  ray.ray.direction.set(0, 0, -1).transformDirection(m);
  handleTap(ray);
});

/* ---------------- tables & moving between heights ---------------- */
const tableMap = [];
function learnTable(p) {
  if (!placed) return;
  const h = p.y - floorY;
  if (h < 0.3 || h > 1.25) return;
  if (tableMap.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 0.0625 && Math.abs(q.y - p.y) < 0.1)) return;
  if (tableMap.length < 200) tableMap.push(p.clone());
  if (tableMap.length === 4) toast(`${look.name} spotted a table! Say "jump up!" 🪑`);
}
// Go anywhere, jumping up or down when the height changes.
function travel(point, run = false, cb = null) {
  const dy = point.y - pet.position.y;
  if (Math.abs(dy) < 0.1) { pet.goTo(point, run, cb); return; }
  const d = Math.hypot(point.x - pet.position.x, point.z - pet.position.z);
  if (d < 0.75) { pet.leapTo(point, cb); return; }
  // Walk closer at the current height, then jump.
  const dir = new THREE.Vector3(point.x - pet.position.x, 0, point.z - pet.position.z).normalize();
  const near = new THREE.Vector3(point.x - dir.x * 0.4, pet.position.y, point.z - dir.z * 0.4);
  pet.goTo(near, run, () => pet.leapTo(point, cb));
}
function nearest(list, from, maxD = Infinity) {
  let best = null, bd = maxD;
  for (const q of list) { const d = Math.hypot(q.x - from.x, q.z - from.z); if (d < bd) { bd = d; best = q; } }
  return best;
}
const onTable = () => pet && pet.position.y - floorY > 0.2;

/* ---------------- Pip's bed ---------------- */
let bed = null, placingBed = false;
function makeBed() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 16, 40), new THREE.MeshStandardMaterial({ color: '#7c5cff', roughness: 0.9 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.03; rim.castShadow = rim.receiveShadow = true;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 40), new THREE.MeshStandardMaterial({ color: '#ffd1e0', roughness: 1 }));
  pad.position.y = 0.015; pad.receiveShadow = true;
  g.add(rim, pad); return g;
}
$('bedBtn').onclick = () => {
  placingBed = true;
  toast(`Tap a spot on the floor for ${look.name}'s bed 🛏️`);
};
function placeBed(p) {
  placingBed = false;
  if (!bed) bed = makeBed();
  scene.add(bed); bed.position.copy(p); bed.position.y = floorY; bed.scale.setScalar(0.01); bed.pop = 0;
  sfx.happy(); emote('my bed!', '#ff7eb3');
  toast(`Bed placed! Say "take a nap" and ${look.name} will sleep there`);
  persist();
}
function nearBed() {
  if (!bed?.parent) return true;
  if (mode === 'ar') { const cp = new THREE.Vector3(); camera.getWorldPosition(cp); return Math.hypot(bed.position.x - cp.x, bed.position.z - cp.z) < 1.4; }
  if (mode === 'cam') return lookAngle() < 0.6;
  return true;
}
function goToBedAndNap() {
  if (bed?.parent) {
    emote('bedtime…'); travel(bed.position.clone().setY(floorY), false, () => { pet.position.copy(bed.position).setY(floorY + 0.03); goNap(); pet.inBed = true; });
  } else goNap();
}
function wakeUp() {
  if (pet.state !== 'sleep') return;
  if (pet.inBed && !nearBed()) { emote('z z z'); toast(`${look.name} is asleep in bed — go over to the bed to wake them up`); return; }
  pet.inBed = false; pet.state = 'idle'; pet.position.y = floorY; pet.trickNow('stretch'); emote('*yawn*');
  setTimeout(() => { if (pet.state === 'idle') { pet.happy(2); emote('Morning!', '#ffd25e'); } }, 1900);
}

/* ---------------- puppy love: asks for pats, you tap your phone ---------------- */
let wantsPat = 0, pats = 0, nextCuddle = 40;
function wantPats() {
  wantsPat = performance.now() + 12000; pats = 0;
  pet.faceYaw = null; pet.sit();
  emote('pat pat? 🥺', '#ff7eb3'); buzz(20);
  toast(`${look.name} wants pats — tap the top of your phone (or tap ${look.name})`);
  armKnock();
}
function pat() {
  if (!pet) return;
  pats++; buzz(25); sfx.purr();
  hearts.burst(pet.localToWorld(new THREE.Vector3(0, 0.2, 0)), 2);
  pet.state = 'hop'; pet.jump = 0.4;
  needs.fun = clamp01(needs.fun + 6);
  if (pats >= 3) {
    wantsPat = 0; pets_given++;
    setTimeout(() => { pet.happy(3); emote('♥ ♥ ♥', '#ff7eb3'); buzz([30, 40, 30]); }, 250);
    praise();
  } else emote(pats === 1 ? '♥' : '♥♥', '#ff7eb3');
}
let pets_given = 0;
function maybeCuddle(dt) {
  if (wantsPat && performance.now() > wantsPat) { wantsPat = 0; emote('aww…'); }
  if (wantsPat || hideGame || stayMode || inHand || sick || pet.state !== 'idle' || pet.target) return;
  nextCuddle -= dt; if (nextCuddle > 0) return;
  nextCuddle = 45 + Math.random() * 45;
  if (needs.fun > 85 && Math.random() < 0.5) return;
  emote('♥?'); travel(frontOfYou(0.35), false, () => wantPats());
}

/* ---------------- puppy personality ---------------- */
let nextQuirk = 6, greeted = false;
function greet() {
  if (greeted) return; greeted = true;
  const away = saved?.at ? (Date.now() - saved.at) / 60000 : 0;
  if (away > 10) {
    emote('Missed you!!', '#ff7eb3'); sfx.happy(); pet.happy(4);
    setTimeout(() => pet.trickNow('chasetail'), 1800);
  } else { emote('Hi!'); pet.happy(2); }
}
function puppyQuirks(dt) {
  if (stayMode || hideGame || inHand || wantsPat || pet.state !== 'idle' || pet.target) return;
  nextQuirk -= dt; if (nextQuirk > 0) return;
  nextQuirk = 8 + Math.random() * 10;
  const r = Math.random();
  if (needs.energy < 25) { pet.trickNow('stretch'); emote('*yawn*'); return; }
  // Bored? Bring you the ball.
  const ball = thrown.find((o) => o.kind === 'ball' && !o.held);
  if (needs.fun < 45 && ball && r < 0.6) { emote('play?', '#ff7eb3'); chase(ball, true); return; }
  if (r < 0.25) { pet.trickNow('sniff'); emote('sniff sniff'); }
  else if (r < 0.4) pet.trickNow('scratch');
  else if (r < 0.5) pet.trickNow('shakeoff');
  else if (r < 0.6 && needs.fun > 50) { pet.trickNow('chasetail'); }
  else if (r < 0.72 && tableMap.length && !onTable()) { const t = nearest(tableMap, pet.position, 1.6); if (t) { emote('ooh, up there!'); travel(t, false, () => pet.hop()); } }
  else if (r < 0.8 && onTable()) { const f = nearest(floorMap, pet.position, 2); if (f) travel(f.clone().setY(floorY), false); }
}

/* ---------------- tapping the scene (preview) ---------------- */
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || (mode !== 'play' && mode !== 'cam')) return;
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
  if (placingBed) {
    const hp = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY), hp)) placeBed(hp);
    return;
  }
  if (ray.intersectObject(pet, true).length) {
    if (hideGame) return foundPet();
    if (pet.state === 'sleep') { pet.hop(); emote('!'); return; }
    if (wantsPat) { pat(); return; }
    sfx.squeak(); pet.happy(2); emote('♥', '#ff7eb3');
    praise();
    return;
  }
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY), hit)) {
    if (hideGame) return;
    travel(hit);
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
$('waterBtn').onclick = () => placeWater();

function placeWater() {
  if (!pet?.parent) return;
  if (!bowl) { bowl = makeBowl(); }
  scene.add(bowl);
  bowl.position.copy(frontOfYou(0.4)); bowl.position.y = floorY;
  bowl.scale.setScalar(0.01); bowl.pop = 0;
  sfx.chirp(0.8);
  if (pet.state === 'sleep') { emote('z z z'); return; }
  setTimeout(() => {
    if (!bowl.parent || pet.state === 'sleep' || hideGame) return;
    travel(bowl.position, needs.thirst < 40, () => {
      pet.state = 'eat'; emote('slurp');
      for (let i = 0; i < 5; i++) tone(500, 380, 0.07, 'sine', 0.12, i * 0.22);
      const t0 = performance.now();
      const drink = () => {
        const p = (performance.now() - t0) / 1600;
        bowl.water.scale.setScalar(Math.max(0.2, 1 - p * 0.8));
        if (p < 1) return requestAnimationFrame(drink);
        needs.thirst = 100; pet.state = 'idle';
        bowl.water.scale.setScalar(1);
        if (sick) { emote('need a nap…', '#b7d98a'); setTimeout(() => { if (sick && pet.state !== 'sleep') goNap(); }, 1500); }
        else { pet.happy(1); emote('Ahh!', '#5ad1e6'); }
      };
      drink();
    });
  }, 500);
}

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
    if (sick) { emote('no more cookies…', '#b7d98a'); return; }
    travel(o.position, true, () => eatTreat(o));
  } else {
    // Always chases. Whether it brings it back depends on training (and mood).
    const willReturn = Math.random() < 0.35 + (skills.fetch ?? 0.5) * 0.6;
    setTimeout(() => chase(o, willReturn), 250);
  }
}
function chase(o, willReturn = true) {
  if (!thrown.includes(o)) return;
  travel(o.position, true, () => {
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
      travel(clampToPlay(pet.position.clone().addScaledVector(away, 0.5)), true, () => { drop('hehe'); pet.hop(); skills.fetch = Math.min(1, skills.fetch + 0.02); persist(); });
      return;
    }
    travel(frontOfYou(0.35), true, () => {
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
    else {
      removeThrown(o); pet.state = 'idle';
      needs.hunger = clamp01(needs.hunger + 25); needs.fun = clamp01(needs.fun + 5); needs.tummy += 1;
      if (needs.tummy >= 3 && needs.tummy < 4) { emote('so full…', '#ffd25e'); sfx.confused(); }
      else { pet.happy(2); emote('Yum!', '#ffd25e'); }
      praise(true);
    }
  };
  shrink();
}
function removeThrown(o) { const i = thrown.indexOf(o); if (i >= 0) thrown.splice(i, 1); o.parent?.remove(o); }
function clearThrown() { for (const o of [...thrown]) removeThrown(o); if (inHand) { camera.remove(inHand); inHand = null; } }

function frontOfYou(dist = 0.4) {
  if (mode === 'cam') dist = Math.max(dist, 0.9);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  return new THREE.Vector3(cp.x + fwd.x * dist, floorY, cp.z + fwd.z * dist);
}

/* ---------------- training: obey sometimes, better with practice ---------------- */
const TRICK_NAMES = {
  come: ['Come', 'come / come back'], sit: ['Sit', 'sit'], down: ['Lie down', 'lie down'], stay: ['Stay', 'stay … then "come"'],
  spin: ['Spin', 'spin'], hop: ['Jump', 'jump'], jumphigh: ['Big jump', 'jump high'], fetch: ['Fetch', 'play catch / get your ball'],
  paw: ['Shake', 'shake / paw'], highfive: ['High five', 'high five'], wave: ['Wave', 'wave / say hi'], speak: ['Speak', 'speak / bark'],
  rollover: ['Roll over', 'roll over'], playdead: ['Play dead', 'play dead / bang'], beg: ['Beg', 'beg'], bow: ['Bow', 'take a bow'],
  dance: ['Dance', 'dance'], sing: ['Sing', 'sing'], chasetail: ['Chase tail', 'chase your tail'], backflip: ['Backflip', 'backflip'],
  shy: ['Peekaboo', 'peekaboo'], kiss: ['Kisses', 'kiss / I love you'], sniff: ['Sniff', 'find it / sniff'], shakeoff: ['Shake off', 'shake it off'],
  hide: ['Hide & seek', 'hide and seek'], sleep: ['Nap', 'take a nap · "wake up" at the bed'], up: ['Jump on table', 'jump up / get down'],
  follow: ['Walk together', 'follow me / heel'],
};
function obey(cmd, quiet = false) {
  const s = skills[cmd] ?? 0.3;
  if (sick) { emote('tummy hurts…', '#b7d98a'); sfx.confused(); return false; }
  const tiredPenalty = needs.energy < 25 ? 0.3 : 0;
  if (tiredPenalty && Math.random() < 0.4) { emote('*yawn*'); return false; }
  // A little mischief: sometimes it just runs off!
  if (Math.random() < 0.07 && cmd !== 'fetch' && !tiredPenalty) { runAway(); return false; }
  if (Math.random() < 0.3 + s * 0.65 - tiredPenalty) return true;
  if (!quiet) {
    // Confused: does the wrong thing or tilts its head.
    if (Math.random() < 0.5) { emote('?'); sfx.confused(); }
    else { const wrong = ['hop', 'spin', 'sit'].filter((x) => x !== cmd)[Math.floor(Math.random() * 2)]; doTrick(wrong, true); emote('?'); }
  } else { emote('Meh'); sfx.confused(); }
  skills[cmd] = Math.min(1, s + 0.02); persist();
  return false;
}
function success(cmd) {
  const cost = { fetch: [8, 6, 15], hide: [8, 4, 20], come: [2, 1, 4] }[cmd] || [3, 1, 6];
  spend('energy', cost[0]); spend('thirst', cost[1]); needs.fun = clamp01(needs.fun + cost[2]);
  skills[cmd] = Math.min(1, (skills[cmd] ?? 0.3) + 0.07);
  lastSuccess = { cmd, t: performance.now() };
  persist();
}
function praise(treat = false) {
  if (lastSuccess && performance.now() - lastSuccess.t < 8000) {
    const c = lastSuccess.cmd;
    skills[c] = Math.min(1, skills[c] + (treat ? 0.12 : 0.06));
    toast(`${look.name} is learning "${(TRICK_NAMES[c] || [c])[0]}"  ${stars(skills[c])}`);
    lastSuccess = null; persist();
  }
}
const stars = (v) => '★'.repeat(Math.round(v * 5)) + '☆'.repeat(5 - Math.round(v * 5));
function showTricks() {
  const list = $('tricksList'); list.innerHTML = '';
  for (const [k, [n, say]] of Object.entries(TRICK_NAMES)) {
    const row = document.createElement('div'); row.className = 'trick-row';
    row.innerHTML = `<span>${n}<br><small>"${say}"</small></span><span>${stars(skills[k] ?? 0.3)}</span>`;
    list.appendChild(row);
  }
  document.querySelectorAll('.pn').forEach((e) => (e.textContent = look.name));
  $('tricksSheet').hidden = false;
}
$('petName').onclick = showTricks;
$('tricksBtn').onclick = showTricks;
$('tricksClose').onclick = () => ($('tricksSheet').hidden = true);

function doTrick(cmd, forced = false) {
  if (!forced && !obey(cmd)) return;
  switch (cmd) {
    case 'come': travel(frontOfYou(0.3), false, () => { pet.hop(); success('come'); }); emote('!'); return;
    case 'sit': pet.sit(); break;
    case 'spin': pet.spin(); break;
    case 'hop': pet.hop(); break;
    case 'sleep': goToBedAndNap(); break;
    case 'hide': startHide(); return;
    case 'down': pet.lieDown(); break;
    case 'kiss': emote('♥'); travel(frontOfYou(0.3), true, () => { pet.happy(2); hearts.burst(pet.localToWorld(new THREE.Vector3(0, 0.22, 0)), 8); sfx.happy(); success('kiss'); wantPats(); }); return;
    case 'up': {
      const t = nearest(tableMap, pet.position, 2.5);
      if (!t) { emote('where?'); toast('Point your phone at a table top so it can see it'); return; }
      emote('up!'); travel(t, false, () => { pet.hop(); success('up'); }); return;
    }
    case 'off': {
      if (!onTable()) { emote('?'); return; }
      const f = nearest(floorMap, pet.position, 2) || new THREE.Vector3(pet.position.x + 0.3, floorY, pet.position.z + 0.3);
      travel(f.clone().setY(floorY), false, () => pet.hop()); return;
    }
    default:
      if (Pet.TRICKS[cmd]) {
        pet.trickNow(cmd);
        if (cmd === 'speak') sfx.bark();
        if (cmd === 'sing') sfx.sing();
        if (cmd === 'dance') emote('♪ ♫');
        if (cmd === 'playdead') emote('x_x');
        if (cmd === 'beg') emote('please?');
        if (cmd === 'shy') emote('peekaboo!');
        if (!forced) setTimeout(() => success(cmd), Pet.TRICKS[cmd] * 1000);
        return;
      }
  }
  if (!forced) setTimeout(() => success(cmd), 200);
}

function runAway() {
  emote('Nope!', '#ffd25e'); sfx.nope();
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const away = pet.position.clone().sub(cp); away.y = 0; away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.6);
  const p = clampToPlay(pet.position.clone().addScaledVector(away, 0.6 + Math.random() * 0.4));
  travel(p, true, () => { emote('hehe'); setTimeout(() => { if (pet.state === 'idle' && !hideGame) travel(frontOfYou(0.4)); }, 2500); });
}
function clampToPlay(p) {
  const lim = mode === 'play' ? 1.5 : mode === 'cam' ? 2.4 : Infinity;
  { const d = Math.hypot(p.x, p.z); if (d > lim) { p.x *= lim / d; p.z *= lim / d; } }
  p.y = floorY; return p;
}

/* ---------------- hide and seek ---------------- */
function startHide(self = false) {
  let spot;
  if (mode === 'play') {
    spot = hidingSpots[Math.floor(Math.random() * hidingSpots.length)].clone();
  } else if (floorMap.length > 6) {
    // In your room: pick a learned floor spot that's out of sight, not too far.
    const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
    const options = floorMap.filter((q) => {
      const d = Math.hypot(q.x - cp.x, q.z - cp.z);
      const ndc = q.clone().setY(floorY + 0.08).project(camera);
      const outOfView = ndc.z > 1 || Math.abs(ndc.x) > 0.9 || Math.abs(ndc.y) > 0.9;
      return d > 1 && d < 4.5 && outOfView;
    });
    const pool = options.length ? options : floorMap.filter((q) => q.distanceTo(pet.position) > 0.8);
    spot = (pool.length ? pool : floorMap)[Math.floor(Math.random() * (pool.length || floorMap.length))].clone();
  } else {
    // Room not learned yet: dash somewhere out of view (to the side or behind you).
    const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const ang = (Math.random() < 0.5 ? 1 : -1) * (1.9 + Math.random() * 0.9);
    const dir = fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    spot = new THREE.Vector3(cp.x + dir.x * 1.3, floorY, cp.z + dir.z * 1.3);
  }
  spot.y = floorY;
  emote(self ? 'Catch me!' : 'Count to 3!', '#ffd25e'); sfx.happy();
  travel(spot, true, () => { pet.state = 'hiding'; });
  hideGame = { since: performance.now() };
  toast(canBuzz
    ? `${look.name} is hiding! Your phone buzzes faster when you're close. Knock knock to tag! 👀`
    : `${look.name} is hiding! Look around to find them 👀`);
  startHideBuzz();
}
function foundPet() {
  hideGame = null; $('arrow').hidden = true; stopHideBuzz();
  buzz([40, 60, 40, 60, 120]);
  pet.state = 'idle'; pet.setVisibility(1); pet.happy(3); emote('Found me!', '#7ee08a');
  toast(`You found ${look.name}! 🎉`);
  success('hide');
}

/* ---------------- buzz: warmer/colder + knock-knock to tag ---------------- */
const canBuzz = 'vibrate' in navigator;
const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };
let buzzTimer = null;
function hideDistance() {
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  return Math.hypot(pet.position.x - cp.x, pet.position.z - cp.z);
}
function startHideBuzz() {
  stopHideBuzz();
  const pulse = () => {
    if (!hideGame) return;
    // Nobody looking? After a while it gives up and comes out.
    if (performance.now() - hideGame.since > 75000) {
      hideGame = null; $('arrow').hidden = true; pet.state = 'idle'; pet.setVisibility(1);
      emote('here I am!', '#ffd25e'); travel(frontOfYou(0.4), true, () => pet.happy(2)); return;
    }
    const d = mode === 'ar' ? hideDistance() : mode === 'cam' ? 0.6 + lookAngle() * 1.3 : 1.5;
    if (pet.state === 'hiding') buzz(d < 1 ? 45 : 25);
    // Closer → faster heartbeat.
    buzzTimer = setTimeout(pulse, THREE.MathUtils.clamp(180 + (d - 0.6) * 450, 180, 1600));
  };
  buzzTimer = setTimeout(pulse, 1200);
}
// How far your view is pointing away from the pet (radians).
function lookAngle() {
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const to = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).sub(cp).normalize();
  return Math.acos(THREE.MathUtils.clamp(fwd.dot(to), -1, 1));
}
function stopHideBuzz() { clearTimeout(buzzTimer); buzzTimer = null; }

// Knock twice on your phone (two sharp jolts) to tag the hiding pet.
let lastKnock = 0, motionArmed = false, lastPat = 0;
function armKnock() {
  if (motionArmed) return; motionArmed = true;
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') DME.requestPermission().catch(() => {});
  addEventListener('devicemotion', (e) => {
    if ((!hideGame && !wantsPat && pet?.state !== 'sleep') || inHand) return;
    const a = e.acceleration; if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (mag < 7 || mag > 30) return;   // a knock: sharp but small (a flick is bigger)
    const now = performance.now();
    if (now - lastKnock < 90) return;  // same jolt
    if (wantsPat) { if (now - lastPat > 220) { lastPat = now; pat(); } return; }
    if (now - lastKnock < 550) { lastKnock = 0; knockKnock(); } else lastKnock = now;
  });
}
function knockKnock() {
  if (pet.state === 'sleep') { buzz([30, 50, 30]); wakeUp(); return; }
  if (!hideGame || pet.state !== 'hiding') return;
  const close = mode === 'ar' ? hideDistance() < 1.3 : mode === 'cam' ? lookAngle() < 0.45 : true;
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const inView = p.z < 1 && Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.8;
  if (close && (inView || mode === 'play')) foundPet();
  else { buzz(15); emote('hehe'); toast(close ? 'Close! Point your phone at them and knock again' : 'Not here… keep looking!'); }
}
$('hideBtn').onclick = () => { armKnock(); if (!hideGame) doTrick('hide', true); };

function checkFound() {
  // On screen, you find it by tapping it; in your room, by looking at it.
  if (!hideGame || pet.state !== 'hiding' || mode === 'play') return;
  // Found when it's near the middle of your view and reasonably close.
  const p = pet.localToWorld(new THREE.Vector3(0, 0.08, 0)).project(camera);
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  // Spotting it up close (and actually visible, not behind the couch) counts too.
  if (Math.abs(p.x) < 0.3 && Math.abs(p.y) < 0.45 && p.z < 1 && cp.distanceTo(pet.position) < (mode === 'cam' ? 3 : 0.9) && occl > 0.6 && performance.now() - hideGame.since > 2500) foundPet();
}

/* ---------------- voice ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
const COMMANDS = [
  [/\b(show (the )?(buttons|controls)|buttons)\b/, 'buttons'],
  [/\b(play catch|catch)\b/, 'fetch'],
  [/\b(follow|follow me|let's go|lets go|walk|heel)\b/, 'follow'],
  [/\b(get (your|the) ball|go get it|bring it|get it)\b/, 'getball'],
  [/\b(roll over|roll)\b/, 'rollover'],
  [/\b(play dead|bang|dead)\b/, 'playdead'],
  [/\b(high five|hi five|high 5|five)\b/, 'highfive'],
  [/\b(shake it off|shake off|wiggle)\b/, 'shakeoff'],
  [/\b(shake|paw|give me (your |a )?paw)\b/, 'paw'],
  [/\b(wave|say (hi|hello|bye)|bye bye)\b/, 'wave'],
  [/\b(speak|bark|woof|say something)\b/, 'speak'],
  [/\b(beg|pretty please)\b/, 'beg'],
  [/\b(dance|boogie|party)\b/, 'dance'],
  [/\b(take a bow|bow)\b/, 'bow'],
  [/\b(lie down|lay down)\b/, 'down'],
  [/\b(chase (your )?tail|tail)\b/, 'chasetail'],
  [/\b(jump high|big jump|higher)\b/, 'jumphigh'],
  [/\b(backflip|back flip|flip)\b/, 'backflip'],
  [/\b(sing|song)\b/, 'sing'],
  [/\b(peekaboo|peek a boo|shy)\b/, 'shy'],
  [/\b(stretch)\b/, 'stretch'],
  [/\b(sniff|smell|find it)\b/, 'sniff'],
  [/\b(kiss|give me a kiss|love you|i love you|cuddle|hug)\b/, 'kiss'],
  [/\b(jump up|up there|on the table|get up)\b/, 'up'],
  [/\b(get down|off the table|come down|off)\b/, 'off'],
  [/\b(come back|come|here|come here|over here)\b/, 'come'],
  [/\b(sit|sit down)\b/, 'sit'],
  [/\b(spin|twirl|turn around)\b/, 'spin'],
  [/\b(jump|hop)\b/, 'hop'],
  [/\b(fetch|ball|throw)\b/, 'fetch'],
  [/\b(treat|cookie|hungry|eat|snack)\b/, 'treat'],
  [/\b(water|drink|thirsty)\b/, 'water'],
  [/\b(hide|seek|hiding)\b/, 'hide'],
  [/\b(wake|wake up|rise and shine)\b/, 'wake'],
  [/\b(sleep|nap|rest|bed|night night|goodnight|good night|tired)\b/, 'sleep'],
  [/\b(okay|ok|free|release|go play|break)\b/, 'release'],
  [/\b(good|love|cute|best|great job|nice|yay|good boy|good girl)\b/, 'praise'],
  [/\b(stay|stop|wait|freeze)\b/, 'stay'],
];
function onSpeech(text) {
  const t = text.toLowerCase();
  $('heard').innerHTML = `You said: <b>${escapeHtml(text)}</b>`;
  $('voiceHeard').textContent = `"${text}"`;
  if (!pet || (mode === 'ar' && !placed)) return;
  const hit = COMMANDS.find(([re]) => re.test(t));
  if (!hit) {
    if (t.includes(look.name.toLowerCase())) { emote('?'); sfx.chirp(1.2); pet.target = null; pet.state = pet.state === 'sleep' ? 'idle' : pet.state; }
    else { emote('?'); sfx.confused(); }
    return;
  }
  const cmd = hit[1];
  if (pet.state === 'sleep' && !['wake', 'praise', 'buttons'].includes(cmd)) { emote('z z z'); return; }
  if (hideGame && cmd !== 'praise') { emote('shh!'); return; }
  switch (cmd) {
    case 'praise': sfx.happy(); pet.happy(2); emote('♥', '#ff7eb3'); praise(); return;
    case 'wake': wakeUp(); return;
    case 'stay': stayMode = true; zoomUntil = 0; pet.target = null; pet.faceYaw = null; pet.sit(); emote('staying!'); return;
    case 'release': stayMode = false; pet.state = 'idle'; pet.happy(1); emote('free!'); return;
    case 'fetch': (voiceOnly || follow) ? autoThrow('ball') : holdItem('ball'); emote('!!'); return;
    case 'buttons': setVoiceOnly(false); if (follow) setWalk(false); return;
    case 'getball': {
      const b = thrown.find((o) => o.kind === 'ball' && !o.held);
      if (!b) { holdItem('ball'); emote('ball?'); return; }
      if (!obey('fetch')) return;
      emote('!'); chase(b, true); return;
    }
    case 'treat': if (sick) { emote('no more cookies…', '#b7d98a'); return; } (voiceOnly || follow) ? autoThrow('treat') : holdItem('treat'); emote('!!'); return;
    case 'water': placeWater(); return;
    case 'follow': setWalk(true); return;
    case 'sleep': if (pet.state !== 'sleep') goToBedAndNap(); return;
    default: if (cmd === 'come') { zoomUntil = 0; stayMode = false; } doTrick(cmd);
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

/* ---------------- walk together: no controls, the pet follows you ---------------- */
let follow = false, followTick = 0, nextZoomies = 18, zoomUntil = 0;
var stayMode = false;
function setWalk(on) {
  follow = on;
  if (!on && pet) pet.faceYaw = null;
  $('hud').classList.toggle('walking', on);
  $('walkOff').hidden = !on;
  if (on) {
    if (pet.state === 'sleep' || pet.state === 'sit') pet.state = 'idle';
    emote("Let's go!", '#7ee08a'); sfx.happy();
    if (!listening && SR) startListening();   // so "come back!" works hands-free
    toast(`Walk around — ${look.name} follows you. Say "come back!" if they run off`);
  }
}
$('walkBtn').onclick = () => setWalk(true);

/* ---------------- voice-only: hide every button, talk to it ---------------- */
let voiceOnly = false;
function setVoiceOnly(on) {
  voiceOnly = on;
  $('hud').classList.toggle('voiceonly', on);
  $('voiceOff').hidden = !on;
  if (on) {
    if (!listening && SR) startListening();
    toast(`Just talk: "play catch", "want a treat?", "water", "hide and seek", "follow me"`);
  }
}
$('voiceOnlyBtn').onclick = () => setVoiceOnly(true);
$('voiceOff').onclick = () => { setVoiceOnly(false); if (follow) setWalk(false); };
// With no buttons to swipe, voice commands toss things for you.
function autoThrow(kind) {
  holdItem(kind);
  setTimeout(() => throwHeld(0.45 + Math.random() * 0.25, (Math.random() - 0.5) * 0.6), 450);
}
$('walkOff').onclick = () => setWalk(false);

function updateFollow(dt) {
  if (!follow || stayMode || !pet?.parent || (mode === 'ar' && !placed)) return;
  if (hideGame || ['sleep', 'eat', 'happy', 'spin', 'hop'].includes(pet.state) || thrown.some((o) => o.held)) return;
  const now = performance.now();
  if (now < zoomUntil) return;                       // off on an adventure
  followTick -= dt; if (followTick > 0) return; followTick = 0.4;

  // Zoomies: every so often it dashes ahead of you.
  nextZoomies -= 0.4;
  if (nextZoomies < 0 && needs.energy > 40 && !sick) {
    nextZoomies = 20 + Math.random() * 25;
    const ahead = clampToPlay(frontOfYou(mode === 'cam' ? 2.2 : 1.8).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, 0)));
    emote('zoom!', '#ffd25e'); sfx.chirp(1.6);
    travel(ahead, true, () => { pet.hop(); emote('come get me!'); });
    zoomUntil = now + 5000;
    return;
  }
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const moving = walkSpeed > 0.25;
  // Walking: trot at your side, facing the way you're going (not backwards in front of you).
  // Standing still: sit beside you and look up at you.
  const dir = moving ? walkDir.clone() : fwd;
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const spot = new THREE.Vector3(cp.x, floorY, cp.z).addScaledVector(dir, moving ? 0.35 : 0.55).addScaledVector(side, moving ? 0.45 : 0.3);
  const d = Math.hypot(pet.position.x - spot.x, pet.position.z - spot.z);
  pet.faceYaw = moving ? Math.atan2(dir.x, dir.z) : null;
  if (d > (moving ? 0.25 : 0.5)) travel(clampToPlay(spot), d > 0.9);
  else if (!moving && pet.state === 'idle' && Math.random() < 0.08) pet.sit();
}
// Track how you're walking (for walking side by side).
let walkSpeed = 0; const walkDir = new THREE.Vector3(0, 0, -1); const lastCam = new THREE.Vector3(); let haveLastCam = false;
function trackWalking(dt) {
  const cp = new THREE.Vector3(); camera.getWorldPosition(cp); cp.y = 0;
  if (!haveLastCam) { lastCam.copy(cp); haveLastCam = true; return; }
  const v = cp.clone().sub(lastCam); const sp = v.length() / Math.max(dt, 1e-3);
  walkSpeed += (sp - walkSpeed) * Math.min(1, dt * 4);
  if (v.lengthSq() > 1e-6 && sp > 0.15) walkDir.lerp(v.normalize(), Math.min(1, dt * 3)).normalize();
  lastCam.copy(cp);
}

/* ---------------- HUD ---------------- */
function setNames() { $('petName').textContent = look.name; document.querySelectorAll('.pn').forEach((e) => (e.textContent = look.name)); }
$('exitBtn').onclick = () => {
  stopListening(); clearThrown(); hideGame = null; $('arrow').hidden = true;
  if (mode === 'ar') { renderer.xr.getSession()?.end(); return; }
  if (mode === 'cam') stopCam();
  stopHideBuzz(); pet.setVisibility(1); placed = false; setWalk(false); setVoiceOnly(false);
  mode = 'create'; $('hud').hidden = true; $('create').hidden = false; pet.position.set(0, 0, 0); pet.state = 'idle'; pet.target = null;
  frameCamera('create');
};
$('goPlay').onclick = startPlay;
let xrOK = false;
$('goAR').onclick = () => (xrOK ? startAR() : startCam());
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
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ look, skills, needs, sick, at: Date.now() })); } catch {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } }

/* ---------------- main loop ---------------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min(0.05, clock.getDelta());
  if (mode === 'ar' && frame && hitSource) {
    const ref = renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitSource);
    reticle.visible = false;
    if (hits.length) {
      const pose = hits[0].getPose(ref);
      const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const up = new THREE.Vector3(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(m));
      if (up.y > 0.85) {
        const hp = new THREE.Vector3().setFromMatrixPosition(m);
        learnFloor(hp); learnTable(hp);
        if (!placed) {
          reticle.matrix.copy(m); reticle.visible = true;
          if (!reticle.seen) { reticle.seen = true; toast(`Found the floor! Tap to place ${look.name}`); }
        }
      }
    }
    updateOcclusion(frame);
  }
  const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);

  if (mode === 'create') {
    pet.rotation.y += dt * 0.5;
    pet.update(dt, null);
    controls.update();
  } else {
    if (mode === 'play') controls.update();
    if (mode === 'cam') applyOrientation();
    if (pet && pet.parent) {
      if (pet.popIn !== undefined && pet.popIn < 1) { pet.popIn = Math.min(1, pet.popIn + dt * 3); const s = 1 - Math.pow(1 - pet.popIn, 3) * 1; pet.scale.setScalar(Math.max(0.01, s * (1 + Math.sin(pet.popIn * Math.PI) * 0.15))); }
      pet.update(dt, camPos);
    }
    stepThrown(dt);
    checkFound();
    updateNeeds(dt); updateMeters(dt);
    trackWalking(dt);
    if (pet?.parent) {
      if (follow) updateFollow(dt); else { maybeRoam(dt); puppyQuirks(dt); }
      maybeCuddle(dt);
      if (pet.state !== 'leap') shadowCatcher.position.y = pet.position.y + 0.001;
    }
    if (bed && bed.pop !== undefined && bed.pop < 1) { bed.pop = Math.min(1, bed.pop + dt * 4); bed.scale.setScalar(Math.max(0.01, bed.pop)); }
    if (bowl && bowl.pop !== undefined && bowl.pop < 1) { bowl.pop = Math.min(1, bowl.pop + dt * 4); bowl.scale.setScalar(Math.max(0.01, bowl.pop)); }
    // Self-started mischief every so often.
    nextMischief -= dt;
    if (nextMischief < 0 && !stayMode && !wantsPat && pet && pet.parent && pet.state === 'idle' && !hideGame && !inHand && !sick && needs.energy > 30 && thrown.every((o) => !o.held) && (mode !== 'ar' || placed)) {
      armKnock();
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
  // Aim below the pet so it sits in the upper-middle of the screen, clear of the bottom panel.
  else { camera.position.set(0, 0.45, portrait ? 1.1 : 0.78); controls.target.set(0, portrait ? -0.14 : -0.06, 0.06); }
  controls.update();
}

/* ---------------- boot ---------------- */
frameCamera('create');
buildCreator();
refreshPet();
(async () => {
  xrOK = !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)));
  const hasCam = !!navigator.mediaDevices?.getUserMedia && isTouch;
  $('goAR').hidden = !(xrOK || hasCam);
  if (xrOK || hasCam) { $('goPlay').className = 'big alt'; $('goPlay').textContent = 'Play in the cartoon room'; }
  $('arNote').textContent = xrOK ? 'Full AR: your pet walks on your real floor and learns your room.'
    : hasCam ? 'Uses your camera. (Full AR needs Chrome + Google Play Services for AR.)'
    : 'Open this on your phone to bring your pet into your room.';
})();
