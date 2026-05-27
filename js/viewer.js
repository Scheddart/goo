/* ============================================
   GoO Elétricos — 3D Viewer
   Three.js scene with GLB model + OrbitControls
   ============================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CONFIG = {
    modelPath: 'assets/models/scooter.glb',
    backgroundColor: 0xf0ede6, // matches CSS viewer__canvas bg
    autoRotate: true,
    autoRotateSpeed: 0.6,
    minDistance: 1.8,
    maxDistance: 8,
    enableZoom: true,
    enablePan: false,
    // Cap polar so users can't flip "below the floor"
    minPolarAngle: Math.PI * 0.15,
    maxPolarAngle: Math.PI * 0.55,
};

(() => {
    const canvas = document.getElementById('viewerCanvas');
    const loader = document.getElementById('viewerLoader');
    if (!canvas) return;

    /* ============================================
       SCENE
       ============================================ */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.backgroundColor);

    /* ============================================
       CAMERA
       ============================================ */
    const camera = new THREE.PerspectiveCamera(
        35,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        100
    );
    camera.position.set(3.5, 1.6, 4.2);

    /* ============================================
       RENDERER
       ============================================ */
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* ============================================
       ENVIRONMENT — soft studio reflections
       ============================================ */
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();

    /* ============================================
       LIGHTING — premium product setup (key/fill/rim)
       ============================================ */
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd0cec5, 0.55);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 8, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0008;
    keyLight.shadow.radius = 6;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfde7c4, 0.7);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xcfe0f5, 0.9);
    rimLight.position.set(-2, 4, -5);
    scene.add(rimLight);

    // Subtle color accents (brand spectrum) — extremely low intensity to avoid recoloring product
    const accentR = new THREE.PointLight(0xe63946, 1.4, 6, 2);
    accentR.position.set(3, 0.5, -2);
    scene.add(accentR);

    const accentB = new THREE.PointLight(0x1d76d6, 1.4, 6, 2);
    accentB.position.set(-3, 0.5, -2);
    scene.add(accentB);

    /* ============================================
       FLOOR — soft contact shadow surface
       ============================================ */
    const floorGeo = new THREE.CircleGeometry(8, 64);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0xebe7df,
        roughness: 0.85,
        metalness: 0.0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    /* ============================================
       CONTROLS
       ============================================ */
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = CONFIG.autoRotate;
    controls.autoRotateSpeed = CONFIG.autoRotateSpeed;
    controls.minDistance = CONFIG.minDistance;
    controls.maxDistance = CONFIG.maxDistance;
    controls.enableZoom = CONFIG.enableZoom;
    controls.enablePan = CONFIG.enablePan;
    controls.minPolarAngle = CONFIG.minPolarAngle;
    controls.maxPolarAngle = CONFIG.maxPolarAngle;
    controls.target.set(0, 0.7, 0);

    // Pause autorotate on user interaction
    let userInteracted = false;
    let interactionTimer = null;
    const pauseAutoRotate = () => {
        controls.autoRotate = false;
        userInteracted = true;
        clearTimeout(interactionTimer);
        interactionTimer = setTimeout(() => {
            controls.autoRotate = CONFIG.autoRotate;
        }, 4000);
    };
    canvas.addEventListener('pointerdown', pauseAutoRotate);

    /* ============================================
       SCROLL CAPTURE — wheel inside canvas zooms the model,
       does NOT scroll the page. Wheel outside canvas scrolls normally.
       Strategy:
         - OrbitControls handles zoom + calls preventDefault (browser scroll blocked)
         - We stopPropagation so Lenis (listening on window) never sees the event
         - data-lenis-prevent attribute on the canvas is a redundant safety net
       Listener runs in bubble phase AFTER OrbitControls (registered later),
       so OrbitControls' zoom still works.
       ============================================ */
    canvas.addEventListener(
        'wheel',
        (e) => {
            e.stopPropagation();
            // Also call preventDefault as a belt-and-suspenders against page scroll
            if (e.cancelable) e.preventDefault();
            pauseAutoRotate();
        },
        { passive: false }
    );

    // Block touch-based page scroll while interacting with the viewer
    canvas.addEventListener('touchmove', (e) => {
        e.stopPropagation();
    }, { passive: true });

    /* ============================================
       LOAD MODEL
       ============================================ */
    const gltfLoader = new GLTFLoader();

    let scooter = null;

    gltfLoader.load(
        CONFIG.modelPath,
        (gltf) => {
            scooter = gltf.scene;

            // Compute bounding box → center & scale to fit
            const box = new THREE.Box3().setFromObject(scooter);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Center horizontally, place bottom on floor
            scooter.position.x -= center.x;
            scooter.position.z -= center.z;
            scooter.position.y -= box.min.y;

            // Scale to target size (longest dimension ~2.4 units)
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 2.4;
            const scale = targetSize / maxDim;
            scooter.scale.setScalar(scale);

            // Re-center after scaling
            const box2 = new THREE.Box3().setFromObject(scooter);
            const center2 = box2.getCenter(new THREE.Vector3());
            scooter.position.x -= center2.x;
            scooter.position.z -= center2.z;
            scooter.position.y -= box2.min.y;

            // Update camera target to mid-height of scooter
            const finalBox = new THREE.Box3().setFromObject(scooter);
            const finalSize = finalBox.getSize(new THREE.Vector3());
            controls.target.set(0, finalSize.y * 0.5, 0);

            // Enable shadows on all meshes
            scooter.traverse((obj) => {
                if (obj.isMesh) {
                    obj.castShadow = true;
                    obj.receiveShadow = true;
                    // Improve material quality
                    if (obj.material) {
                        obj.material.envMapIntensity = 1.1;
                        if (obj.material.map) {
                            obj.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        }
                    }
                }
            });

            scene.add(scooter);

            // Hide loader with entrance animation
            if (loader) loader.classList.add('is-done');
            if (window.gsap && scooter) {
                gsap.from(scooter.position, {
                    y: -0.6,
                    duration: 1.4,
                    ease: 'power3.out',
                });
                gsap.from(scooter.rotation, {
                    y: -Math.PI * 0.5,
                    duration: 1.8,
                    ease: 'power3.out',
                });
                gsap.from(scooter.scale, {
                    x: 0.001,
                    y: 0.001,
                    z: 0.001,
                    duration: 1.4,
                    ease: 'power3.out',
                });
            }

            console.info('[3D Viewer] Model loaded successfully.');
        },
        (xhr) => {
            // Progress callback (optional)
            const pct = xhr.total ? (xhr.loaded / xhr.total * 100).toFixed(0) : 0;
            // console.log(`[3D Viewer] Loading: ${pct}%`);
        },
        (error) => {
            console.error('[3D Viewer] Failed to load model:', error);
            if (loader) {
                loader.innerHTML = '<span style="color:#8a8780;font-size:12px;text-transform:uppercase;letter-spacing:.2em">Falha ao carregar modelo 3D</span>';
            }
        }
    );

    /* ============================================
       RESIZE
       ============================================ */
    const onResize = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };

    // Use ResizeObserver for accurate canvas sizing
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(onResize);
        ro.observe(canvas);
    } else {
        window.addEventListener('resize', onResize);
    }

    /* ============================================
       RENDER LOOP
       ============================================ */
    let isVisible = true;
    if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver(
            (entries) => entries.forEach((e) => (isVisible = e.isIntersecting)),
            { rootMargin: '100px' }
        );
        io.observe(canvas);
    }

    const animate = () => {
        requestAnimationFrame(animate);
        if (!isVisible) return;
        controls.update();
        renderer.render(scene, camera);
    };
    animate();

    /* ============================================
       SUBTLE SCROLL-DRIVEN PARALLAX ON VIEWER
       ============================================ */
    if (window.gsap && window.ScrollTrigger) {
        gsap.to(camera.position, {
            y: '+=0.4',
            ease: 'none',
            scrollTrigger: {
                trigger: '.viewer',
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.5,
            },
        });
    }

})();
