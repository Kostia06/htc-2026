// M3 – Lenis smooth scrolling, synced with GSAP ScrollTrigger.
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './motion.js';

export function initSmoothScroll() {
  const lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    wheelMultiplier: 0.7,
    gestureOrientation: 'vertical',
    syncTouch: false,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // desktop always starts at the top
  window.addEventListener('load', () => {
    if (window.innerWidth > 767) setTimeout(() => lenis.scrollTo(0, { immediate: true }), 0);
  });

  for (const el of document.querySelectorAll('[data-lenis-start]')) el.addEventListener('click', () => lenis.start());
  for (const el of document.querySelectorAll('[data-lenis-stop]')) el.addEventListener('click', () => lenis.stop());

  return lenis;
}
