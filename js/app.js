/* ============================================
   GoO Elétricos — Main App
   Nav behavior, reveal animations, preloader
   ============================================ */

(() => {
    'use strict';

    // Register GSAP plugins
    if (window.gsap) {
        if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
        if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);
    }

    /* ============================================
       LENIS — cinematic smooth scroll (~40% slower feel)
       Synced with GSAP ScrollTrigger
       ============================================ */
    let lenis = null;
    const initSmoothScroll = () => {
        if (typeof Lenis === 'undefined') return;

        // Disable on touch devices for native momentum
        const isTouch = matchMedia('(hover: none)').matches;
        if (isTouch) return;

        lenis = new Lenis({
            duration: 1.8,             // higher = heavier/slower
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.6,      // 40% slower wheel response — cinematic
            touchMultiplier: 1.2,
            lerp: 0.08,
            infinite: false,
        });

        // Drive Lenis via GSAP ticker for perfect sync with ScrollTrigger
        if (window.gsap) {
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (time) => {
                lenis.raf(time);
                requestAnimationFrame(raf);
            };
            requestAnimationFrame(raf);
        }

        // ScrollTrigger uses window scroll — Lenis updates it natively, so ScrollTrigger
        // just needs to know to refresh on each Lenis scroll event.
        if (window.ScrollTrigger) {
            lenis.on('scroll', ScrollTrigger.update);
        }

        window.lenis = lenis;
    };

    /* ============================================
       SMOOTH ANCHOR SCROLL — cinematic, long-duration
       ============================================ */
    const initAnchorScroll = () => {
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener('click', (e) => {
                const targetId = anchor.getAttribute('href');
                if (targetId === '#' || !targetId) return;
                const target = document.querySelector(targetId);
                if (!target) return;
                e.preventDefault();

                // Prefer Lenis for unified smooth scroll
                if (lenis) {
                    lenis.scrollTo(target, { offset: -80, duration: 1.8 });
                } else if (window.gsap && window.ScrollToPlugin) {
                    gsap.to(window, {
                        scrollTo: { y: target, offsetY: 80, autoKill: true },
                        duration: 1.6,
                        ease: 'power3.inOut',
                    });
                } else {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    };

    /* ============================================
       NAV SCROLL EFFECT
       ============================================ */
    const initNav = () => {
        const nav = document.getElementById('nav');
        if (!nav) return;

        const updateNav = () => {
            if (window.scrollY > 20) {
                nav.classList.add('is-scrolled');
            } else {
                nav.classList.remove('is-scrolled');
            }
        };

        window.addEventListener('scroll', updateNav, { passive: true });
        updateNav();
    };

    /* ============================================
       PRELOADER
       ============================================ */
    const initPreloader = () => {
        const preloader = document.getElementById('preloader');
        const progress = document.getElementById('preloaderProgress');
        const label = document.getElementById('preloaderLabel');

        if (!preloader || !progress) return;

        let pct = 0;
        const messages = [
            'Carregando experiência',
            'Renderizando elementos',
            'Quase lá',
        ];

        const tick = () => {
            pct += Math.random() * 8 + 2;
            if (pct > 95) pct = 95;
            progress.style.width = `${pct}%`;

            if (pct < 95) {
                if (pct > 60 && label) label.textContent = messages[2];
                else if (pct > 30 && label) label.textContent = messages[1];
                setTimeout(tick, 180);
            }
        };

        tick();

        const completeLoader = () => {
            progress.style.width = '100%';
            if (label) label.textContent = 'Pronto';
            setTimeout(() => {
                preloader.classList.add('is-done');
                document.body.classList.add('is-loaded');
                introAnimations();
            }, 500);
        };

        if (document.readyState === 'complete') {
            setTimeout(completeLoader, 1200);
        } else {
            window.addEventListener('load', () => setTimeout(completeLoader, 1200));
        }
    };

    /* ============================================
       INTRO ANIMATIONS — runs after preloader
       ============================================ */
    const introAnimations = () => {
        if (!window.gsap) return;

        const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

        tl.from('.nav', {
            y: -40,
            opacity: 0,
            duration: 1,
        })
        .from('.hero__eyebrow', {
            y: 30,
            opacity: 0,
            duration: 0.9,
        }, '-=0.6')
        .from('.hero__title-line', {
            y: 120,
            opacity: 0,
            duration: 1.2,
            stagger: 0.12,
        }, '-=0.7')
        .from('.hero__subtitle', {
            y: 30,
            opacity: 0,
            duration: 0.9,
        }, '-=0.7')
        .from('.hero__actions > *', {
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
        }, '-=0.5')
        .from('.hero__meta-item', {
            y: 20,
            opacity: 0,
            duration: 0.8,
            stagger: 0.08,
        }, '-=0.6')
        .from('.hero__scroll-hint', {
            opacity: 0,
            duration: 0.8,
        }, '-=0.4');
    };

    /* ============================================
       SCROLL-TRIGGERED REVEALS
       ============================================ */
    const initReveals = () => {
        if (!window.gsap || !window.ScrollTrigger) return;

        const titles = document.querySelectorAll(
            '.manifesto__title, .viewer__title, .features__title, .models__title, .sustainability__title, .cta__title'
        );

        titles.forEach((title) => {
            gsap.from(title, {
                scrollTrigger: {
                    trigger: title,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse',
                },
                y: 60,
                opacity: 0,
                duration: 1.2,
                ease: 'power4.out',
            });
        });

        document.querySelectorAll('.section-eyebrow').forEach((el) => {
            gsap.from(el, {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 90%',
                    toggleActions: 'play none none reverse',
                },
                y: 20,
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out',
            });
        });

        document.querySelectorAll('.manifesto__text, .viewer__subtitle, .sustainability__text, .cta__text').forEach((el) => {
            gsap.from(el, {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 88%',
                    toggleActions: 'play none none reverse',
                },
                y: 40,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                delay: 0.15,
            });
        });

        gsap.from('.feature', {
            scrollTrigger: {
                trigger: '.features__grid',
                start: 'top 80%',
                toggleActions: 'play none none reverse',
            },
            y: 60,
            opacity: 0,
            duration: 0.9,
            stagger: 0.08,
            ease: 'power3.out',
        });

        gsap.from('.model', {
            scrollTrigger: {
                trigger: '.models__grid',
                start: 'top 80%',
                toggleActions: 'play none none reverse',
            },
            y: 80,
            opacity: 0,
            duration: 1.1,
            stagger: 0.12,
            ease: 'power3.out',
        });

        gsap.from('.viewer__spec', {
            scrollTrigger: {
                trigger: '.viewer__specs',
                start: 'top 90%',
                toggleActions: 'play none none reverse',
            },
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power3.out',
        });

        gsap.from('.sustainability__stat', {
            scrollTrigger: {
                trigger: '.sustainability__stats',
                start: 'top 85%',
                toggleActions: 'play none none reverse',
            },
            y: 30,
            opacity: 0,
            duration: 0.9,
            stagger: 0.12,
            ease: 'power3.out',
        });

        gsap.from('.cta__actions > *', {
            scrollTrigger: {
                trigger: '.cta__actions',
                start: 'top 85%',
                toggleActions: 'play none none reverse',
            },
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power3.out',
        });

        gsap.from('.cta__contact-item', {
            scrollTrigger: {
                trigger: '.cta__contact',
                start: 'top 88%',
                toggleActions: 'play none none reverse',
            },
            y: 20,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power3.out',
        });

        /* Hero content parallax */
        gsap.to('.hero__content', {
            y: -80,
            opacity: 0.4,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero',
                start: 'top top',
                end: 'bottom top',
                scrub: 1.5,
            },
        });
    };

    /* ============================================
       MARQUEE — pause on hover
       ============================================ */
    const initMarquee = () => {
        const track = document.querySelector('.marquee__track');
        if (!track) return;

        const marquee = document.querySelector('.marquee');
        marquee.addEventListener('mouseenter', () => {
            track.style.animationPlayState = 'paused';
        });
        marquee.addEventListener('mouseleave', () => {
            track.style.animationPlayState = 'running';
        });
    };

    /* ============================================
       MOBILE BURGER
       ============================================ */
    const initBurger = () => {
        const burger = document.getElementById('navBurger');
        const menu = document.querySelector('.nav__menu');
        if (!burger || !menu) return;

        burger.addEventListener('click', () => {
            menu.classList.toggle('is-open');
            burger.classList.toggle('is-open');
        });
    };

    /* ============================================
       INIT
       ============================================ */
    const init = () => {
        initSmoothScroll();
        initPreloader();
        initNav();
        initAnchorScroll();
        initMarquee();
        initBurger();

        requestAnimationFrame(() => {
            initReveals();
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.GooApp = { introAnimations };
})();
