import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GUI } from 'dat.gui'; // Import dat.GUI
// Import custom object creation functions
import { 
    createChair, createdesk, createaircon, 
    createflower, createframe, createdispenser, created_design1, 
    created_design2, created_design3, created_floor, created_hallchairs,
    created_cheaproom, created_fence, created_statue, created_ceiling,
    created_nearstatue 
  } from './js/objects.js';
  

  import { loadWall } from './js/design.js';
  

//================================================================
// Performance and Quality Settings
//================================================================
const PERFORMANCE_CONFIG = {
    shadows: true,
    particles: true,
    highQuality: window.innerWidth > 1200,
    maxParticles: window.innerWidth > 1200 ? 200 : 100
};

//================================================================
// Scene Setup with Enhanced Rendering
//================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e); // Default background color
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: PERFORMANCE_CONFIG.highQuality,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = PERFORMANCE_CONFIG.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.getElementById('webgl-container').appendChild(renderer.domElement);


const textureLoader = new THREE.TextureLoader();

//================================================================
// Enhanced Atmospheric System
//================================================================
class AtmosphericSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.initFog();
        this.initParticles();
        this.initAmbientEffects();
    }

    initFog() {
        let fogDensity = 0.008;
        let fogColor = new THREE.Color(0x2c2c54);
        this.scene.fog = new THREE.FogExp2(fogColor, fogDensity); // Exponential fog (color, density)
    }

    initParticles() {
        if (!PERFORMANCE_CONFIG.particles) return;

        const particleCount = PERFORMANCE_CONFIG.maxParticles;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 200;     // x
            positions[i + 1] = Math.random() * 50;          // y
            positions[i + 2] = (Math.random() - 0.5) * 200; // z
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.particles);
    }

    initAmbientEffects() {
        // Flickering lights effect
        this.flickerTimer = 0;
    }

    update(delta) {
        if (this.particles) {
            this.particles.rotation.y += delta * 0.1;
            
            // Animate particles
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 1; i < positions.length; i += 3) {
                positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.01;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }

        // Ambient light flickering
        this.flickerTimer += delta;
        if (this.flickerTimer > 0.1) {
            const flicker = 0.4 + Math.random() * 0.3;
            if (this.scene.children.find(child => child.type === 'AmbientLight')) {
                this.scene.children.find(child => child.type === 'AmbientLight').intensity = flicker;
            }
            this.flickerTimer = 0;
        }
    }
}

//================================================================
// Enhanced Lighting System
//================================================================
class LightingSystem {
    constructor(scene) {
        this.scene = scene;
        this.initLights();
    }

    initLights() {
        // Ambient light with dynamic intensity
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Soft ambient light
        this.scene.add(this.ambientLight);

        // Main directional light
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(-15.36, -50, 50);
        this.directionalLight.castShadow = PERFORMANCE_CONFIG.shadows;
        
        if (PERFORMANCE_CONFIG.shadows) {
            this.directionalLight.shadow.mapSize.width = 2048;
            this.directionalLight.shadow.mapSize.height = 2048;
            this.directionalLight.shadow.camera.near = 0.5;
            this.directionalLight.shadow.camera.far = 500;
        }
        
        this.scene.add(this.directionalLight);

        // Point lights for atmosphere
        this.createPointLights();
    }

    createPointLights() {
        const lightPositions = [
            { x: 20, y: 15, z: 20, color: 0xff4444, intensity: 0.5 },
            { x: -30, y: 10, z: -30, color: 0x4444ff, intensity: 0.3 },
            { x: 40, y: 12, z: -20, color: 0x44ff44, intensity: 0.4 }
        ];

        lightPositions.forEach(lightData => {
            const pointLight = new THREE.PointLight(lightData.color, lightData.intensity, 30);
            pointLight.position.set(lightData.x, lightData.y, lightData.z);
            if (PERFORMANCE_CONFIG.shadows) {
                pointLight.castShadow = true;
                pointLight.shadow.mapSize.width = 512;
                pointLight.shadow.mapSize.height = 512;
            }
            this.scene.add(pointLight);
        });
    }
}

//================================================================
// Optimized Wall System
//================================================================
class WallSystem {
    constructor(scene, textureLoader) {
        this.scene = scene;
        this.textureLoader = textureLoader;
        this.wallBoundingBoxes = [];
        this.initWalls();
    }

    createWall(geometry, position, rotation = { x: 0, y: 0, z: 0 }, texturePath = '/images/texture/tile.jpg') {
        const texture = this.textureLoader.load(texturePath);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(30, 10); // Scale texture to fit

        const material = new THREE.MeshStandardMaterial({ 
            map: texture, 
            side: THREE.DoubleSide, 
            roughness: 0.3, 
            metalness: 0.1
        });
        
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(position.x, position.y, position.z);
        wall.rotation.set(rotation.x, rotation.y, rotation.z);
        
        if (PERFORMANCE_CONFIG.shadows) {
            wall.castShadow = true;
            wall.receiveShadow = true;
        }
        
        this.scene.add(wall);
        
        const box = new THREE.Box3().setFromObject(wall);
        this.wallBoundingBoxes.push(box);
        
        return wall;
    }

    initWalls() {
        const wallConfigs = [
            // Main walls
            { geometry: new THREE.BoxGeometry(100, 40, 1), position: { x: 0, y: 0, z: -50 } },
            { geometry: new THREE.BoxGeometry(100, 40, 1), position: { x: 0, y: 0, z: 50 } },
            { geometry: new THREE.BoxGeometry(1, 40, 100), position: { x: -52, y: 2, z: -1 } },
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 50, y: 0, z: 0 } },
            
            // Interior walls
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 45, y: 10, z: 25 } },
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 20, y: 10, z: 30 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } },
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 24, y: 10, z: 33.6 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } },
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 24, y: 10, z: 50 }, rotation: { x: 0, y: Math.PI, z: 0 } },
            
            // Ceiling and floors
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 0, y: 22, z: 0 }, rotation: { x: Math.PI / 2, y: 0, z: 0 } },
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 0, y: 0, z: 0 }, rotation: { x: -Math.PI / 2, y: 0, z: 0 } },
            { geometry: new THREE.BoxGeometry(40, 35, 1), position: { x: 24, y: 22, z: 25 }, rotation: { x: Math.PI / 2, y: 0, z: 0 } }
        ];

        wallConfigs.forEach(config => {
            this.createWall(config.geometry, config.position, config.rotation);
        });

        // Special carpet floor
        this.createCarpet();
    }

    createCarpet() {
        const carpetTexture = this.textureLoader.load('/images/texture/carpet2.jpg');
        carpetTexture.wrapS = THREE.RepeatWrapping;
        carpetTexture.wrapT = THREE.RepeatWrapping;
        carpetTexture.repeat.set(10, 10); // Adjust the repeat scale for the carpet texture

        const carpetMaterial = new THREE.MeshStandardMaterial({
            map: carpetTexture,
            side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.1
        });

        const carpet = new THREE.Mesh(new THREE.BoxGeometry(40, 35, 1), carpetMaterial);
        carpet.position.set(24, 0, 25); // Position (x, y, z)
        carpet.rotation.x = -Math.PI / 2; // Rotate to place it on the floor
        if (PERFORMANCE_CONFIG.shadows) {
            carpet.receiveShadow = true;
        }
        this.scene.add(carpet);
    }
}

//================================================================
// Enhanced Zombie AI System
//================================================================
class ZombieAI {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.zombie = null;
        this.state = 'patrol'; // patrol, chase, attack, stunned
        this.patrolPoints = [
            new THREE.Vector3(-20, 0, -20),
            new THREE.Vector3(30, 0, 30),
            new THREE.Vector3(-30, 0, 40),
            new THREE.Vector3(40, 0, -30)
        ];
        this.currentPatrolIndex = 0;
        this.speed = 0.02;
        this.detectionRange = 50;
        this.attackRange = 3;
        this.lastAttackTime = 0;
        this.stunDuration = 0;
        
        this.loadZombie();
    }

    loadZombie() {
        const loader = new GLTFLoader();
        loader.load('/images/models/zombie_monster_slasher_necromorph.glb', (gltf) => {
            this.zombie = gltf.scene;
            this.zombie.scale.set(5, 5, 5);
            this.zombie.position.copy(this.patrolPoints[0]);
            
            if (PERFORMANCE_CONFIG.shadows) {
                this.zombie.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            }
            
            this.scene.add(this.zombie);
        });
    }

    update(delta) {
        if (!this.zombie) return;

        const playerPosition = this.camera.position;
        const zombiePosition = this.zombie.position;
        const distanceToPlayer = playerPosition.distanceTo(zombiePosition);

        // Update state based on distance
        if (this.stunDuration > 0) {
            this.stunDuration -= delta;
            this.state = 'stunned';
        } else if (distanceToPlayer < this.attackRange) {
            this.state = 'attack';
        } else if (distanceToPlayer < this.detectionRange) {
            this.state = 'chase';
        } else {
            this.state = 'patrol';
        }

        switch (this.state) {
            case 'patrol':
                this.patrol();
                break;
            case 'chase':
                this.chase(playerPosition, delta);
                break;
            case 'attack':
                this.attack();
                break;
            case 'stunned':
                // Do nothing, zombie is stunned
                break;
        }

        // Add subtle idle animation
        zombiePosition.y = Math.sin(Date.now() * 0.002) * 0.2;
    }

    patrol() {
        const targetPatrol = this.patrolPoints[this.currentPatrolIndex];
        const direction = new THREE.Vector3();
        direction.subVectors(targetPatrol, this.zombie.position).normalize();
        
        this.zombie.position.addScaledVector(direction, this.speed * 0.5);
        this.zombie.lookAt(targetPatrol);

        if (this.zombie.position.distanceTo(targetPatrol) < 2) {
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        }
    }

    chase(playerPosition, delta) {
        const direction = new THREE.Vector3();
        direction.subVectors(playerPosition, this.zombie.position).normalize();
        this.zombie.position.addScaledVector(direction, this.speed * 1.5);
        this.zombie.lookAt(playerPosition);

        // Add erratic movement
        this.zombie.position.x += Math.sin(Date.now() * 0.005) * 0.5;
        this.zombie.position.z += Math.cos(Date.now() * 0.005) * 0.5;
    }

    attack() {
        const currentTime = Date.now();
        if (currentTime - this.lastAttackTime > 2000) { // Attack every 2 seconds
            this.lastAttackTime = currentTime;
            // Trigger damage effect
            this.triggerDamageEffect();
        }
    }

    triggerDamageEffect() {
        const damageOverlay = document.getElementById('damage-overlay');
        if (damageOverlay) {
            damageOverlay.style.opacity = '0.6';
            setTimeout(() => {
                damageOverlay.style.opacity = '0';
            }, 200);
        }
    }
}

//================================================================
// Audio Management System
//================================================================
class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.audioContext = null;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    loadSound(name, url, volume = 1, loop = false) {
        const audio = new Audio(url);
        audio.volume = volume;
        audio.loop = loop;
        this.sounds.set(name, audio);
        return audio;
    }

    playSound(name) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.warn('Failed to play sound:', e));
        }
    }

    stopSound(name) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    }
}

//================================================================
// Initialize Systems
//================================================================
const atmosphericSystem = new AtmosphericSystem(scene);
const lightingSystem = new LightingSystem(scene);
const wallSystem = new WallSystem(scene, textureLoader);
const audioManager = new AudioManager();

// Load ambient sounds
audioManager.loadSound('ambient', '/sounds/Free Horror Ambience (Dark Project).mp3', 0.3, true);
audioManager.loadSound('footsteps', '/sounds/Sound Effects - Walking on Tile Floor.mp3', 0.5, true);

// Initialize camera position
camera.position.set(37, 6, 11); // Set camera position


// FPSControls class (integrated from your provided code)
class FPSControls {
  constructor(camera, scene) {
      this.camera = camera;
      this.scene = scene;
      this.pointerLockControls = new PointerLockControls(camera, document.body);

      scene.add(this.pointerLockControls.getObject()); // Use getObject()

      document.addEventListener('click', () => this.pointerLockControls.lock());

      this.velocity = new THREE.Vector3(0, 0, 0);
      this.acceleration = new THREE.Vector3(250, 2130, 250);
      this.deceleration = new THREE.Vector3(-10, -55, -10);
      this.move = { forward: false, backward: false, left: false, right: false };
      this.isStanding = true;
      this.isEditMode = false; // Track whether we are in edit mode


      // Initialize Audio Listener and Sounds
      this.listener = new THREE.AudioListener();
      this.camera.add(this.listener); // Attach the listener to the camera
  
      
      // First walking sound
      this.walkSound = new THREE.Audio(this.listener);
      const audioLoader = new THREE.AudioLoader();
      audioLoader.load('/sounds/Sound Effects - Walking on Tile Floor.mp3', (buffer) => {
        this.walkSound.setBuffer(buffer);
        this.walkSound.setLoop(true); // Set to loop if desired
        this.walkSound.setVolume(0.5); // Adjust volume as needed
      });
  
      // Second walking sound
      this.secondWalkSound = new THREE.Audio(this.listener);
      audioLoader.load('/sounds/Walking Through Water Sound Effect.mp3', (buffer) => {
        this.secondWalkSound.setBuffer(buffer);
        this.secondWalkSound.setLoop(true);
        this.secondWalkSound.setVolume(0.5); // Adjust volume as needed
      });
  

      document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
      document.addEventListener('keyup', (e) => this._onKeyUp(e), false);

       // Add event listener for the "Enter First Person Mode" button
    const firstPersonBtn = document.getElementById('firstPersonBtn');
    firstPersonBtn.addEventListener('click', () => this.enterFirstPersonMode());

    // Add event listener for the "Enter Edit Mode" button
    const editModeBtn = document.getElementById('editModeBtn');
    editModeBtn.addEventListener('click', () => this.enterEditMode());

    // Add a scroll wheel listener to handle zoom only in edit mode
    document.addEventListener('wheel', (event) => this.handleScroll(event), { passive: false });
     // Create the target marker in the game
     this.createTargetMarker();
  }

  createTargetMarker() {
    const targetPosition = new THREE.Vector3(-61, 4, -40); // The target position
  
    // Create a small sphere to act as the marker
    const geometry = new THREE.SphereGeometry(0.2, 32, 32); // Small sphere with radius 0.2
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,      // Red color
      transparent: true,    // Enable transparency
      opacity: 0.0         // Set the opacity to 50% (you can adjust this value)
    });
    const marker = new THREE.Mesh(geometry, material);
  
    // Set the marker's position to the target position
    marker.position.copy(targetPosition);
  
    // Add the marker to the scene
    this.scene.add(marker);
  }


  enterFirstPersonMode() {
    // Activates pointer lock controls when the button is clicked
    this.pointerLockControls.lock(); // This will activate the pointer lock
    this.isEditMode = false; // Disable edit mode when entering first-person view
  }

  enterEditMode() {
    this.isEditMode = true; // Enable edit mode (fly mode)
    this.velocity.set(0, 0, 0); // Reset velocity
  }
  handleScroll(event) {
    // Disable zoom on scroll in both modes
    event.preventDefault(); // Prevent the page from scrolling
  }

  _onKeyDown(event) {
    switch (event.code) {
      case 'KeyW': this.move.forward = true; break;
      case 'KeyS': this.move.backward = true; break;
      case 'KeyA': this.move.left = true; break;
      case 'KeyD': this.move.right = true; break;
      case 'Space': // Jump (move up in Edit Mode)
        if (this.isEditMode) {
          this.move.up = true;
        } else if (this.isStanding) {
          this.velocity.y += 15; // Adjust jump height as needed
          this.isStanding = false;
        }
        break;
      case 'ShiftLeft': // Move down in Edit Mode
        if (this.isEditMode) {
          this.move.down = true;
        }
        break;
    }
  }





  _onKeyUp(event) {
      switch (event.code) {
          case 'KeyW': this.move.forward = false; break;
          case 'KeyS': this.move.backward = false; break;
          case 'KeyA': this.move.left = false; break;
          case 'KeyD': this.move.right = false; break;
          case 'Space': break;
      }
  }

  update(delta) {
    const speedMultiplier = 1; // Adjust speed multiplier here
    const frameDeceleration = new THREE.Vector3(
        this.velocity.x * this.deceleration.x,
        this.deceleration.y,
        this.velocity.z * this.deceleration.z
    );
    frameDeceleration.multiplyScalar(delta);
    this.velocity.add(frameDeceleration);

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    const forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const right = new THREE.Vector3().crossVectors(this.camera.up, forward).normalize();

    if (this.move.forward) this.velocity.addScaledVector(forward, this.acceleration.z * delta);
    if (this.move.backward) this.velocity.addScaledVector(forward, -this.acceleration.z * delta);
    if (this.move.left) this.velocity.addScaledVector(right, this.acceleration.x * delta);
    if (this.move.right) this.velocity.addScaledVector(right, -this.acceleration.x * delta);

    // Create a bounding box for the character
    const characterBox = new THREE.Box3().setFromCenterAndSize(
        this.pointerLockControls.getObject().position,
        new THREE.Vector3(1, 1.8, 1) // Adjust size based on your character's dimensions
    );
    

    // Check for collisions with walls
    for (const wallBox of wallSystem.wallBoundingBoxes) {
        if (characterBox.intersectsBox(wallBox)) {
            // Collision detected, revert position
            this.pointerLockControls.getObject().position.sub(this.velocity.clone().multiplyScalar(delta));
            this.velocity.set(0, 0, 0); // Stop movement
            break; // Exit loop after collision
        }
    }

    
    // Update camera position
    const position = this.pointerLockControls.getObject().position;
    position.addScaledVector(this.velocity, delta);

    // Apply gravity
    if (position.y < 5) {
        this.velocity.y = 0;
        position.y = 5;
        this.isStanding = true;
    }
}
}

// Instantiate FPSControls
const controls = new FPSControls(camera, scene);

// Initialize Enhanced Zombie AI
const zombieAI = new ZombieAI(scene, camera);

//================================================================
// GUI Setup with Better Organization
//================================================================
const gui = new GUI();
gui.domElement.style.zIndex = '1000';

// Lighting controls
const lightFolder = gui.addFolder('Lighting');
lightFolder.add(lightingSystem.ambientLight, 'intensity', 0, 2).name('Ambient Light');
lightFolder.add(lightingSystem.directionalLight, 'intensity', 0, 2).name('Directional Light');

// Atmosphere controls
const atmosphereFolder = gui.addFolder('Atmosphere');
atmosphereFolder.add(scene.fog, 'density', 0, 0.05).name('Fog Density');

// Performance controls
const performanceFolder = gui.addFolder('Performance');
performanceFolder.add(PERFORMANCE_CONFIG, 'shadows').name('Shadows').onChange((value) => {
    renderer.shadowMap.enabled = value;
});

// Fog Controls
const fogFolder = gui.addFolder('Fog');
const fogIntensityControl = fogFolder.add({ fogDensity: fogDensity }, 'fogDensity', 0, 0.1).name('Fog Density').onChange((value) => {
  scene.fog.density = value;
});

const fogColorControl = fogFolder.addColor({ fogColor: fogColor.getHex() }, 'fogColor').name('Fog Color').onChange((value) => {
  scene.fog.color.set(value);
});

//================================================================
// Initialize the GUI
//================================================================
lightFolder.open(); // Open the lighting folder
lightDirectionFolder.open(); // Open the light direction folder
fogFolder.open(); // Open the fog folder


// Animation loop
function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Limit frame rate for performance
    if (deltaTime < 16.67) return; // ~60fps cap

    const delta = clock.getDelta();

    // Update systems
    atmosphericSystem.update(delta);
    zombieAI.update(delta);

    if (controls && controls.pointerLockControls && controls.pointerLockControls.isLocked) {
        controls.update(delta);
    }

    renderer.render(scene, camera);
}

const clock = new THREE.Clock();
let lastTime = 0;

//================================================================
// Performance Monitoring
//================================================================
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
    }

    update() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            // Auto-adjust quality based on FPS
            if (this.fps < 30 && PERFORMANCE_CONFIG.particles) {
                PERFORMANCE_CONFIG.particles = false;
                console.log('Performance: Disabled particles');
            }
        }
    }
}

const performanceMonitor = new PerformanceMonitor();

//================================================================
// Enhanced Animation Loop with Performance Monitoring
//================================================================
function enhancedAnimate() {
    requestAnimationFrame(enhancedAnimate);
    
    performanceMonitor.update();
    
    const delta = clock.getDelta();
    
    atmosphericSystem.update(delta);
    zombieAI.update(delta);

    if (controls && controls.pointerLockControls && controls.pointerLockControls.isLocked) {
        controls.update(delta);
    }

    renderer.render(scene, camera);
}

//================================================================
// Window Resize Handler
//================================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the enhanced animation loop
enhancedAnimate();

// Load zombie model
const loader = new GLTFLoader();
let zombie;
loader.load('/images/models/zombie_monster_slasher_necromorph.glb', (gltf) => {
    zombie = gltf.scene;
    zombie.scale.set(5, 5, 5);
    zombie.position.set(-20, 0, -20);
    zombie.castShadow = true;
    scene.add(zombie);
});

// Zombie movement (unchanged)
function updateZombie() {
    if (zombie) {
        const playerPosition = camera.position;
        const zombiePosition = zombie.position;
        const distanceToPlayer = playerPosition.distanceTo(zombiePosition);

        if (distanceToPlayer < 50) { // Simple chase behavior
            const direction = new THREE.Vector3();
            direction.subVectors(playerPosition, zombiePosition).normalize();
            zombie.position.addScaledVector(direction, 0.02); // Adjust zombie speed
        }
    }
}