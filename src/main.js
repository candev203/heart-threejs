import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const canvas = document.querySelector('#heart-scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070b);
scene.fog = new THREE.FogExp2(0x05070b, 0.045);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0.52, 9.2);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,
  0.38,
  0.28,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const targetRotation = new THREE.Vector2();
const currentRotation = new THREE.Vector2();
const clock = new THREE.Clock();
const dragState = {
  isDragging: false,
  previousX: 0,
  previousY: 0,
  velocityX: 0,
  velocityY: 0,
};

const heartGroup = new THREE.Group();
scene.add(heartGroup);

const shape = new THREE.Shape();
shape.moveTo(0, -2.32);
shape.bezierCurveTo(-2.28, -0.86, -3.16, 0.2, -2.72, 1.28);
shape.bezierCurveTo(-2.28, 2.34, -0.92, 2.52, 0, 1.18);
shape.bezierCurveTo(0.92, 2.52, 2.28, 2.34, 2.72, 1.28);
shape.bezierCurveTo(3.16, 0.2, 2.28, -0.86, 0, -2.32);

const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: 0.62,
  bevelEnabled: true,
  bevelSegments: 18,
  bevelSize: 0.18,
  bevelThickness: 0.18,
  curveSegments: 48,
  steps: 2,
});
geometry.center();
geometry.scale(0.94, 0.94, 0.94);

const heartMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xff235b,
  emissive: 0x4b001f,
  emissiveIntensity: 0.42,
  roughness: 0.34,
  metalness: 0.08,
  clearcoat: 1,
  clearcoatRoughness: 0.18,
  transmission: 0.05,
  thickness: 1.4,
  ior: 1.45,
});

const heart = new THREE.Mesh(geometry, heartMaterial);
heart.castShadow = true;
heart.receiveShadow = true;
heartGroup.add(heart);

const innerGlow = new THREE.Mesh(
  geometry.clone().scale(1.06, 1.06, 1.06),
  new THREE.MeshBasicMaterial({
    color: 0xff2c72,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
heartGroup.add(innerGlow);

const rimGlow = new THREE.Mesh(
  geometry.clone().scale(1.19, 1.19, 1.19),
  new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      glowColor: { value: new THREE.Color(0xff5f91) },
      viewVector: { value: camera.position },
    },
    vertexShader: `
      uniform vec3 viewVector;
      varying float intensity;

      void main() {
        vec3 vNormal = normalize(normalMatrix * normal);
        vec3 vNormel = normalize(normalMatrix * viewVector);
        float rim = max(0.0, 0.72 - dot(vNormal, vNormel));
        intensity = pow(rim, 2.2);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying float intensity;

      void main() {
        gl_FragColor = vec4(glowColor, intensity * 0.42);
      }
    `,
  }),
);
heartGroup.add(rimGlow);

const sparkMaterial = new THREE.PointsMaterial({
  size: 0.045,
  color: 0xff9fbc,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
});

const sparkGeometry = new THREE.BufferGeometry();
const sparkCount = 980;
const sparkPositions = new Float32Array(sparkCount * 3);
const sparkData = [];

for (let i = 0; i < sparkCount; i += 1) {
  const radius = 2.35 + Math.random() * 3.1;
  const angle = Math.random() * Math.PI * 2;
  const height = (Math.random() - 0.5) * 5.1;
  const speed = 0.12 + Math.random() * 0.38;
  const drift = Math.random() * Math.PI * 2;

  sparkData.push({ radius, angle, height, speed, drift });
  sparkPositions[i * 3] = Math.cos(angle) * radius;
  sparkPositions[i * 3 + 1] = height;
  sparkPositions[i * 3 + 2] = Math.sin(angle) * radius;
}

sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
scene.add(sparks);

const haloGeometry = new THREE.RingGeometry(2.35, 2.42, 192);
const haloMaterial = new THREE.MeshBasicMaterial({
  color: 0xff406e,
  transparent: true,
  opacity: 0.18,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const halo = new THREE.Mesh(haloGeometry, haloMaterial);
halo.rotation.x = Math.PI * 0.52;
halo.position.y = -0.24;
scene.add(halo);

const backHalo = new THREE.Mesh(
  new THREE.CircleGeometry(2.15, 128),
  new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      colorA: { value: new THREE.Color(0xff0d57) },
      colorB: { value: new THREE.Color(0x5ce3ff) },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 colorA;
      uniform vec3 colorB;
      varying vec2 vUv;

      void main() {
        float d = distance(vUv, vec2(0.5));
        float ring = smoothstep(0.5, 0.12, d);
        float core = smoothstep(0.24, 0.02, d);
        vec3 color = mix(colorA, colorB, d * 1.55);
        gl_FragColor = vec4(color, (ring * 0.1 + core * 0.04) * (1.0 - d));
      }
    `,
  }),
);
backHalo.position.z = -0.92;
backHalo.scale.set(1.35, 1.35, 1);
heartGroup.add(backHalo);

const ambient = new THREE.HemisphereLight(0xffd3df, 0x162a45, 1.2);
scene.add(ambient);

const keyLight = new THREE.PointLight(0xff7a9b, 38, 18, 1.75);
keyLight.position.set(-2.8, 3.5, 4.4);
scene.add(keyLight);

const cyanLight = new THREE.PointLight(0x58d8ff, 16, 15, 1.9);
cyanLight.position.set(3.4, -1.3, 3.8);
scene.add(cyanLight);

const hotLight = new THREE.PointLight(0xff164f, 12, 13, 1.7);
hotLight.position.set(0, 0, 2.8);
scene.add(hotLight);

function updateCameraForViewport() {
  const width = window.innerWidth;
  const isPortrait = window.innerHeight > width;
  const isSmall = width < 760;

  camera.position.z = isPortrait ? 11.6 : 9.2;
  camera.position.y = isSmall ? 0.15 : 0.52;
  heartGroup.scale.setScalar(isSmall ? 0.54 : 1);
}

function handleResize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
  updateCameraForViewport();
}

function handlePointerMove(event) {
  if (!dragState.isDragging) {
    return;
  }

  const deltaX = event.clientX - dragState.previousX;
  const deltaY = event.clientY - dragState.previousY;

  dragState.previousX = event.clientX;
  dragState.previousY = event.clientY;
  dragState.velocityX = deltaX * 0.0038;
  dragState.velocityY = deltaY * 0.0038;

  targetRotation.y += dragState.velocityX;
  targetRotation.x += dragState.velocityY;
  targetRotation.x = THREE.MathUtils.clamp(targetRotation.x, -0.85, 0.85);
}

function handlePointerDown(event) {
  dragState.isDragging = true;
  dragState.previousX = event.clientX;
  dragState.previousY = event.clientY;
  dragState.velocityX = 0;
  dragState.velocityY = 0;
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerUp(event) {
  dragState.isDragging = false;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function animate() {
  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();
  const pulse = 1 + Math.sin(elapsed * 3.2) * 0.035 + Math.sin(elapsed * 5.4) * 0.012;

  if (!dragState.isDragging) {
    targetRotation.y += dragState.velocityX;
    targetRotation.x += dragState.velocityY;
    targetRotation.x = THREE.MathUtils.clamp(targetRotation.x, -0.85, 0.85);
    dragState.velocityX *= 0.92;
    dragState.velocityY *= 0.92;
  }

  currentRotation.x = THREE.MathUtils.lerp(currentRotation.x, targetRotation.x, 0.12);
  currentRotation.y = THREE.MathUtils.lerp(currentRotation.y, targetRotation.y, 0.12);

  heartGroup.rotation.x = currentRotation.x + Math.sin(elapsed * 0.58) * 0.035;
  heartGroup.rotation.y = currentRotation.y + Math.sin(elapsed * 0.32) * 0.12;
  heartGroup.rotation.z = Math.sin(elapsed * 0.5) * 0.018;
  heart.scale.setScalar(pulse);
  innerGlow.scale.setScalar(1.06 + (pulse - 1) * 1.8);
  rimGlow.scale.setScalar(1.17 + Math.sin(elapsed * 2.2) * 0.03);

  heartMaterial.emissiveIntensity = 0.38 + Math.sin(elapsed * 3.2) * 0.12;
  innerGlow.material.opacity = 0.055 + Math.sin(elapsed * 3.2) * 0.024;
  halo.rotation.z = elapsed * 0.16;
  halo.scale.setScalar(1 + Math.sin(elapsed * 2.1) * 0.045);
  halo.material.opacity = 0.14 + Math.sin(elapsed * 2.8) * 0.05;

  keyLight.position.x = Math.sin(elapsed * 0.5) * 2.2 - 1.4;
  cyanLight.position.x = Math.cos(elapsed * 0.46) * 3.2;
  hotLight.intensity = 12 + Math.sin(elapsed * 3.4) * 6;

  const positions = sparkGeometry.attributes.position.array;
  for (let i = 0; i < sparkCount; i += 1) {
    const item = sparkData[i];
    item.angle += item.speed * delta;
    const wave = Math.sin(elapsed * 1.2 + item.drift) * 0.28;
    positions[i * 3] = Math.cos(item.angle) * (item.radius + wave);
    positions[i * 3 + 1] = item.height + Math.sin(elapsed * 0.8 + item.drift) * 0.38;
    positions[i * 3 + 2] = Math.sin(item.angle) * (item.radius + wave);
  }
  sparkGeometry.attributes.position.needsUpdate = true;
  sparks.rotation.y = elapsed * 0.035;

  composer.render();
  requestAnimationFrame(animate);
}

window.addEventListener('resize', handleResize);
canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerUp);

updateCameraForViewport();
animate();
