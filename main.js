import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { FPSControls } from './FPSControls.js';

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
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;

const container = document.getElementById('webgl-container');
if (container) {
    container.appendChild(renderer.domElement);
} else {
    document.body.appendChild(renderer.domElement);
}

// Initialize camera position
camera.position.set(37, 6, 11);

//================================================================
// Basic Lighting Setup - Essential for Visibility
//================================================================
// Strong ambient light to ensure visibility
const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
scene.add(ambientLight);

// Main directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Additional point lights for better illumination
const pointLight1 = new THREE.PointLight(0xffffff, 1, 50);
pointLight1.position.set(20, 15, 20);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xffffff, 0.8, 40);
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
        this.floodSpeed = 0.002;
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
        this.state = 'patrol';
        this.speed = 0.02;
        this.detectionRange = 30;
        this.attackRange = 3;
        this.lastAttackTime = 0;
        
        this.loadZombie();
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
        if (!this.zombie) return;

        try {
            const playerPosition = this.camera.position;
            const zombiePosition = this.zombie.position;
            const distanceToPlayer = playerPosition.distanceTo(zombiePosition);

            // Stealth mechanics
            const playerIsSneaking = this.fpsControls && this.fpsControls.movementSpeed < 1.0; // Threshold for sneaking
            const currentDetectionRange = playerIsSneaking ? this.detectionRange / 2 : this.detectionRange;
            // For debugging, you could add:
            // if (playerIsSneaking) console.log("Player is sneaking, detection range: ", currentDetectionRange);

            if (distanceToPlayer < currentDetectionRange) { // Use currentDetectionRange
                const direction = new THREE.Vector3();
                direction.subVectors(playerPosition, zombiePosition).normalize();
                zombiePosition.addScaledVector(direction, this.speed);
                this.zombie.lookAt(playerPosition);

                if (distanceToPlayer < this.attackRange) {
                    const currentTime = Date.now();
                    if (currentTime - this.lastAttackTime > 2000) {
                        this.lastAttackTime = currentTime;
                        gameState.takeDamage(15);
                        this.triggerDamageEffect();
                    }
                }
            }

            // Simple floating animation
            zombiePosition.y = 2 + Math.sin(Date.now() * 0.002) * 0.3;
        } catch (error) {
            console.warn('Error updating zombie:', error);
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
            if (!obj.userData.interactable) return;
            
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
        
        if (keyNote) keyNote.style.display = 'none';
        if (doorNote) doorNote.style.display = 'none';

        if (obj) {
            if (obj.userData.type === 'key' && !obj.userData.collected && keyNote) {
                keyNote.style.display = 'block';
            } else if (obj.userData.type === 'door' && doorNote) {
                doorNote.style.display = 'block';
                doorNote.textContent = obj.userData.locked ? 
                    (this.gameState.hasKey ? 'Press E to unlock door' : 'Door is locked - find the key') :
                    'Press E to open door';
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
        }
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
            loadObject(objects.createChair, 'Chair');
            loadObject(objects.createdesk, 'Desk');
            loadObject(objects.createaircon, 'Air Conditioner');
            loadObject(objects.createflower, 'Flower');
            loadObject(objects.createframe, 'Frame');
            loadObject(objects.createdispenser, 'Dispenser');
            loadObject(objects.created_design1, 'Design 1');
            loadObject(objects.created_design2, 'Design 2');
            loadObject(objects.created_design3, 'Design 3');
            loadObject(objects.created_floor, 'Floor');
            loadObject(objects.created_hallchairs, 'Hall Chairs');
            loadObject(objects.created_cheaproom, 'Cheap Room');
            loadObject(objects.created_fence, 'Fence');
            loadObject(objects.created_statue, 'Statue');
            loadObject(objects.created_ceiling, 'Ceiling');
            loadObject(objects.created_nearstatue, 'Near Statue');
            loadObject(objects.created_fallingceiling, 'Falling Ceiling');
        }
        
        if (effects) {
            loadObject(effects.createblood, 'Blood');
        }
        
        if (design) {
            try {
                design.loadWall(scene, { x: 0, y: 0, z: -50 }, '/images/texture/tile.jpg');
                design.loadWall(scene, { x: 0, y: 0, z: 50 }, '/images/texture/tile.jpg');
            } catch (error) {
                console.warn('Failed to load walls:', error);
            }
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
            // showVictoryScreen(); // Removed
            return;
        } else if (gameState.currentState === 'gameOver') {
            cancelAnimationFrame(animationId);
            showGameOverScreen();
            return;
        }
        
        // Render the scene
        renderer.render(scene, camera);
        
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