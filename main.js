import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { FPSControls } from './FPSControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

// Near other global declarations like scene, camera, renderer
let waterMesh;
let waterNormalTexture;
let composer;
let hidingSpots = [];
let flickeringMaterials = [];
let floatingDebrisArray = [];

const messages = [
    "The water keeps rising... I saw something in the generator room. It wasn't human. Power's out down there. Don't go. -J",
    "Tried the main stairs... blocked. Found some kind of key in security. Maybe it's for the exit door on this level? God, I hope so. The growling is getting closer."
];
let messageBottles = []; // To store bottle meshes for animation

//================================================================
// Scene Setup - Ensure Basic Functionality First
//================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2c3e50); // Dark blue-gray background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;

const container = document.getElementById('webgl-container');
if (container) {
    container.appendChild(renderer.domElement);
} else {
    document.body.appendChild(renderer.domElement);
}

// Post-processing Composer Setup
composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const vignettePass = new ShaderPass(VignetteShader);
// vignettePass.uniforms['offset'].value = 0.95; // Optional: Adjust vignette intensity
// vignettePass.uniforms['darkness'].value = 1.5;  // Optional: Adjust vignette darkness
composer.addPass(vignettePass);

// Initialize camera position
camera.position.set(37, 6, 11);

//================================================================
// Basic Lighting Setup - Essential for Visibility
//================================================================
// Strong ambient light to ensure visibility
const ambientLight = new THREE.AmbientLight(0x404040, 0.7); // New intensity
scene.add(ambientLight);

// Main directional light
const directionalLight = new THREE.DirectionalLight(0xEEF2FF, 1.4); // New color and intensity
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

// Additional point lights for better illumination
const pointLight1 = new THREE.PointLight(0xffffff, 0.6, 50); // New intensity
pointLight1.position.set(20, 15, 20);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xffffff, 0.4, 40); // New intensity
pointLight2.position.set(-20, 12, -20);
scene.add(pointLight2);

//================================================================
// Basic Floor and Test Objects - Ensure Something is Visible
//================================================================
// Large visible floor
const floorGeometry = new THREE.PlaneGeometry(200, 200);
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// Test cubes to ensure scene is working
const testGeometry = new THREE.BoxGeometry(2, 2, 2);
const testMaterial1 = new THREE.MeshLambertMaterial({ color: 0xff0000 });
const testCube1 = new THREE.Mesh(testGeometry, testMaterial1);
testCube1.position.set(40, 1, 10);
testCube1.castShadow = true;
scene.add(testCube1);

const testMaterial2 = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
const testCube2 = new THREE.Mesh(testGeometry, testMaterial2);
testCube2.position.set(35, 1, 15);
testCube2.castShadow = true;
scene.add(testCube2);

const testMaterial3 = new THREE.MeshLambertMaterial({ color: 0x0000ff });
const testCube3 = new THREE.Mesh(testGeometry, testMaterial3);
testCube3.position.set(42, 1, 5);
testCube3.castShadow = true;
scene.add(testCube3);

// Basic walls for reference
const wallGeometry = new THREE.BoxGeometry(50, 20, 1);
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });

const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
wall1.position.set(0, 10, -25);
wall1.receiveShadow = true;
scene.add(wall1);

const wall2 = new THREE.Mesh(wallGeometry, wallMaterial);
wall2.position.set(0, 10, 25);
wall2.receiveShadow = true;
scene.add(wall2);

//================================================================
// Initialize Controls
//================================================================
let controls;
try {
    controls = new FPSControls(camera, scene, new PointerLockControls(camera, document.body));
} catch (error) {
    console.warn('Failed to initialize FPSControls:', error);
    // Fallback basic controls
    const basicControls = new PointerLockControls(camera, document.body);
    scene.add(basicControls.getObject());
    document.addEventListener('click', () => basicControls.lock());
    controls = { pointerLockControls: basicControls, update: () => {} };
}

//================================================================
// Water Plane
//================================================================
function initWater() {
    const waterGeometry = new THREE.PlaneGeometry(200, 200); // Large plane

    // Attempt to load a water normal map
    const textureLoader = new THREE.TextureLoader();
    waterNormalTexture = textureLoader.load(
        '/images/texture/water_normals.jpg', // Assumed path for a water normal texture
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(5, 5); // How many times the texture repeats
            if (waterMesh) {
                waterMesh.material.normalMap = texture;
                waterMesh.material.normalScale = new THREE.Vector2(0.3, 0.3); // Example normal scale
                waterMesh.material.needsUpdate = true;
            }
        },
        undefined,
        (error) => {
            console.warn('Water normal texture not found at /images/texture/water_normals.jpg. Using flat water material.');
            // No need to do anything else, material will just not have a normal map
        }
    );

    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x006699, // Bluish water color
        opacity: 0.75,
        transparent: true,
        metalness: 0.2,
        roughness: 0.1,
        // normalMap will be set above if texture loads
    });

    waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2; // Lay it flat
    waterMesh.position.y = gameState.floodLevel; // Initial position
    scene.add(waterMesh);
}

//================================================================
// Hiding Spots
//================================================================
function initHidingSpots() {
    // Example Spot 1: Could be under a large desk or in a dark corner
    const spot1Min = new THREE.Vector3(35, 0, 5); // Assuming player height is around 2-3 units
    const spot1Max = new THREE.Vector3(38, 3, 8); // Approx 3x3x3 box
    const hidingSpot1 = new THREE.Box3(spot1Min, spot1Max);
    hidingSpots.push(hidingSpot1);

    // Example Spot 2: Another area, perhaps a cubicle corner
    const spot2Min = new THREE.Vector3(-10, 0, -15);
    const spot2Max = new THREE.Vector3(-12, 3, -12);
    const hidingSpot2 = new THREE.Box3(spot2Min, spot2Max);
    hidingSpots.push(hidingSpot2);

    // Make hidingSpots globally accessible
    window.hidingSpots = hidingSpots;

    // For debugging, you can visualize these boxes (optional, but good for development)
    /*
    hidingSpots.forEach(spot => {
        const helper = new THREE.Box3Helper(spot, 0xffff00); // Yellow color
        scene.add(helper);
    });
    */
}

//================================================================
// Message Bottles
//================================================================
function initMessageBottles() {
    const bottleMaterial = new THREE.MeshStandardMaterial({ color: 0x6c81a0, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.8 });
    const bottleRadius = 0.15;
    const bottleHeight = 0.5;
    const bottleGeometry = new THREE.CylinderGeometry(bottleRadius, bottleRadius * 0.8, bottleHeight, 16);

    const positions = [
        new THREE.Vector3(10, 0, 10), // Placeholder position 1
        new THREE.Vector3(-5, 0, -8)  // Placeholder position 2
    ];

    for (let i = 0; i < positions.length; i++) {
        if (i >= messages.length) break; // Don't create more bottles than messages

        const bottleMesh = new THREE.Mesh(bottleGeometry, bottleMaterial.clone()); // Clone material
        bottleMesh.position.copy(positions[i]);
        bottleMesh.userData = {
            type: 'messageBottle',
            messageId: i,
            isInteractable: true, // Use this to differentiate from 'interactable' on key/door
            baseY: bottleMesh.position.y,
            bobOffset: Math.random() * Math.PI * 2
        };
        bottleMesh.name = `messageBottle_${i}`;
        scene.add(bottleMesh);
        if (interactionSystem && interactionSystem.interactables) {
            interactionSystem.interactables.push(bottleMesh);
        }
        messageBottles.push(bottleMesh);
    }
}

function displayMessage(messageId) {
    const overlay = document.getElementById('message-overlay');
    const textElement = document.getElementById('message-text');
    const closeBtn = document.getElementById('close-message-btn');

    if (overlay && textElement && closeBtn && messages[messageId] !== undefined) {
        textElement.textContent = messages[messageId];
        overlay.style.display = 'flex'; // Show overlay

        // Temporarily disable FPS controls
        if (controls && controls.pointerLockControls) {
            controls.pointerLockControls.unlock(); // Unlock to interact with button
        }

        const closeMessageHandler = () => {
            overlay.style.display = 'none';
            closeBtn.removeEventListener('click', closeMessageHandler);
        };
        closeBtn.addEventListener('click', closeMessageHandler, { once: true });
    }
}

//================================================================
// Floating Debris
//================================================================
function initFloatingDebris() {
    const debrisCount = 20;
    const debrisMaterial = new THREE.MeshStandardMaterial({
        color: 0x5C4033, // Dark brownish color
        roughness: 0.8,
        metalness: 0.1
    });

    for (let i = 0; i < debrisCount; i++) {
        const width = 0.1 + Math.random() * 0.4; // Random width between 0.1 and 0.5
        const height = 0.02 + Math.random() * 0.08; // Random height (thickness)
        const depth = 0.1 + Math.random() * 0.4;  // Random depth
        const debrisGeometry = new THREE.BoxGeometry(width, height, depth);

        const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);

        // Distribute randomly within a range, e.g., -30 to 30 on X and Z
        debris.position.x = (Math.random() - 0.5) * 60;
        debris.position.z = (Math.random() - 0.5) * 60;
        // Y position will be set dynamically in animate loop

        debris.userData = {
            bobOffset: Math.random() * Math.PI * 2,
            driftSpeedX: (Math.random() - 0.5) * 0.002, // Slow drift
            driftSpeedZ: (Math.random() - 0.5) * 0.002,
            rotationSpeedX: (Math.random() - 0.5) * 0.001,
            rotationSpeedY: (Math.random() - 0.5) * 0.001,
            rotationSpeedZ: (Math.random() - 0.5) * 0.001
        };

        scene.add(debris);
        floatingDebrisArray.push(debris);
    }
    // console.log(`Initialized ${debrisCount} floating debris objects.`);
}


//================================================================
// Game State Management System
//================================================================
class GameStateManager {
    constructor() {
        this.currentState = 'playing'; // playing, paused, gameOver, victory
        this.gameTime = 0;
        this.playerHealth = 100;
        this.hasKey = false;
        this.objectives = {
            findKey: false,
            reachExit: false, // This might become redundant or re-purposed
            surviveFlood: false,
            doorUnlocked: false // New flag
        };
        this.floodLevel = 0;
        this.maxFloodLevel = 15;
        this.floodSpeed = 0.05; // Increased speed
        this.ambientIntensity = 1.0;
        this.lastHeartbeat = 0;
    }

    updateFlood(delta) {
        if (this.currentState === 'playing') {
            this.floodLevel = Math.min(this.floodLevel + this.floodSpeed * delta, this.maxFloodLevel);
            
            // Increase ambient intensity as flood rises
            this.ambientIntensity = 1.0 + (this.floodLevel / 15) * 0.5;
        }
    }

    takeDamage(amount) {
        this.playerHealth = Math.max(0, this.playerHealth - amount);
        if (this.playerHealth <= 0) {
            this.currentState = 'gameOver';
        }
        
        // Trigger heartbeat effect when health is low
        if (this.playerHealth < 30) {
            this.triggerHeartbeat();
        }
        
        return this.playerHealth;
    }

    triggerHeartbeat() {
        const currentTime = Date.now();
        if (currentTime - this.lastHeartbeat > 2000) {
            this.lastHeartbeat = currentTime;
            // Play heartbeat sound and visual effect
            this.createHeartbeatEffect();
        }
    }

    createHeartbeatEffect() {
        const heartbeatOverlay = document.createElement('div');
        heartbeatOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(circle, rgba(255,0,0,0.3) 0%, transparent 70%);
            pointer-events: none; z-index: 10;
            animation: heartbeat 0.6s ease-out;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes heartbeat {
                0%, 100% { opacity: 0; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.02); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(heartbeatOverlay);
        
        setTimeout(() => {
            if (document.body.contains(heartbeatOverlay)) {
                document.body.removeChild(heartbeatOverlay);
            }
        }, 600);
    }

    collectKey() {
        this.hasKey = true;
        this.objectives.findKey = true;
    }
}

const gameState = new GameStateManager();

//================================================================
// Basic Particle System
//================================================================
class BasicParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.initBasicParticles();
    }

    initBasicParticles() {
        try {
            const particleCount = 500;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount * 3; i += 3) {
                positions[i] = (Math.random() - 0.5) * 100;     // x
                positions[i + 1] = Math.random() * 50;          // y
                positions[i + 2] = (Math.random() - 0.5) * 100; // z
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const material = new THREE.PointsMaterial({
                color: 0x87CEEB,
                size: 0.2,
                transparent: true,
                opacity: 0.6
            });

            this.particles = new THREE.Points(geometry, material);
            this.scene.add(this.particles);
        } catch (error) {
            console.warn('Failed to create particles:', error);
        }
    }

    update(delta) {
        if (this.particles) {
            this.particles.rotation.y += delta * 0.1;
        }
    }
}

const particleSystem = new BasicParticleSystem(scene);

//================================================================
// Basic Zombie AI
//================================================================
class BasicZombieAI {
    constructor(scene, camera, fpsControls) { // Added fpsControls
        this.scene = scene;
        this.camera = camera;
        this.fpsControls = fpsControls; // Store it
        this.zombie = null;
        this.raycaster = new THREE.Raycaster(); // From previous step

        this.state = 'PATROL'; // Initial state: PATROL, CHASING, SEARCHING_LKL
        this.speed = 0.02; // Base speed
        this.chaseSpeed = 0.035; // Slightly faster when chasing
        this.detectionRange = 30; // Main awareness/LOS check radius
        this.attackRange = 3;
        this.lastAttackTime = 0;

        this.lastKnownPlayerPosition = null;
        this.timeSpentSearching = 0;
        this.searchDuration = 10; // Seconds to search at LKL
        this.patrolWaypoints = [ // Example waypoints if we add patrolling later
            // new THREE.Vector3(-20, 0, -20),
            // new THREE.Vector3(20, 0, -20),
        ];
        this.currentWaypointIndex = 0;
        
        this.loadZombie();
    }

    hasLineOfSightToPlayer(currentEffectiveRange) { // Added currentEffectiveRange parameter
        if (!this.zombie || !this.camera || !this.scene) return false;

        const zombieEyePosition = new THREE.Vector3();
        // Assuming this.zombie is the group/object whose position is set.
        // The zombie's base Y is often its feet. Its height might be around 1.8 units * scale.
        zombieEyePosition.copy(this.zombie.position);
        const eyeHeightOffset = 1.6 * this.zombie.scale.y * 0.9; // Approx 90% of a 1.6 unit model height, scaled
        zombieEyePosition.y += eyeHeightOffset;

        const playerPosition = this.camera.position.clone();
        const directionToPlayer = new THREE.Vector3().subVectors(playerPosition, zombieEyePosition).normalize();

        this.raycaster.set(zombieEyePosition, directionToPlayer);
        this.raycaster.near = 0.5; // Increased near to avoid hitting parts of zombie model itself easily
        this.raycaster.far = currentEffectiveRange + 5; // Use currentEffectiveRange

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Filter out intersections with the zombie itself or other non-collidable objects
        let firstValidHit = null;
        for (const intersect of intersects) {
            let currentObject = intersect.object;
            let isSelf = false;
            while (currentObject) {
                if (currentObject === this.zombie) {
                    isSelf = true;
                    break;
                }
                // Add other potential non-collidable checks here
                if (currentObject === waterMesh || (particleSystem && currentObject === particleSystem.particles)) {
                    isSelf = true; // Treat as transparent for LOS
                    break;
                }
                currentObject = currentObject.parent;
            }
            if (!isSelf) {
                firstValidHit = intersect;
                break;
            }
        }

        if (firstValidHit) {
            const distanceToPlayerActual = zombieEyePosition.distanceTo(playerPosition);
            if (firstValidHit.distance > distanceToPlayerActual - 0.5) {
                return true;
            }
            // Optional: console.log("LOS blocked by:", firstValidHit.object.name || firstValidHit.object.uuid, "at distance", firstValidHit.distance, "player at", distanceToPlayerActual);
            return false;
        }

        return true;
    }

    loadZombie() {
        try {
            const loader = new GLTFLoader();
            loader.load('/images/models/zombie_monster_slasher_necromorph.glb', 
                (gltf) => {
                    this.zombie = gltf.scene;
                    this.zombie.scale.set(4, 4, 4);
                    this.zombie.position.set(-20, 0, -20);
                    
                    this.zombie.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    this.scene.add(this.zombie);
                },
                undefined,
                (error) => {
                    console.warn('Failed to load zombie model:', error);
                    // Create a simple cube as fallback
                    const zombieGeometry = new THREE.BoxGeometry(2, 4, 2);
                    const zombieMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
                    this.zombie = new THREE.Mesh(zombieGeometry, zombieMaterial);
                    this.zombie.position.set(-20, 2, -20);
                    this.scene.add(this.zombie);
                }
            );
        } catch (error) {
            console.warn('Error in zombie loading:', error);
        }
    }

    update(delta) {
        if (!this.zombie || !this.camera || !this.fpsControls) return;

        const playerPosition = this.camera.position;
        const zombiePosition = this.zombie.position;
        const distanceToPlayer = playerPosition.distanceTo(zombiePosition);

        const playerIsHiding = this.fpsControls && this.fpsControls.isHiding;
        if (playerIsHiding) { // If player is hiding, AI behavior is simplified
            if (this.state === 'CHASING' || this.state === 'SEARCHING_LKL') {
                this.state = 'PATROL';
                this.lastKnownPlayerPosition = null;
                // console.log("Zombie: Player hid, returning to PATROL");
            }
        }

        const playerIsSneaking = this.fpsControls && !playerIsHiding && this.fpsControls.movementSpeed < 1.0;
        const effectiveDetectionRange = playerIsSneaking ? this.detectionRange / 2 : this.detectionRange;

        // Check LOS using the effectiveDetectionRange
        const inLOS = !playerIsHiding && this.hasLineOfSightToPlayer(effectiveDetectionRange);

        // --- State Machine ---
        switch (this.state) {
            case 'PATROL':
                // Placeholder for actual patrol logic (e.g., move between waypoints)
                // For now, just stand and look around or idle.
                // Periodically check for player
                if (distanceToPlayer < effectiveDetectionRange && inLOS) {
                    this.state = 'CHASING';
                    // console.log("Zombie: PATROL -> CHASING");
                }
                break;

            case 'CHASING':
                // playerIsHiding check now at the top of update()
                if (inLOS && distanceToPlayer < this.detectionRange + 10) { // +10 chase persistence range
                    this.lastKnownPlayerPosition = playerPosition.clone(); // Keep updating LKL while chasing with LOS

                    const direction = new THREE.Vector3().subVectors(playerPosition, zombiePosition).normalize();
                    zombiePosition.addScaledVector(direction, this.chaseSpeed); // Use chaseSpeed
                    this.zombie.lookAt(playerPosition);

                    if (distanceToPlayer < this.attackRange) {
                        const currentTime = Date.now();
                        if (currentTime - this.lastAttackTime > 2000) {
                            this.lastAttackTime = currentTime;
                            gameState.takeDamage(15);
                            this.triggerDamageEffect();
                            // console.log("Zombie: Attacking!");
                        }
                    }
                } else {
                    // Lost LOS or player is too far, but was just chasing
                    if (this.lastKnownPlayerPosition) { // Should always have LKL if was chasing
                        this.state = 'SEARCHING_LKL';
                        this.timeSpentSearching = 0;
                        // console.log("Zombie: CHASING -> SEARCHING_LKL at", this.lastKnownPlayerPosition);
                    } else {
                        this.state = 'PATROL'; // Should not happen if LKL was updated, but as a fallback
                        // console.log("Zombie: CHASING -> PATROL (lost player, no LKL)");
                    }
                }
                break;

            case 'SEARCHING_LKL':
                if (this.fpsControls.isHiding) {
                    this.state = 'PATROL';
                    this.lastKnownPlayerPosition = null;
                    // console.log("Zombie: SEARCHING_LKL -> PATROL (player hid)");
                    break;
                }

                // Try to re-acquire target
                if (distanceToPlayer < this.detectionRange && inLOS) {
                    this.state = 'CHASING';
                    this.lastKnownPlayerPosition = null; // Clear LKL as target re-acquired
                    // console.log("Zombie: SEARCHING_LKL -> CHASING (player re-acquired)");
                    break;
                }

                if (this.lastKnownPlayerPosition) {
                    const distanceToLKL = zombiePosition.distanceTo(this.lastKnownPlayerPosition);
                    if (distanceToLKL > 1.0) { // Tolerance for reaching LKL
                        const direction = new THREE.Vector3().subVectors(this.lastKnownPlayerPosition, zombiePosition).normalize();
                        zombiePosition.addScaledVector(direction, this.speed); // Move at normal speed to LKL
                        this.zombie.lookAt(this.lastKnownPlayerPosition);
                    } else {
                        // Arrived at LKL, now "search" (pause/wait)
                        this.lastKnownPlayerPosition = null; // Indicate arrival and start "looking around" phase
                        // console.log("Zombie: Arrived at LKL, now searching area.");
                    }
                } else {
                    // At LKL (or no LKL was set), "look around" by waiting
                    this.timeSpentSearching += delta;
                    if (this.timeSpentSearching > this.searchDuration) {
                        this.state = 'PATROL';
                        this.timeSpentSearching = 0;
                        // console.log("Zombie: SEARCHING_LKL -> PATROL (search time expired)");
                    }
                }
                break;
        }

        // Common logic (like floating animation) - keep outside the state machine if it always applies
        if (this.state !== 'CHASING') { // Don't float if chasing, allow more grounded movement
             zombiePosition.y = 2 + Math.sin(Date.now() * 0.002) * 0.3;
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

let zombieAI;
try {
    zombieAI = new BasicZombieAI(scene, camera, controls); // Pass controls
} catch (error) {
    console.warn('Failed to initialize zombie AI:', error);
}

//================================================================
// Basic Interaction System
//================================================================
class BasicInteractionSystem {
    constructor(scene, camera, gameState) {
        this.scene = scene;
        this.camera = camera;
        this.gameState = gameState;
        this.interactables = [];
        this.currentFocused = null;
        
        this.initInteractables();
        this.bindEvents();
    }

    initInteractables() {
        try {
            // Create key object
            const keyGeometry = new THREE.BoxGeometry(0.5, 0.1, 2);
            const keyMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xFFD700,
                metalness: 0.8,
                roughness: 0.2
            });
            const key = new THREE.Mesh(keyGeometry, keyMaterial);
            key.position.set(25, 5, 35);
            key.userData = { 
                type: 'key', 
                interactable: true,
                collected: false,
                originalY: 5
            };
            
            this.scene.add(key);
            this.interactables.push(key);

            // Create door
            const doorGeometry = new THREE.BoxGeometry(3, 8, 0.2);
            const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const door = new THREE.Mesh(doorGeometry, doorMaterial);
            door.position.set(-50, 4, -40);
            door.userData = { 
                type: 'door', 
                interactable: true,
                locked: true
            };
            
            this.scene.add(door);
            this.interactables.push(door);
        } catch (error) {
            console.warn('Error creating interactables:', error);
        }
    }

    bindEvents() {
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyE' || event.code === 'KeyC') {
                this.attemptInteraction();
            }
        });
    }

    update() {
        try {
            // Animate key floating
            this.interactables.forEach(obj => {
                if (obj.userData.type === 'key' && !obj.userData.collected) {
                    obj.position.y = obj.userData.originalY + Math.sin(Date.now() * 0.003) * 0.3;
                    obj.rotation.y += 0.02;
                }
            });

            this.checkInteractionRange();
        } catch (error) {
            console.warn('Error updating interactions:', error);
        }
    }

    checkInteractionRange() {
        const playerPosition = this.camera.position;
        let nearestInteractable = null;
        let nearestDistance = Infinity;

        this.interactables.forEach(obj => {
            // Updated condition to check both 'interactable' and 'isInteractable'
            if (obj.userData.interactable === false || obj.userData.isInteractable === false) return;
            // If neither is explicitly false, and at least one is true (or just exists for backward compatibility)
            if (!obj.userData.interactable && !obj.userData.isInteractable) return;


            const distance = playerPosition.distanceTo(obj.position);
            if (distance < 5 && distance < nearestDistance) {
                nearestDistance = distance;
                nearestInteractable = obj;
            }
        });

        if (nearestInteractable !== this.currentFocused) {
            this.updateInteractionUI(nearestInteractable);
            this.currentFocused = nearestInteractable;
        }
    }

    updateInteractionUI(obj) {
        const keyNote = document.getElementById('key-collect-note');
        const doorNote = document.getElementById('door-open-note');
        const nudgeNote = document.getElementById('nudge-note');
        const readNotePrompt = document.getElementById('read-note-prompt');
        
        if (keyNote) keyNote.style.display = 'none';
        if (doorNote) doorNote.style.display = 'none';
        if (nudgeNote) nudgeNote.style.display = 'none';
        if (readNotePrompt) readNotePrompt.style.display = 'none';


        if (obj) {
            if (obj.userData.type === 'key' && !obj.userData.collected && keyNote) {
                keyNote.style.display = 'block';
            } else if (obj.userData.type === 'door' && doorNote) {
                doorNote.style.display = 'block';
                doorNote.textContent = obj.userData.locked ? 
                    (this.gameState.hasKey ? 'Press E to unlock door' : 'Door is locked - find the key') :
                    'Press E to open door';
            } else if (obj.userData.isNudgable && nudgeNote) {
                nudgeNote.style.display = 'block';
            } else if (obj.userData.type === 'messageBottle' && obj.userData.isInteractable && readNotePrompt) {
                readNotePrompt.style.display = 'block';
            }
        }
    }

    attemptInteraction() {
        if (!this.currentFocused) return;
        const obj = this.currentFocused;
        
        if (obj.userData.type === 'key' && !obj.userData.collected) {
            this.collectKey(obj);
        } else if (obj.userData.type === 'door') {
            this.interactWithDoor(obj);
        } else if (obj.userData.isNudgable) {
            this.nudgeObject(obj);
        } else if (obj.userData.type === 'messageBottle' && obj.userData.isInteractable) { // New condition
            displayMessage(obj.userData.messageId);
            // Optional: make bottle non-interactable or disappear after reading
            // obj.userData.isInteractable = false;
            // obj.visible = false;
        }
    }

    nudgeObject(object) {
        if (!object) return;

        const nudgeDirection = object.userData.lastNudgeSign || 1;
        object.rotation.z += (Math.PI / 16) * nudgeDirection;
        // Apply a small positional nudge as well, perhaps along its local X or a world X
        // For simplicity, let's use world X for now.
        object.position.x += 0.2 * nudgeDirection;

        object.userData.lastNudgeSign = -nudgeDirection;

        // Play sound
        if (controls && typeof controls.playObjectImpactSound === 'function') {
            controls.playObjectImpactSound();
        }

        // console.log(`Nudged ${object.userData.type}`);
    }

    collectKey(keyObj) {
        keyObj.userData.collected = true;
        keyObj.userData.interactable = false;
        keyObj.visible = false;
        
        this.gameState.collectKey();
        
        const keyContainer = document.getElementById('key-image-container');
        if (keyContainer) {
            keyContainer.style.display = 'block';
        }
        
        const keyNote = document.getElementById('key-collect-note');
        if (keyNote) keyNote.style.display = 'none';
    }

    interactWithDoor(doorObj) {
        if (doorObj.userData.locked) {
            if (this.gameState.hasKey) {
                doorObj.userData.locked = false;
                this.animateDoorOpen(doorObj);
                this.gameState.objectives.doorUnlocked = true;
            }
        }
        // Removed the else block that previously handled victory condition
        // when door was already open and player was near exit.
        // This logic is now in FPSControls.js
    }

    animateDoorOpen(doorObj) {
        const targetRotation = doorObj.rotation.y + Math.PI / 2;
        const animate = () => {
            if (Math.abs(doorObj.rotation.y - targetRotation) > 0.1) {
                doorObj.rotation.y += 0.05;
                requestAnimationFrame(animate);
            }
        };
        animate();
    }
}

let interactionSystem;
try {
    interactionSystem = new BasicInteractionSystem(scene, camera, gameState);
} catch (error) {
    console.warn('Failed to initialize interaction system:', error);
}

// Expose renderer to global scope for performance monitoring
window.renderer = renderer;
window.gameState = gameState;

//================================================================
// Enhanced UI Updates
//================================================================
function updateUI() {
    try {
        const healthPercentage = (gameState.playerHealth / 100) * 100;
        const brightness = Math.max(0.3, healthPercentage / 100);
        document.body.style.filter = `brightness(${brightness}) contrast(${1 + (1 - brightness) * 0.5})`;
        
        if (gameState.floodLevel > 8) {
            const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
            document.body.style.borderBottom = `5px solid rgba(255, 71, 87, ${pulseIntensity})`;
        } else {
            document.body.style.borderBottom = 'none';
        }
    } catch (error) {
        console.warn('Error updating UI:', error);
    }
}

//================================================================
// Load Objects with Better Error Handling
//================================================================
function loadGameObjects() {
    const loadObject = async (loadFunction, name) => {
        try {
            await loadFunction(scene);
            console.log(`${name} loaded successfully`);
        } catch (error) {
            console.warn(`Failed to load ${name}:`, error);
        }
    };

    // Try to load objects, but don't fail if modules don't exist
    Promise.all([
        import('./objects.js').catch(error => {
            console.warn('Failed to import objects.js:', error); // Keep console warning
            if (controls && typeof controls.showNotification === 'function') {
                controls.showNotification('Warning: Critical game objects failed to load. Gameplay might be affected.', 'warning');
            }
            return null; // Still return null so Promise.all doesn't break
        }),
        import('./effects.js').catch(() => null), // Keep others as they are for now
        import('./design.js').catch(() => null)
    ]).then(([objects, effects, design]) => {
        if (objects) {
            // Handle nudgable items separately
            if (objects.createframe) {
                objects.createframe(scene)
                    .then(frameObj => {
                        if (frameObj) {
                            frameObj.userData.isNudgable = true;
                            frameObj.userData.type = 'frame';
                            if (interactionSystem && interactionSystem.interactables) {
                                interactionSystem.interactables.push(frameObj);
                            }
                            // console.log("Frame processed for interaction");
                        }
                    })
                    .catch(error => console.warn('Error processing frame for interaction:', error));
            }

            if (objects.createflower) {
                objects.createflower(scene)
                    .then(flowerObj => {
                        if (flowerObj) {
                            flowerObj.userData.isNudgable = true;
                            flowerObj.userData.type = 'flower';
                            if (interactionSystem && interactionSystem.interactables) {
                                interactionSystem.interactables.push(flowerObj);
                            }
                            // console.log("Flower processed for interaction");
                        }
                    })
                    .catch(error => console.warn('Error processing flower for interaction:', error));
            }

            // Handle desk for emissive effect
            if (objects.createdesk) {
                objects.createdesk(scene)
                    .then(deskObj => {
                        if (deskObj) {
                            let screenMesh = null;
                            deskObj.traverse((child) => {
                                if (child.isMesh) {
                                    if (child.name.toLowerCase().includes('screen') || child.name.toLowerCase().includes('monitor')) {
                                        screenMesh = child;
                                    }
                                }
                            });

                            if (screenMesh) {
                                if (screenMesh.material && screenMesh.material.isMeshStandardMaterial) {
                                    screenMesh.material.emissive = new THREE.Color(0x004488); // Dim blue
                                    screenMesh.material.emissiveIntensity = 1.0; // Base intensity
                                    flickeringMaterials.push({
                                        material: screenMesh.material,
                                        baseIntensity: 1.0,
                                        lastFlickerTime: 0,
                                        onDuration: 200 + Math.random() * 300,
                                        offDuration: 50 + Math.random() * 150,
                                        flickerState: true
                                    });
                                    // console.log("Found screen mesh, made it emissive and flickerable:", screenMesh.name);
                                } else if (screenMesh.material) {
                                    // console.warn("Screen mesh material is not MeshStandardMaterial:", screenMesh.material.type);
                                }
                            } else {
                                // console.warn("Could not find a 'screen' mesh in the office_desk model for flickering effect.");
                            }
                        }
                    })
                    .catch(error => console.warn('Error processing desk for emissive effect:', error));
            }

            // Load other objects from objects.js
            const objectLoaders = {
                'Chair': objects.createChair,
                // 'Desk': objects.createdesk, // Handled above
                'Air Conditioner': objects.createaircon,
                // 'Flower': objects.createflower, // Handled above
                // 'Frame': objects.createframe,   // Handled above
                'Dispenser': objects.createdispenser,
                'Design 1': objects.created_design1,
                'Design 2': objects.created_design2,
                'Design 3': objects.created_design3,
                'Floor': objects.created_floor,
                'Hall Chairs': objects.created_hallchairs,
                'Cheap Room': objects.created_cheaproom,
                'Fence': objects.created_fence,
                'Statue': objects.created_statue,
                'Ceiling': objects.created_ceiling,
                'Near Statue': objects.created_nearstatue,
                'Falling Ceiling': objects.created_fallingceiling
            };
            for (const [name, loaderFunc] of Object.entries(objectLoaders)) {
                if (loaderFunc) { // Check if loaderFunc exists
                     loaderFunc(scene) // Assuming these also add to scene and return promise
                        .then(obj => { /* console.log(`${name} loaded.`); */ })
                        .catch(error => console.warn(`Error loading ${name}:`, error));
                }
            }
        }
        
        if (effects) {
            loadObject(effects.createblood, 'Blood');
        }
        
        if (design) {
            // Removed the old try...catch block for these calls
            design.loadWall(scene, { x: 0, y: 0, z: -50 }, '/images/texture/tile.jpg')
                .catch(error => console.warn('Error loading wall (z: -50):', error));
            design.loadWall(scene, { x: 0, y: 0, z: 50 }, '/images/texture/tile.jpg')
                .catch(error => console.warn('Error loading wall (z: 50):', error));
        }
    });
}

//================================================================
// Victory/Game Over Screens
//================================================================
// function showVictoryScreen() { // REMOVED
//     const victoryScreen = document.createElement('div');
//     victoryScreen.innerHTML = `
//         <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
//                    background: linear-gradient(45deg, rgba(46, 213, 115, 0.9), rgba(0, 123, 255, 0.9));
//                    display: flex; flex-direction: column; justify-content: center; align-items: center;
//                    color: white; font-family: 'Segoe UI', sans-serif; z-index: 9999;
//                    animation: fadeIn 2s ease-out;">
//             <h1 style="font-size: 4rem; margin-bottom: 1rem; text-shadow: 0 4px 8px rgba(0,0,0,0.5);">
//                 ESCAPED!
//             </h1>
//             <p style="font-size: 1.5rem; margin-bottom: 2rem; text-align: center;">
//                 You survived the flood and escaped the nightmare!
//             </p>
//             <button onclick="window.location.reload()"
//                    style="padding: 15px 30px; font-size: 1.2rem; background: rgba(255,255,255,0.2);
//                           border: 2px solid white; color: white; border-radius: 10px; cursor: pointer;
//                           transition: all 0.3s ease;">
//                 Play Again
//             </button>
//         </div>
//     `;
//     document.body.appendChild(victoryScreen);
// }

function showGameOverScreen() {
    const gameOverScreen = document.createElement('div');
    gameOverScreen.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                   background: linear-gradient(45deg, rgba(255, 71, 87, 0.9), rgba(139, 0, 0, 0.9));
                   display: flex; flex-direction: column; justify-content: center; align-items: center;
                   color: white; font-family: 'Segoe UI', sans-serif; z-index: 9999;
                   animation: fadeIn 2s ease-out;">
            <h1 style="font-size: 4rem; margin-bottom: 1rem; text-shadow: 0 4px 8px rgba(0,0,0,0.5);">
                DROWNED
            </h1>
            <p style="font-size: 1.5rem; margin-bottom: 2rem; text-align: center;">
                The flood consumed you... darkness prevails.
            </p>
            <button onclick="window.location.reload()" 
                   style="padding: 15px 30px; font-size: 1.2rem; background: rgba(255,255,255,0.2);
                          border: 2px solid white; color: white; border-radius: 10px; cursor: pointer;
                          transition: all 0.3s ease;">
                Try Again
            </button>
        </div>
    `;
    document.body.appendChild(gameOverScreen);
}

//================================================================
// Enhanced Animation Loop with Better Error Handling
//================================================================
const clock = new THREE.Clock();
let animationId;

function animate() {
    try {
        animationId = requestAnimationFrame(animate);
        
        const delta = clock.getDelta();
        const currentTime = Date.now(); // Get current time once per frame for flicker logic

        flickeringMaterials.forEach(item => {
            item.material.needsUpdate = false;

            if (currentTime - item.lastFlickerTime > (item.flickerState ? item.onDuration : item.offDuration)) {
                item.flickerState = !item.flickerState;
                if (item.flickerState) {
                    item.material.emissiveIntensity = item.baseIntensity;
                } else {
                    item.material.emissiveIntensity = Math.random() < 0.3 ? 0 : item.baseIntensity * 0.1;
                }
                item.lastFlickerTime = currentTime;
                item.onDuration = 50 + Math.random() * 450;
                item.offDuration = 50 + Math.random() * 250;
                item.material.needsUpdate = true;
            }
        });

        // Update water mesh
        if (waterMesh) {
            waterMesh.position.y = gameState.floodLevel;
            if (waterMesh.material.normalMap) {
                waterMesh.material.normalMap.offset.x += 0.001;
                waterMesh.material.normalMap.offset.y += 0.0005;
            }
        }

        // Animate message bottles
        messageBottles.forEach(bottle => {
            bottle.position.y = gameState.floodLevel + 0.1 + (Math.sin(currentTime * 0.001 + bottle.userData.bobOffset) * 0.05); // Use currentTime
            bottle.rotation.y += 0.002; // Gentle spin
            bottle.rotation.x = Math.sin(currentTime * 0.0005 + bottle.userData.bobOffset) * 0.1; // Gentle rock
            bottle.rotation.z = Math.cos(currentTime * 0.0007 + bottle.userData.bobOffset) * 0.1; // Gentle rock
        });

        // Animate floating debris
        floatingDebrisArray.forEach(debris => {
            // Y position based on flood level + bobbing
            const baseFloodY = gameState.floodLevel + 0.05; // Slightly above water plane
            debris.position.y = baseFloodY + (Math.sin(currentTime * 0.0005 + debris.userData.bobOffset) * 0.05);

            // Apply drift
            debris.position.x += debris.userData.driftSpeedX;
            debris.position.z += debris.userData.driftSpeedZ;

            // Apply slow rotation
            debris.rotation.x += debris.userData.rotationSpeedX;
            debris.rotation.y += debris.userData.rotationSpeedY;
            debris.rotation.z += debris.userData.rotationSpeedZ;

            // Simple bounds wrapping
            const boundSize = 40;
            if (debris.position.x > boundSize) debris.position.x = -boundSize;
            if (debris.position.x < -boundSize) debris.position.x = boundSize;
            if (debris.position.z > boundSize) debris.position.z = -boundSize;
            if (debris.position.z < -boundSize) debris.position.z = boundSize;
        });
        
        // Animate test cubes to show the scene is working
        testCube1.rotation.y += delta;
        testCube2.rotation.x += delta * 0.5;
        testCube3.rotation.z += delta * 0.3;
        
        // Update game state
        gameState.updateFlood(delta);
        gameState.gameTime += delta;
        
        // Update systems with error handling
        if (particleSystem) {
            particleSystem.update(delta);
        }
        
        if (zombieAI) {
            zombieAI.update(delta);
        }
        
        if (interactionSystem) {
            interactionSystem.update();
        }
        
        // Update controls
        if (controls && controls.pointerLockControls && controls.pointerLockControls.isLocked) {
            controls.update(delta);
        }
        
        // Update UI
        updateUI();
        
        // Check win/lose conditions
        if (gameState.currentState === 'victory') {
            cancelAnimationFrame(animationId);
            if (controls && controls.pointerLockControls && controls.pointerLockControls.isLocked) {
                controls.pointerLockControls.unlock();
            }
            // showVictoryScreen(); // Removed
            return;
        } else if (gameState.currentState === 'gameOver') {
            cancelAnimationFrame(animationId);
            if (controls && controls.pointerLockControls && controls.pointerLockControls.isLocked) {
                controls.pointerLockControls.unlock();
            }
            showGameOverScreen();
            return;
        }
        
        // Render the scene using the composer
        // renderer.render(scene, camera); // Old line
        composer.render(); // New line for post-processing
        
    } catch (error) {
        console.error('Error in animation loop:', error);
        // Try to continue animation even if there's an error
        requestAnimationFrame(animate);
    }
}

//================================================================
// Initialize Game
//================================================================
// Start the basic game immediately
console.log('Initializing basic game...');
initWater(); // Call the function to create the water
initHidingSpots(); // Call to initialize hiding spots
initMessageBottles(); // Call to initialize message bottles
initFloatingDebris(); // Call to initialize floating debris
animate();

// Load additional objects after a delay
setTimeout(() => {
    console.log('Loading additional game objects...');
    loadGameObjects();
}, 3000);

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight); // Add this line
});

// Add CSS animations
const gameStyles = document.createElement('style');
gameStyles.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
    }
    
    @keyframes heartbeat {
        0%, 100% { opacity: 0; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.02); }
    }
`;
document.head.appendChild(gameStyles);

console.log('Game initialized successfully');