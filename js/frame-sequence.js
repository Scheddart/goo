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

    // Mobile detection — used to tune scroll length, batching, and DPR
    const isMobile =
        matchMedia('(max-width: 768px)').matches ||
        matchMedia('(hover: none)').matches;

    const CONFIG = {
        folder: 'assets/frames/',
        namePattern: 'ezgif-frame-{n}.png',
        namePadding: 3,
        maxFrames: 300,
        // Probe batch size (parallel)
        probeBatch: 32,
        fit: 'cover',
        // Mobile gets shorter sequence so hero exits viewport before frame ends,
        // but not so short that flick-scrolling skips most frames.
        scrollLength: isMobile ? 1.5 : 2.0,
        pin: true,
        bottomBand: {
            enabled: true,
            startY: 0.55,
            midY: 0.78,
            midOpacity: 0.30,
            // Pure black at the very bottom so the canvas blends seamlessly
            // into the dark page background when the pin releases.
            endOpacity: 1.0,
            color: '0, 0, 0',
        },
    };

    const canvas = document.getElementById('heroCanvas');
    const placeholder = document.getElementById('heroPlaceholder');
    const heroSection = document.getElementById('hero');

    if (!canvas || !heroSection) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    // Lower DPR on mobile to reduce GPU/memory cost
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    /* ============================================
       BUILD FRAME URL
       ============================================ */
    const buildUrl = (i) => {
        const num = String(i).padStart(CONFIG.namePadding, '0');
        return CONFIG.folder + CONFIG.namePattern.replace('{n}', num);
    };

    /* ============================================
       PROBE — detect how many frames exist (parallel batches)
       Much faster than sequential: ~3 round-trips instead of 91.
       ============================================ */
    const frameExists = (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    const probeFrameCount = async () => {
        let count = 0;
        const batch = CONFIG.probeBatch;

        for (let start = 1; start <= CONFIG.maxFrames; start += batch) {
            const end = Math.min(start + batch - 1, CONFIG.maxFrames);
            const checks = [];
            for (let i = start; i <= end; i++) {
                checks.push(frameExists(buildUrl(i)));
            }
            const results = await Promise.all(checks);
            const firstFail = results.indexOf(false);
            if (firstFail === -1) {
                count = end;
            } else {
                count = start + firstFail - 1;
                return count;
            }
        }
        return count;
    };

    /* ============================================
       LOAD A SINGLE FRAME
       ============================================ */
    const loadOne = (i) => new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = buildUrl(i);
    });

    /* ============================================
       LOAD ALL FRAMES IN BACKGROUND BATCHES
       Allows scroll control to start before all frames are ready.
       ============================================ */
    const loadFrames = async (count, images, onProgress) => {
        const batchSize = isMobile ? 6 : 12;
        let loaded = 0;

        const loadInto = (i) => new Promise((resolve) => {
            if (images[i]) {
                loaded++;
                if (onProgress) onProgress(loaded / count);
                return resolve();
            }
            const img = new Image();
            img.decoding = 'async';
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
                promises.push(loadInto(k));
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
       Gradient + dimensions cached between renders; recomputed
       only when the canvas resizes (invalidateRenderCache).
       ============================================ */
    let cache = { w: 0, h: 0, gradient: null, bgColor: '#0a0a0a' };
    const invalidateRenderCache = () => { cache.w = 0; cache.h = 0; };

    const renderFrame = (img) => {
        if (!img) return;
        const cw = canvas.width;
        const ch = canvas.height;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;

        // Recompute cached gradient only on size change
        if (cw !== cache.w || ch !== cache.h) {
            cache.w = cw;
            cache.h = ch;
            const bb = CONFIG.bottomBand;
            if (bb && bb.enabled) {
                const startY = ch * bb.startY;
                const endY = ch;
                const gradient = ctx.createLinearGradient(0, startY, 0, endY);
                gradient.addColorStop(0, `rgba(${bb.color}, 0)`);
                const midStop = (ch * bb.midY - startY) / (endY - startY);
                gradient.addColorStop(midStop, `rgba(${bb.color}, ${bb.midOpacity})`);
                gradient.addColorStop(1, `rgba(${bb.color}, ${bb.endOpacity})`);
                cache.gradient = gradient;
            } else {
                cache.gradient = null;
            }
        }

        // Fill dark backdrop FIRST — covers any letterbox area on mobile
        // and means the hero never reveals a light background.
        ctx.fillStyle = cache.bgColor;
        ctx.fillRect(0, 0, cw, ch);

        const canvasRatio = cw / ch;
        const imgRatio = iw / ih;

        let dw, dh, dx, dy;

        if (isMobile) {
            // Mobile: 'cover' lightly relaxed — the image still fills
            // almost the whole canvas, just zoomed out enough to reveal
            // more of the scooter (front wheel to rear) instead of only
            // the cropped middle strip. Tiny letterbox blends into the
            // dark backdrop.
            const coverScale = Math.max(cw / iw, ch / ih);
            const scale = coverScale * 0.88;
            dw = iw * scale;
            dh = ih * scale;
            dx = (cw - dw) / 2;
            dy = (ch - dh) / 2;
        } else if (CONFIG.fit === 'cover') {
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

        if (cache.gradient) {
            const startY = ch * CONFIG.bottomBand.startY;
            ctx.fillStyle = cache.gradient;
            ctx.fillRect(0, startY, cw, ch - startY);
        }
    };

    /* ============================================
       MAIN INIT
       ============================================ */
    const init = async () => {
        resizeCanvas();

        const state = {
            frames: [],
            count: 0,
            currentIndex: 0,
            currentImage: null,
        };

        // Debounced resize — avoids constantly recomputing the canvas
        // backing-store during the iOS URL-bar collapse, which was a
        // major source of the scroll-time jitter.
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                resizeCanvas();
                invalidateRenderCache();
                if (state.currentImage) renderFrame(state.currentImage);
            }, 120);
        }, { passive: true });

        // ============================================
        // STEP 1: Load FIRST frame immediately
        // Renders and hides preloader before probing/loading the rest.
        // ============================================
        const first = await loadOne(1);
        if (!first) {
            console.info(
                '[Frame Sequence] No frames detected in', CONFIG.folder,
                '— place files named "' + CONFIG.namePattern.replace('{n}', '001') + '" etc. and reload.'
            );
            return;
        }

        state.frames[0] = first;
        state.currentImage = first;
        canvas.classList.add('is-ready');
        renderFrame(first);

        if (placeholder) placeholder.classList.add('is-hidden');

        // Signal preloader: first frame is visible
        document.dispatchEvent(new CustomEvent('frame-sequence:first-frame'));

        // ============================================
        // STEP 2: Probe total count (parallel)
        // ============================================
        const count = await probeFrameCount();
        state.count = count;
        console.info('[Frame Sequence]', count, 'frames detected. Loading in background…');

        // ============================================
        // STEP 3: Hook into ScrollTrigger NOW
        // ============================================
        initScrollControl(state);

        // ============================================
        // STEP 4: Load remaining frames in background
        // ============================================
        loadFrames(count, state.frames, (p) => {
            if (p >= 1) {
                console.info('[Frame Sequence] All frames loaded.');
            }
        });
    };

    /* ============================================
       SCROLL CONTROL — scrub frame index with scroll
       ============================================ */
    const initScrollControl = (state) => {
        if (!window.gsap || !window.ScrollTrigger) {
            console.warn('[Frame Sequence] GSAP/ScrollTrigger not available.');
            return;
        }

        ScrollTrigger.create({
            trigger: heroSection,
            start: 'top top',
            end: () => `+=${window.innerHeight * CONFIG.scrollLength}`,
            pin: CONFIG.pin,
            pinSpacing: true,
            // Default 'fixed' pin works reliably across mobile browsers.
            // No anticipatePin — caused a visible pre-pin jump.
            scrub: isMobile ? 0.5 : 0.8,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
                if (state.count === 0) return;
                const targetIdx = Math.min(
                    state.count - 1,
                    Math.floor(self.progress * (state.count - 1))
                );
                // Fall back to nearest loaded frame at or below target index
                let idx = targetIdx;
                while (idx > 0 && !state.frames[idx]) idx--;

                if (idx !== state.currentIndex && state.frames[idx]) {
                    state.currentIndex = idx;
                    state.currentImage = state.frames[idx];
                    renderFrame(state.frames[idx]);
                }
            },
        });

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
