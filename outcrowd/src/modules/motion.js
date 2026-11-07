// Shared animation helpers: GSAP setup + a "scroll keyframes" builder that reproduces the
// original "while scrolling in view" interactions (progress 0 = element top at the viewport
// bottom, 1 = element bottom at the viewport top; values interpolated between keyframes).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
// exposed for the screenshot tooling (tools/lib/capture.mjs completes time-based tweens)
window.gsap = gsap;

export { gsap, ScrollTrigger };

/** Unit helpers returning functions, so values are re-measured on resize (invalidateOnRefresh). */
const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
export const vw = (n) => () => (n * window.innerWidth) / 100;
export const vh = (n) => () => (n * window.innerHeight) / 100;
export const rem = (n) => () => n * rootPx();

export const MQ = {
  desktop: '(min-width: 768px)', // IX "main" + "medium"
  wide: '(min-width: 992px)', // IX "main"
  mobile: '(max-width: 767px)', // IX "small" + "tiny"
  tiny: '(max-width: 479px)',
};

export const EASE = {
  ease: 'power1.inOut', // close to css "ease"
  easeInOut: 'power1.inOut',
  outExpo: 'expo.out',
};

/**
 * Build a scrubbed timeline from keyframes.
 * @param {Element} trigger
 * @param {Array<[Element|Element[]|string, number, object, string?]>} frames
 *        [targets, percent, {prop: value}, ease?] — each property is tweened from its previous
 *        keyframe to this one; before its first keyframe a property holds the first value.
 */
export function scrollKeyframes(trigger, frames, { scrub = 0.15, start = 'top bottom', end = 'bottom top' } = {}) {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger, start, end, scrub, invalidateOnRefresh: true },
  });
  const tracks = new Map(); // key: target + prop → [{p, v, ease}]
  // string targets are looked up inside the trigger (like the original "children" targets)
  const targetsOf = (t) => (typeof t === 'string' ? gsap.utils.toArray(trigger.querySelectorAll(t)) : gsap.utils.toArray(t));
  for (const [t, p, props, ease] of frames) {
    for (const el of targetsOf(t)) {
      for (const [prop, v] of Object.entries(props)) {
        if (!tracks.has(el)) tracks.set(el, new Map());
        const m = tracks.get(el);
        if (!m.has(prop)) m.set(prop, []);
        m.get(prop).push({ p, v, ease });
      }
    }
  }
  for (const [el, m] of tracks) {
    for (const [prop, keys] of m) {
      keys.sort((a, b) => a.p - b.p);
      tl.set(el, { [prop]: keys[0].v }, 0);
      for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1], b = keys[i];
        tl.fromTo(el, { [prop]: a.v }, { [prop]: b.v, duration: b.p - a.p, ease: b.ease || 'none', immediateRender: false }, a.p);
      }
    }
  }
  tl.set({}, {}, 100);
  return tl;
}

/**
 * Infinite loop through absolute keyframes (the original "loop" interactions).
 * steps: [[props, durationSeconds], ...]; the first step is also the initial state.
 */
export function loop(targets, steps, { ease = 'none' } = {}) {
  const tl = gsap.timeline({ repeat: -1, paused: true, defaults: { ease } });
  gsap.set(targets, steps[0][0]);
  for (const [props, duration] of steps) tl.to(targets, { ...props, duration });
  return tl;
}

/** Run `fn` once when `el` scrolls into view (top crosses `offset`% from the viewport bottom). */
export function onceInView(el, fn, offset = 0) {
  return ScrollTrigger.create({ trigger: el, start: `top ${100 - offset}%`, once: true, onEnter: fn });
}
