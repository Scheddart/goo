/* ============================================
   GoO Elétricos — 3D Viewer
   Three.js scene with GLB model + OrbitControls
   Lazy-initialized when the viewer section approaches viewport.
   ============================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const isMobile =
    matchMedia('(max-width: 768px)').matches ||
    matchMedia('(hover: none)').matches;

const CONFIG = {
    modelPath: 'assets/models/scooter.glb',
    backgroundColor: 0xf0ede6,
    autoRotate: true,
    autoRotateSpeed: 0.6,
    minDistance: 1.8,
    maxDistance: 8,
    enableZoom: true,
    enablePan: false,
    minPolarAngle: Math.PI * 0.15,
    maxPolarAngle: Math.PI * 0.55,
};

const canvas = document.getElementById('viewerCanvas');
const loader = document.getElementById('viewerLoader');
if (canvas) {
    // ============================================
    // LAZY INIT — only build the scene when the
    // viewer section is approaching the viewport.
    // Saves ~12MB GLB + Three.js work on first paint.
    // ============================================
    let initialized = false;
    const start = () => {
        if (initialized) return;
        initialized = true;
        initViewer();
    };

    const viewerSection = canvas.closest('.viewer') || canvas;
    if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) {
                    start();
                    io.disconnect();
                    break;
                }
            }
        }, { rootMargin: '600px 0px' }); // start when ~one viewport away
        io.observe(viewerSection);
    } else {
        // Old browser: kick off after a small idle
        setTimeout(start, 800);
    }
}

function initViewer() {
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
        antialias: !isMobile, // off on mobile for perf
        alpha: false,
        powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isMobile;
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
    keyLight.castShadow = !isMobile;
    if (!isMobile) {
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 30;
        keyLight.shadow.camera.left = -6;
        keyLight.shadow.camera.right = 6;
        keyLight.shadow.camera.top = 6;
        keyLight.shadow.camera.bottom = -6;
        keyLight.shadow.bias = -0.0008;
        keyLight.shadow.radius = 6;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfde7c4, 0.7);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xcfe0f5, 0.9);
    rimLight.position.set(-2, 4, -5);
    scene.add(rimLight);

    const accentR = new THREE.PointLight(0xe63946, 1.4, 6, 2);
    accentR.position.set(3, 0.5, -2);
    scene.add(accentR);

    const accentB = new THREE.PointLight(0x1d76d6, 1.4, 6, 2);
    accentB.position.set(-3, 0.5, -2);
    scene.add(accentB);

    /* ============================================
       FLOOR
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
    floor.receiveShadow = !isMobile;
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

    // On mobile: 1 finger = page scroll, 2 fingers = rotate/zoom
    // This was the core source of scroll jank on mobile.
    if (isMobile) {
        controls.touches = {
            ONE: null,
            TWO: THREE.TOUCH.DOLLY_ROTATE,
        };
    }

    // Pause autorotate on user interaction
    let interactionTimer = null;
    const pauseAutoRotate = () => {
        controls.autoRotate = false;
        clearTimeout(interactionTimer);
        interactionTimer = setTimeout(() => {
            controls.autoRotate = CONFIG.autoRotate;
        }, 4000);
    };
    canvas.addEventListener('pointerdown', pauseAutoRotate);

    /* ============================================
       SCROLL CAPTURE — wheel inside canvas zooms the model,
       does NOT scroll the page. Touch on mobile uses 2 fingers.
       ============================================ */
    canvas.addEventListener(
        'wheel',
        (e) => {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
            pauseAutoRotate();
        },
        { passive: false }
    );

    // On desktop, block touch propagation to Lenis. On mobile, let touch
    // pass naturally so the page can scroll with a single finger.
    if (!isMobile) {
        canvas.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    /* ============================================
       LOAD MODEL
       ============================================ */
    const gltfLoader = new GLTFLoader();
    let scooter = null;

    gltfLoader.load(
        CONFIG.modelPath,
        (gltf) => {
            scooter = gltf.scene;

            const box = new THREE.Box3().setFromObject(scooter);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            scooter.position.x -= center.x;
            scooter.position.z -= center.z;
            scooter.position.y -= box.min.y;

            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 2.4;
            const scale = targetSize / maxDim;
            scooter.scale.setScalar(scale);

            const box2 = new THREE.Box3().setFromObject(scooter);
            const center2 = box2.getCenter(new THREE.Vector3());
            scooter.position.x -= center2.x;
            scooter.position.z -= center2.z;
            scooter.position.y -= box2.min.y;

            const finalBox = new THREE.Box3().setFromObject(scooter);
            const finalSize = finalBox.getSize(new THREE.Vector3());
            controls.target.set(0, finalSize.y * 0.5, 0);

            scooter.traverse((obj) => {
                if (obj.isMesh) {
                    obj.castShadow = !isMobile;
                    obj.receiveShadow = !isMobile;
                    if (obj.material) {
                        obj.material.envMapIntensity = 1.1;
                        if (obj.material.map && !isMobile) {
                            obj.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        }
                    }
                }
            });

            scene.add(scooter);

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
        undefined,
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

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(onResize);
        ro.observe(canvas);
    } else {
        window.addEventListener('resize', onResize);
    }

    /* ============================================
       RENDER LOOP (paused when off-screen)
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
       SUBTLE SCROLL-DRIVEN PARALLAX (desktop only)
       ============================================ */
    if (!isMobile && window.gsap && window.ScrollTrigger) {
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
}
