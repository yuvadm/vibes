import * as THREE from 'three';

// Global variables
let scene, camera, renderer;
let tracks = [];
let terrain = [];
let clock = new THREE.Clock();
const TRAIN_SPEED = 5; // Constant speed
const TRACK_SEGMENT_LENGTH = 20;
const MAX_TRACKS = 20; // Number of track segments to keep
const FIELD_SIZE = 100;
let currentTrackIndex = 0;
let trainPosition = new THREE.Vector3(0, 0.5, 0);
let trainDirection = new THREE.Vector3(0, 0, 1);
let currentTrackT = 0; // Parameter for position along current track segment (0 to 1)
let lastSceneryUpdatePosition = new THREE.Vector3();
const SCENERY_UPDATE_DISTANCE = 40; // Distance to travel before updating scenery

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, -5); // Position camera at driver's perspective
    camera.lookAt(0, 1, 10); // Look forward

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // Create initial track segments
    for (let i = 0; i < MAX_TRACKS; i++) {
        addTrackSegment();
    }

    // Create terrain
    createTerrain();

    // Add event listeners
    window.addEventListener('resize', onWindowResize);

    // Hide loading screen
    document.getElementById('loading').style.display = 'none';

    // Start animation loop
    animate();
}

// Create track segment
function createTrackSegment(startPoint, endPoint) {
    const trackGroup = new THREE.Group();

    // Create track path
    const path = new THREE.LineCurve3(startPoint, endPoint);

    // Create rails
    const railGeometry = new THREE.TubeGeometry(path, 20, 0.05, 8, false);
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

    // Left rail
    const leftRail = new THREE.Mesh(railGeometry, railMaterial);
    leftRail.position.x = 0.6;
    leftRail.receiveShadow = true;
    trackGroup.add(leftRail);

    // Right rail
    const rightRail = new THREE.Mesh(railGeometry, railMaterial);
    rightRail.position.x = -0.6;
    rightRail.receiveShadow = true;
    trackGroup.add(rightRail);

    // Create sleepers (ties)
    const sleeperGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.3);
    const sleeperMaterial = new THREE.MeshStandardMaterial({ color: 0x5C4033 });

    const distance = endPoint.distanceTo(startPoint);
    const numSleepers = Math.floor(distance / 1.5);

    for (let i = 0; i < numSleepers; i++) {
        const t = i / numSleepers;
        const sleeperPosition = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);

        const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
        sleeper.position.copy(sleeperPosition);

        // Calculate rotation to align with track direction
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        const angle = Math.atan2(direction.x, direction.z);
        sleeper.rotation.y = angle;

        sleeper.receiveShadow = true;
        trackGroup.add(sleeper);
    }

    scene.add(trackGroup);
    return trackGroup;
}

// Add a new track segment
function addTrackSegment() {
    let startPoint, endPoint, direction;

    if (tracks.length === 0) {
        // First track segment
        startPoint = new THREE.Vector3(0, 0, 0);
        endPoint = new THREE.Vector3(0, 0, TRACK_SEGMENT_LENGTH);
        direction = new THREE.Vector3(0, 0, 1);
    } else {
        // Get the end point of the last track segment
        const lastTrack = tracks[tracks.length - 1];
        const lastDirection = lastTrack.userData.direction;
        startPoint = lastTrack.userData.endPoint;

        // Randomly decide if this segment should curve
        const shouldCurve = Math.random() < 0.3; // 30% chance of curving

        if (shouldCurve) {
            // Create a curved track
            const curveAngle = (Math.random() * 0.3 + 0.1) * (Math.random() < 0.5 ? 1 : -1); // Random angle between 0.1 and 0.4 radians
            direction = lastDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), curveAngle);
        } else {
            // Continue straight
            direction = lastDirection.clone();
        }

        // Calculate the end point
        endPoint = startPoint.clone().add(direction.clone().multiplyScalar(TRACK_SEGMENT_LENGTH));
    }

    // Create the track segment
    const trackSegment = createTrackSegment(startPoint, endPoint);
    trackSegment.userData = {
        startPoint: startPoint,
        endPoint: endPoint,
        direction: direction.normalize(),
        length: startPoint.distanceTo(endPoint)
    };

    tracks.push(trackSegment);

    // If we have more tracks than MAX_TRACKS, remove the oldest one
    if (tracks.length > MAX_TRACKS) {
        const oldestTrack = tracks.shift();
        scene.remove(oldestTrack);
        oldestTrack.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        currentTrackIndex = Math.max(0, currentTrackIndex - 1);
    }
}

// Create terrain around the tracks
function createTerrain() {
    // Create ground that follows the train
    const groundSize = FIELD_SIZE * 2;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x4CAF50,  // Green color
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;

    // Store the ground in a special property so we can update its position
    ground.userData.isGround = true;
    scene.add(ground);
    terrain.push(ground);

    // Add initial environment elements
    addEnvironmentElements();
}

// Update ground position to follow train
function updateGroundPosition() {
    // Find the ground
    for (let i = 0; i < terrain.length; i++) {
        if (terrain[i].userData.isGround) {
            // Update ground position to follow train
            terrain[i].position.x = trainPosition.x;
            terrain[i].position.z = trainPosition.z;
            break;
        }
    }
}

// Add trees, rocks and other environment elements
function addEnvironmentElements() {
    // Create trees
    const numTrees = 50;

    for (let i = 0; i < numTrees; i++) {
        // Random position in front of the train
        const angle = (Math.random() - 0.5) * Math.PI; // -90 to +90 degrees from forward direction
        const distance = 50 + Math.random() * 50; // 50-100 units ahead

        // Calculate position based on train direction
        const forward = trainDirection.clone().normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const x = Math.sin(angle) * distance;
        const z = Math.cos(angle) * distance;

        // Transform to world coordinates
        const treePos = trainPosition.clone()
            .add(forward.clone().multiplyScalar(z))
            .add(right.clone().multiplyScalar(x));

        // Don't place trees too close to the tracks
        if (Math.abs(x) < 5) continue;

        const treeGroup = new THREE.Group();

        // Tree trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 0.75;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);

        // Tree foliage
        const foliageGeometry = new THREE.ConeGeometry(1, 2, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({
            color: 0x228B22,
            roughness: 0.8
        });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = 2.5;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        treeGroup.add(foliage);

        treeGroup.position.copy(treePos);
        // Add some random rotation and scale variation
        treeGroup.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.5 + Math.random() * 1.5;
        treeGroup.scale.set(scale, scale, scale);

        scene.add(treeGroup);
        terrain.push(treeGroup);
    }

    // Create rocks
    const numRocks = 20;

    for (let i = 0; i < numRocks; i++) {
        // Random position in front of the train
        const angle = (Math.random() - 0.5) * Math.PI; // -90 to +90 degrees from forward direction
        const distance = 50 + Math.random() * 50; // 50-100 units ahead

        // Calculate position based on train direction
        const forward = trainDirection.clone().normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const x = Math.sin(angle) * distance;
        const z = Math.cos(angle) * distance;

        // Transform to world coordinates
        const rockPos = trainPosition.clone()
            .add(forward.clone().multiplyScalar(z))
            .add(right.clone().multiplyScalar(x));

        // Don't place rocks too close to the tracks
        if (Math.abs(x) < 4) continue;

        const rockGeometry = new THREE.DodecahedronGeometry(0.5, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);

        rock.position.copy(rockPos);
        rock.position.y = 0.25;

        // Add some random rotation and scale variation
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        const scale = 0.3 + Math.random() * 0.7;
        rock.scale.set(scale, scale, scale);

        rock.castShadow = true;
        rock.receiveShadow = true;

        scene.add(rock);
        terrain.push(rock);
    }

    // Create some distant hills
    const numHills = 10;

    for (let i = 0; i < numHills; i++) {
        // Position hills at the edges of the field
        const angle = (Math.random() - 0.5) * Math.PI * 0.8; // Mostly ahead
        const distance = 80 + Math.random() * 40; // 80-120 units ahead

        // Calculate position based on train direction
        const forward = trainDirection.clone().normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const x = Math.sin(angle) * distance;
        const z = Math.cos(angle) * distance;

        // Transform to world coordinates
        const hillPos = trainPosition.clone()
            .add(forward.clone().multiplyScalar(z))
            .add(right.clone().multiplyScalar(x));

        const hillGeometry = new THREE.ConeGeometry(15 + Math.random() * 10, 10 + Math.random() * 5, 8);
        const hillMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(
                0.2 + Math.random() * 0.1,  // R
                0.5 + Math.random() * 0.2,  // G
                0.2 + Math.random() * 0.1   // B
            ),
            roughness: 1.0
        });
        const hill = new THREE.Mesh(hillGeometry, hillMaterial);

        hill.position.copy(hillPos);
        hill.position.y = -5;
        hill.castShadow = true;
        hill.receiveShadow = true;

        scene.add(hill);
        terrain.push(hill);
    }

    // Add some clouds
    const numClouds = 5;

    for (let i = 0; i < numClouds; i++) {
        const cloudGroup = new THREE.Group();

        // Create cloud with multiple spheres
        const numPuffs = 3 + Math.floor(Math.random() * 4);
        for (let j = 0; j < numPuffs; j++) {
            const puffGeometry = new THREE.SphereGeometry(1 + Math.random() * 1.5, 7, 7);
            const puffMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                roughness: 1.0
            });
            const puff = new THREE.Mesh(puffGeometry, puffMaterial);

            // Position puffs to form a cloud shape
            puff.position.set(
                j * 1.5 - numPuffs / 2,
                Math.random() * 0.5,
                Math.random() * 1.5 - 0.75
            );

            cloudGroup.add(puff);
        }

        // Position cloud in front of the train
        const angle = (Math.random() - 0.5) * Math.PI; // -90 to +90 degrees from forward direction
        const distance = 60 + Math.random() * 60; // 60-120 units ahead

        // Calculate position based on train direction
        const forward = trainDirection.clone().normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const x = Math.sin(angle) * distance;
        const z = Math.cos(angle) * distance;

        // Transform to world coordinates
        const cloudPos = trainPosition.clone()
            .add(forward.clone().multiplyScalar(z))
            .add(right.clone().multiplyScalar(x));

        cloudPos.y = 30 + Math.random() * 15;
        cloudGroup.position.copy(cloudPos);

        // Scale cloud
        const scale = 2 + Math.random() * 3;
        cloudGroup.scale.set(scale, scale * 0.6, scale);

        scene.add(cloudGroup);
        terrain.push(cloudGroup);
    }
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Update train position along track
function updateTrainPosition(delta) {
    // Get current track segment
    const currentTrack = tracks[currentTrackIndex];
    if (!currentTrack) return;

    // Move along current track segment
    currentTrackT += (TRAIN_SPEED * delta) / currentTrack.userData.length;

    // If we've reached the end of the current track segment
    if (currentTrackT >= 1) {
        currentTrackT = 0;
        currentTrackIndex++;

        // If we need more track segments
        if (currentTrackIndex >= tracks.length - 5) {
            addTrackSegment();
        }

        // If we've run out of track segments (shouldn't happen with proper management)
        if (currentTrackIndex >= tracks.length) {
            currentTrackIndex = 0;
        }
    }

    // Get updated track
    const track = tracks[currentTrackIndex];
    if (!track) return;

    // Interpolate position along current track segment
    trainPosition.lerpVectors(
        track.userData.startPoint,
        track.userData.endPoint,
        currentTrackT
    );

    // Update train direction
    trainDirection.copy(track.userData.direction);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Update train position
    updateTrainPosition(delta);

    // Update ground position to follow the train
    updateGroundPosition();

    // Update scenery
    if (trainPosition.distanceTo(lastSceneryUpdatePosition) > SCENERY_UPDATE_DISTANCE) {
        lastSceneryUpdatePosition.copy(trainPosition);
        updateScenery();
    }

    // Update camera position to follow train
    camera.position.copy(trainPosition);
    camera.position.y += 2; // Height of driver's view

    // Look ahead in the direction of travel
    const lookAtPoint = trainPosition.clone().add(
        trainDirection.clone().multiplyScalar(10)
    );
    lookAtPoint.y = trainPosition.y + 1;
    camera.lookAt(lookAtPoint);

    renderer.render(scene, camera);
}

// Update scenery
function updateScenery() {
    // Remove old scenery
    for (let i = terrain.length - 1; i >= 0; i--) {
        const object = terrain[i];
        if (object.position.distanceTo(trainPosition) > FIELD_SIZE * 2) {
            scene.remove(object);
            terrain.splice(i, 1);
        }
    }

    // Add new scenery
    addEnvironmentElements();
}

// Start the application
init();
