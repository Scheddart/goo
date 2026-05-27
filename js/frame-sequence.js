/* ============================================
   GoO Elétricos — Hero Frame Sequence
   Scroll-controlled canvas-rendered frame playback

   HOW TO ADD FRAMES:
   1. Place frame files in: assets/frames/
   2. Name them sequentially: frame_0001.jpg, frame_0002.jpg, ...
      (or change the naming pattern below in CONFIG.namePattern)
   3. The loader auto-detects how many frames exist.
   ============================================ */

(() => {
    'use strict';

    const CONFIG = {
        folder: 'assets/frames/',
        // Name pattern. {n} = number, padded to namePadding.
        namePattern: 'ezgif-frame-{n}.png',
        namePadding: 3,
        // Maximum frames to attempt (loader will stop earlier when files 404)
        maxFrames: 300,
        // Probing strategy: how many sequential 404s before stopping
        maxConsecutive404: 2,
        // Object-fit behavior — 'cover' fills the entire hero (preferred for premium look)
        fit: 'cover',
        // Scroll multiplier: how long (in viewport heights) the sequence plays.
        // Lower = faster animation per scroll distance.
        scrollLength: 2.0,
        // Whether to keep canvas pinned during sequence
        pin: true,
        // Full-width bottom gradient — cinematic darkening across the entire
        // base of the hero. Hides the Kling AI watermark and adds depth.
        bottomBand: {
            enabled: true,
            startY: 0.55,         // gradient begins here (0% opacity)
            midY: 0.78,           // mid stop
            midOpacity: 0.30,     // opacity at mid stop
            endOpacity: 0.88,     // opacity at very bottom
            color: '0, 0, 0',     // rgb darkening color
        },
    };

    const canvas = document.getElementById('heroCanvas');
    const placeholder = document.getElementById('heroPlaceholder');
    const heroSection = document.getElementById('hero');

    if (!canvas || !heroSection) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* ============================================
       BUILD FRAME URL
       ============================================ */
    const buildUrl = (i) => {
        const num = String(i).padStart(CONFIG.namePadding, '0');
        return CONFIG.folder + CONFIG.namePattern.replace('{n}', num);
    };

    /* ============================================
       PROBE — detect how many frames exist
       Tries loading frames sequentially. Stops when N consecutive 404s.
       ============================================ */
    const probeFrameCount = async () => {
        let count = 0;
        let consecutiveFails = 0;

        for (let i = 1; i <= CONFIG.maxFrames; i++) {
            const url = buildUrl(i);
            const exists = await frameExists(url);
            if (exists) {
                count = i;
                consecutiveFails = 0;
            } else {
                consecutiveFails++;
                if (consecutiveFails >= CONFIG.maxConsecutive404) {
                    break;
                }
            }
        }
        return count;
    };

    const frameExists = (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    /* ============================================
       LOAD ALL FRAMES (preload images)
       Loads in batches to avoid blocking.
       ============================================ */
    const loadFrames = async (count, onProgress) => {
        const images = new Array(count);
        const batchSize = 12;
        let loaded = 0;

        const loadOne = (i) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                images[i] = img;
                loaded++;
                if (onProgress) onProgress(loaded / count);
                resolve();
            };
            img.onerror = () => {
                loaded++;
                if (onProgress) onProgress(loaded / count);
                resolve();
            };
            img.src = buildUrl(i + 1);
        });

        for (let batch = 0; batch < count; batch += batchSize) {
            const promises = [];
            for (let k = batch; k < Math.min(batch + batchSize, count); k++) {
                promises.push(loadOne(k));
            }
            await Promise.all(promises);
        }
        return images;
    };

    /* ============================================
       CANVAS RESIZE
       ============================================ */
    const resizeCanvas = () => {
        const rect = heroSection.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
    };

    /* ============================================
       RENDER A FRAME (with object-fit behavior)
       Includes optional watermark masking: clones a strip from
       above the watermark zone down over it, blending with the
       gradient backdrop of the source frames.
       ============================================ */
    const renderFrame = (img) => {
        if (!img) return;
        const cw = canvas.width;
        const ch = canvas.height;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;

        ctx.clearRect(0, 0, cw, ch);

        const canvasRatio = cw / ch;
        const imgRatio = iw / ih;

        let dw, dh, dx, dy;

        if (CONFIG.fit === 'cover') {
            if (imgRatio > canvasRatio) {
                dh = ch;
                dw = ch * imgRatio;
                dx = (cw - dw) / 2;
                dy = 0;
            } else {
                dw = cw;
                dh = cw / imgRatio;
                dx = 0;
                dy = (ch - dh) / 2;
            }
        } else { // contain
            if (imgRatio > canvasRatio) {
                dw = cw;
                dh = cw / imgRatio;
                dx = 0;
                dy = (ch - dh) / 2;
            } else {
                dh = ch;
                dw = ch * imgRatio;
                dx = (cw - dw) / 2;
                dy = 0;
            }
        }

        ctx.drawImage(img, dx, dy, dw, dh);

        // ============================================
        // FULL-WIDTH BOTTOM GRADIENT
        // Cinematic darkening across the entire base, hiding the
        // Kling AI watermark naturally as part of the vignette.
        // ============================================
        const bb = CONFIG.bottomBand;
        if (bb && bb.enabled) {
            const startY = ch * bb.startY;
            const midY = ch * bb.midY;
            const endY = ch;

            const gradient = ctx.createLinearGradient(0, startY, 0, endY);
            gradient.addColorStop(0, `rgba(${bb.color}, 0)`);
            const midStop = (midY - startY) / (endY - startY);
            gradient.addColorStop(midStop, `rgba(${bb.color}, ${bb.midOpacity})`);
            gradient.addColorStop(1, `rgba(${bb.color}, ${bb.endOpacity})`);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, startY, cw, endY - startY);
        }
    };

    /* ============================================
       MAIN INIT
       ============================================ */
    const init = async () => {
        resizeCanvas();
        window.addEventListener('resize', () => {
            resizeCanvas();
            if (state.currentImage) renderFrame(state.currentImage);
        });

        const state = {
            frames: [],
            count: 0,
            currentIndex: 0,
            currentImage: null,
        };

        // Step 1: probe
        const count = await probeFrameCount();

        if (count === 0) {
            // No frames yet — show placeholder, do not initialize scroll trigger.
            // When frames are added later, simply reload the page.
            console.info(
                '[Frame Sequence] No frames detected in', CONFIG.folder,
                '— place files named "' + CONFIG.namePattern.replace('{n}', '0001') + '" etc. and reload.'
            );
            return;
        }

        // Frames detected → hide placeholder
        if (placeholder) placeholder.classList.add('is-hidden');

        console.info('[Frame Sequence] Detected', count, 'frames. Preloading...');

        // Step 2: load
        const images = await loadFrames(count, (p) => {
            // Could update preloader progress, but main preloader has its own logic
        });

        state.frames = images;
        state.count = count;
        state.currentImage = images[0];

        canvas.classList.add('is-ready');
        renderFrame(images[0]);

        console.info('[Frame Sequence] Ready. Initializing scroll...');

        // Step 3: hook into ScrollTrigger
        initScrollControl(state);
    };

    /* ============================================
       SCROLL CONTROL — scrub frame index with scroll
       ============================================ */
    const initScrollControl = (state) => {
        if (!window.gsap || !window.ScrollTrigger) {
            console.warn('[Frame Sequence] GSAP/ScrollTrigger not available.');
            return;
        }

        const progress = { value: 0 };

        // Create a scroll trigger that pins the hero and scrubs frame index
        ScrollTrigger.create({
            trigger: heroSection,
            start: 'top top',
            end: `+=${window.innerHeight * CONFIG.scrollLength}`,
            pin: CONFIG.pin,
            pinSpacing: true,
            scrub: 0.8, // lower = snappier response; still smooth/cinematic
            onUpdate: (self) => {
                const idx = Math.min(
                    state.count - 1,
                    Math.floor(self.progress * (state.count - 1))
                );
                if (idx !== state.currentIndex && state.frames[idx]) {
                    state.currentIndex = idx;
                    state.currentImage = state.frames[idx];
                    renderFrame(state.frames[idx]);
                }
            },
        });

        // Refresh on full load
        window.addEventListener('load', () => ScrollTrigger.refresh());
    };

    /* ============================================
       KICK OFF
       ============================================ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
