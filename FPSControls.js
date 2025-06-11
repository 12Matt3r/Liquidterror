import * as THREE from 'three';

export class FPSControls {
  constructor(camera, scene, pointerLockControls) {
    this.camera = camera;
    this.scene = scene;
    this.pointerLockControls = pointerLockControls;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(250, 2130, 250);
    this.deceleration = new THREE.Vector3(-10, -55, -10); // WeaffollowPlayerker gravity
    this.move = { forward: false, backward: false, left: false, right: false };
    this.isStanding = true;
    this.isEditMode = false; // Track whether we are in edit mode
    this.inWater = false;
    this.breathingTimer = 0;
    this.lastStepTime = 0;
    this.stepInterval = 400; // milliseconds

    // Enhanced Audio System
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    // Initialize multiple sound sources
    this.initAudioSources();

    // Enhanced movement tracking
    this.movementState = 'idle'; // idle, walking, running, swimming
    this.lastPosition = camera.position.clone();
    this.movementSpeed = 0;

    // Event listeners
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);

    // Button event listeners
    const firstPersonBtn = document.getElementById('firstPersonBtn');
    const editModeBtn = document.getElementById('editModeBtn');
    
    if (firstPersonBtn) firstPersonBtn.addEventListener('click', () => this.enterFirstPersonMode());
    if (editModeBtn) editModeBtn.addEventListener('click', () => this.enterEditMode());

    // Enhanced scroll handling
    document.addEventListener('wheel', (event) => this.handleScroll(event), { passive: false });

    // Create enhanced target marker
    this.createEnhancedTargetMarker();
    
    // Initialize UI elements
    this.initUIElements();
  }

  initAudioSources() {
    const audioLoader = new THREE.AudioLoader();
    this.audioSources = new Map();

    // Walking sounds
    this.walkSound = new THREE.Audio(this.listener);
    audioLoader.load('sounds/Sound Effects - Walking on Tile Floor.mp3', (buffer) => {
      this.walkSound.setBuffer(buffer);
      this.walkSound.setLoop(true); // Set to loop if desired
      this.walkSound.setVolume(0.4);
    });

    // Water walking sounds
    this.waterWalkSound = new THREE.Audio(this.listener);
    audioLoader.load('sounds/Walking Through Water Sound Effect.mp3', (buffer) => {
      this.waterWalkSound.setBuffer(buffer);
      this.waterWalkSound.setLoop(true);
      this.waterWalkSound.setVolume(0.5); // Adjust volume as needed
    });

    // Breathing underwater sound
    this.breathingSound = new THREE.Audio(this.listener);
    audioLoader.load('sounds/breathing-underwater.mp3', (buffer) => {
      this.breathingSound.setBuffer(buffer);
      this.breathingSound.setLoop(true);
      this.breathingSound.setVolume(0.3);
    });

    // Splash sound
    this.splashSound = new THREE.Audio(this.listener);
    audioLoader.load('sounds/water-splash.mp3', (buffer) => {
      this.splashSound.setBuffer(buffer);
      this.splashSound.setVolume(0.6);
    });

    // Heartbeat sound for low health
    this.heartbeatSound = new THREE.Audio(this.listener);
    audioLoader.load('sounds/heartbeat.mp3', (buffer) => {
      this.heartbeatSound.setBuffer(buffer);
      this.heartbeatSound.setLoop(true);
      this.heartbeatSound.setVolume(0.4);
    });
  }

  initUIElements() {
    // Create stamina bar
    this.createStaminaBar();
    
    // Create breath meter
    this.createBreathMeter();
  }

  createStaminaBar() {
    const staminaContainer = document.createElement('div');
    staminaContainer.id = 'stamina-container';
    staminaContainer.style.cssText = `
      position: fixed; bottom: 140px; left: 30px; width: 200px; height: 8px;
      background: rgba(0,0,0,0.5); border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);
      z-index: 1000;
    `;
    
    const staminaBar = document.createElement('div');
    staminaBar.id = 'stamina-bar';
    staminaBar.style.cssText = `
      width: 100%; height: 100%; background: linear-gradient(90deg, #2ed573, #ffa502);
      border-radius: 4px; transition: width 0.3s ease;
    `;
    
    staminaContainer.appendChild(staminaBar);
    document.body.appendChild(staminaContainer);
  }

  createBreathMeter() {
    const breathContainer = document.createElement('div');
    breathContainer.id = 'breath-container';
    breathContainer.style.cssText = `
      position: fixed; bottom: 155px; left: 30px; width: 200px; height: 8px;
      background: rgba(0,0,0,0.5); border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);
      z-index: 1000; display: none;
    `;
    
    const breathBar = document.createElement('div');
    breathBar.id = 'breath-bar';
    breathBar.style.cssText = `
      width: 100%; height: 100%; background: linear-gradient(90deg, #74b9ff, #0984e3);
      border-radius: 4px; transition: width 0.3s ease;
    `;
    
    breathContainer.appendChild(breathBar);
    document.body.appendChild(breathContainer);
  }

  createEnhancedTargetMarker() {
    const targetPosition = new THREE.Vector3(-61, 4, -40); // The target position
    
    // Create glowing sphere marker
    const geometry = new THREE.SphereGeometry(0.3, 32, 32); // Small sphere with radius 0.2
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,      // Red color
      transparent: true,    // Enable transparency
      opacity: 0.0         // Set the opacity to 50% (you can adjust this value)
    });
    this.targetMarker = new THREE.Mesh(geometry, material);
    
    // Set the marker's position to the target position
    this.targetMarker.position.copy(targetPosition);
    
    // Add pulsing animation
    this.targetMarker.userData = { 
      pulsePhase: 0,
      originalScale: 1
    };
    
    // Add the marker to the scene
    this.scene.add(this.targetMarker);
  }
  
  enterFirstPersonMode() {
    // Activates pointer lock controls when the button is clicked
    this.pointerLockControls.lock(); // This will activate the pointer lock
    this.isEditMode = false; // Disable edit mode when entering first-person view
    this.showNotification('First Person Mode Activated', 'success');
  }

  enterEditMode() {
    this.isEditMode = true; // Enable edit mode (fly mode)
    this.velocity.set(0, 0, 0); // Reset velocity
    this.showNotification('Edit Mode Activated - Use WASD + Space/Shift', 'info');
  }

  showNotification(text, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 80px; right: 30px; padding: 15px 25px;
      background: rgba(0,0,0,0.8); color: white; border-radius: 8px;
      font-family: 'Segoe UI', sans-serif; font-size: 14px; z-index: 2000;
      border-left: 4px solid ${type === 'success' ? '#2ed573' : type === 'warning' ? '#ffa502' : '#74b9ff'};
      animation: slideInRight 0.3s ease-out;
    `;
    notification.textContent = text;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }

  handleScroll(event) {
    // Disable zoom on scroll in both modes
    event.preventDefault(); // Prevent the page from scrolling
    
    if (this.isEditMode) {
      // Smooth zoom in edit mode
      const zoomSpeed = event.deltaY * -0.001;
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + zoomSpeed * 10, 10, 120);
      this.camera.updateProjectionMatrix();
    }
  }

  _onKeyDown(event) {
    switch (event.code) {
      case 'KeyW': this.move.forward = true; break;
      case 'KeyS': this.move.backward = true; break;
      case 'KeyA': this.move.left = true; break;
      case 'KeyD': this.move.right = true; break;
      case 'Space': // Jump (move up in Edit Mode)
        event.preventDefault();
        if (this.isEditMode) {
          this.move.up = true;
        } else if (this.isStanding && !this.inWater) {
          this.velocity.y += 15; // Adjust jump height as needed
          this.isStanding = false;
          this.playJumpSound();
        }
        break;
      case 'ShiftLeft': // Move down in Edit Mode
        if (this.isEditMode) {
          this.move.down = true;
        } else {
          this.isRunning = true;
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
      case 'Space': this.move.up = false; break;
      case 'ShiftLeft': this.move.down = false; this.isRunning = false; break;
    }
  }

  update(delta) {
    const targetPosition = new THREE.Vector3(-61, 4, -40); // The target position
    const tolerance = 4; // Tolerance to account for small differences in position

    const position = this.pointerLockControls.object.position;

    // Update movement tracking
    this.updateMovementTracking(delta);
    
    // Check for game completion
    if (this.isNearTarget(position, targetPosition, tolerance)) {
      this.gameFinished();
      return;
    }

    // Enhanced water mechanics
    this.updateWaterMechanics(position, delta);
    
    // Update movement with enhanced physics
    this.updateMovement(delta);
    
    // Update audio based on movement state
    this.updateAudio();
    
    // Update UI elements
    this.updateUI();
    
    // Update target marker animation
    this.updateTargetMarker();
  }

  updateMovementTracking(delta) {
    const currentPos = this.camera.position;
    const distance = currentPos.distanceTo(this.lastPosition);
    this.movementSpeed = distance / delta;
    this.lastPosition.copy(currentPos);
    
    // Determine movement state
    const isMoving = this.move.forward || this.move.backward || this.move.left || this.move.right;
    
    if (!isMoving) {
      this.movementState = 'idle';
    } else if (this.inWater) {
      this.movementState = 'swimming';
    } else if (this.isRunning) {
      this.movementState = 'running';
    } else {
      this.movementState = 'walking';
    }
  }

  isNearTarget(position, target, tolerance) {
    return Math.abs(position.x - target.x) < tolerance &&
           Math.abs(position.y - target.y) < tolerance &&
           Math.abs(position.z - target.z) < tolerance;
  }

  updateWaterMechanics(position, delta) {
    const waterLevel = window.gameState ? window.gameState.floodLevel : 0;
    const wasInWater = this.inWater;
    this.inWater = position.y < waterLevel + 1;
    
    if (this.inWater && !wasInWater) {
      this.playWaterSplashSound();
      this.showBreathMeter(true);
    } else if (!this.inWater && wasInWater) {
      this.showBreathMeter(false);
    }
    
    if (this.inWater) {
      // Breathing mechanics
      this.breathingTimer += delta;
      if (this.breathingTimer > 30) { // 30 seconds underwater
        if (window.gameState) {
          window.gameState.takeDamage(10 * delta); // Drowning damage
        }
      }
      
      // Reduced movement speed in water
      this.acceleration.multiplyScalar(0.6);
      
      // Play breathing sound
      if (!this.breathingSound.isPlaying) {
        this.breathingSound.play();
      }
    } else {
      this.breathingTimer = Math.max(0, this.breathingTimer - delta * 2);
      this.acceleration.set(250, 2130, 250); // Restore normal speed
      
      if (this.breathingSound.isPlaying) {
        this.breathingSound.stop();
      }
    }
  }

  updateMovement(delta) {
    const speedMultiplier = this.isEditMode ? 10 : (this.isRunning ? 1.8 : 1); // Adjust this multiplier for desired speed increase
    
    const frameDeceleration = new THREE.Vector3(
      this.velocity.x * this.deceleration.x,
      this.deceleration.y,
      this.velocity.z * this.deceleration.z
    );
    frameDeceleration.multiplyScalar(delta);
    this.velocity.add(frameDeceleration);

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction); // Get the camera's forward direction

    // Normalize the camera's forward and right vectors
    const forward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const right = new THREE.Vector3().crossVectors(this.camera.up, forward).normalize();
    const up = this.camera.up; // Up direction for flying (vertical movement)

    // Handle movement in 6 directions (forward, backward, left, right, up, down)
    if (this.move.forward) this.velocity.addScaledVector(forward, this.acceleration.z * delta * speedMultiplier);
    if (this.move.backward) this.velocity.addScaledVector(forward, -this.acceleration.z * delta * speedMultiplier);
    if (this.move.left) this.velocity.addScaledVector(right, this.acceleration.x * delta * speedMultiplier);
    if (this.move.right) this.velocity.addScaledVector(right, -this.acceleration.x * delta * speedMultiplier);

    // Allow moving up and down in edit mode (flying)
    if (this.move.up && this.isEditMode) {
      this.velocity.addScaledVector(up, this.acceleration.y * delta * speedMultiplier);
    }
    if (this.move.down && this.isEditMode) {
      this.velocity.addScaledVector(up, -this.acceleration.y * delta * speedMultiplier);
    }

    // Enhanced collision detection
    this.handleCollisions(delta);
    
    // Apply movement
    const position = this.pointerLockControls.object.position;
    
    if (this.isEditMode) {
      this.velocity.y = 0; // Disable gravity effect
      position.addScaledVector(this.velocity, delta);
    } else {
      position.addScaledVector(this.velocity, delta);
      if (position.y < 5) {
        this.velocity.y = 0;
        position.y = 5;
        this.isStanding = true;
      }
    }

    // Enhanced head bobbing
    this.updateHeadBobbing();
  }

  handleCollisions(delta) {
    const position = this.pointerLockControls.object.position;
    const bufferDistance = 1.8;
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    
    const raycaster = new THREE.Raycaster(position, direction, 0, bufferDistance);
    const intersects = raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      // Smooth collision response
      const normal = intersects[0].face.normal.clone();
      normal.transformDirection(intersects[0].object.matrixWorld);
      
      // Slide along the surface
      const slideVector = this.velocity.clone();
      slideVector.projectOnPlane(normal);
      this.velocity.copy(slideVector.multiplyScalar(0.8));
    }
  }

  updateHeadBobbing() {
    if (this.movementState === 'walking' || this.movementState === 'running') {
      const bobSpeed = this.movementState === 'running' ? 0.15 : 0.1;
      const bobAmount = this.movementState === 'running' ? 0.15 : 0.08;
      
      this.camera.position.y += Math.sin(Date.now() * bobSpeed) * bobAmount;
    }
  }

  updateAudio() {
    const isMoving = this.movementState !== 'idle';
    
    // Stop all movement sounds first
    if (this.walkSound.isPlaying) this.walkSound.stop();
    if (this.waterWalkSound.isPlaying) this.waterWalkSound.stop();
    
    if (isMoving) {
      const now = Date.now();
      if (now - this.lastStepTime > this.stepInterval) {
        this.lastStepTime = now;
        
        if (this.inWater) {
          if (!this.waterWalkSound.isPlaying) {
            this.waterWalkSound.play();
          }
        } else {
          if (!this.walkSound.isPlaying) {
            this.walkSound.play();
          }
        }
      }
    }
    
    // Health-based heartbeat
    if (window.gameState && window.gameState.playerHealth < 30) {
      if (!this.heartbeatSound.isPlaying) {
        this.heartbeatSound.play();
      }
    } else if (this.heartbeatSound.isPlaying) {
      this.heartbeatSound.stop();
    }
  }

  updateUI() {
    // Update stamina bar
    const staminaBar = document.getElementById('stamina-bar');
    if (staminaBar) {
      const stamina = this.isRunning ? 70 : 100; // Simplified stamina
      staminaBar.style.width = stamina + '%';
    }
    
    // Update breath meter
    const breathBar = document.getElementById('breath-bar');
    if (breathBar && this.inWater) {
      const breathPercentage = Math.max(0, 100 - (this.breathingTimer / 30) * 100);
      breathBar.style.width = breathPercentage + '%';
      
      if (breathPercentage < 30) {
        breathBar.style.background = 'linear-gradient(90deg, #ff4757, #ff3742)';
      } else {
        breathBar.style.background = 'linear-gradient(90deg, #74b9ff, #0984e3)';
      }
    }
  }

  updateTargetMarker() {
    if (this.targetMarker) {
      this.targetMarker.userData.pulsePhase += 0.05;
      const pulse = Math.sin(this.targetMarker.userData.pulsePhase) * 0.3 + 1;
      this.targetMarker.scale.setScalar(pulse);
    }
  }

  showBreathMeter(show) {
    const breathContainer = document.getElementById('breath-container');
    if (breathContainer) {
      breathContainer.style.display = show ? 'block' : 'none';
    }
  }

  playWaterSplashSound() {
    if (this.splashSound && !this.splashSound.isPlaying) {
      this.splashSound.play();
    }
  }

  playJumpSound() {
    // Create and play jump sound effect
    const jumpSound = new THREE.Audio(this.listener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('sounds/jump.mp3', (buffer) => {
      jumpSound.setBuffer(buffer);
      jumpSound.setVolume(0.4);
      jumpSound.play();
    });
  }

  gameFinished() {
    // Create a black screen that will fade in
    const whiteScreen = document.createElement('div');
    whiteScreen.style.position = 'absolute';
    whiteScreen.style.top = 0;
    whiteScreen.style.left = 0;
    whiteScreen.style.width = '100vw';
    whiteScreen.style.height = '100vh';
    whiteScreen.style.backgroundColor = 'black';
    whiteScreen.style.zIndex = 1000;
    whiteScreen.style.opacity = 0; // Start with 0 opacity for the fade effect
    whiteScreen.style.transition = 'opacity 35s ease-out'; // Smooth fade-in over 35 seconds
    document.body.appendChild(whiteScreen);
  
    // Create the image element
    const imageElement = document.createElement('img');
    imageElement.src = 'images/texture/test.jpg'; // Path to your image
    imageElement.style.position = 'absolute';
    imageElement.style.top = '50%';
    imageElement.style.left = '50%';
    imageElement.style.transform = 'translate(-50%, -50%)';
    imageElement.style.width = 'auto';
    imageElement.style.height = 'auto';
    imageElement.style.zIndex = 1100;
    imageElement.style.opacity = 0; // Start with 0 opacity
    imageElement.style.transition = 'opacity 35s ease-out'; // Smooth fade-in for the image
    imageElement.style.pointerEvents = 'none'; // Disable interaction with the image
  
    // Append the image element to the body
    document.body.appendChild(imageElement);
  
    // Set up audio context for smoother control
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
    // Load and configure the "Running in Water" sound
    const soundWater = new Audio('sounds/The Lobotomy.mp3');
    const track = audioContext.createMediaElementSource(soundWater);
    const gainNode = audioContext.createGain();
    track.connect(gainNode).connect(audioContext.destination);
    gainNode.gain.value = 0; // Start with 0 volume
  
    // Set playback speed to 2x
    soundWater.playbackRate = 2.0;
  
    // Fade in the white screen and image element after a delay
    setTimeout(() => {
      whiteScreen.style.opacity = 1; // Fade in the white screen
      imageElement.style.opacity = 1; // Fade in the image element
  
      // Start playing the "Running in Water" sound
      soundWater.play();
  
      // Gradually increase the volume for the "Running in Water" sound
      const fadeInDuration = 1000; // Fade-in duration in ms
      const currentTime = audioContext.currentTime;
      gainNode.gain.linearRampToValueAtTime(1, currentTime + fadeInDuration / 1000);
    }, 2000); // Delay the fade-in and sound start by 2000ms (2 seconds)
  
    // Restart the game when CTRL + R is pressed
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'r') {
        window.location.reload(); // Reload the page to restart the game
      }
    });
  }
}