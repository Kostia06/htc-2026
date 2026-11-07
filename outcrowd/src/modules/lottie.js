// Lottie players for every [data-lottie] element.
//   data-lottie="/lottie/x.json"   animation file
//   data-lottie-autoplay           play on load
//   data-lottie-loop               loop
// Animations without autoplay are driven by other modules through getLottie(el).
// light build: SVG renderer without the expressions engine (none of the animations use expressions)
import lottie from 'lottie-web/build/player/lottie_light';

const players = new Map();

export function initLotties(root = document) {
  for (const el of root.querySelectorAll('[data-lottie]')) {
    if (players.has(el)) continue;
    const anim = lottie.loadAnimation({
      container: el,
      path: el.dataset.lottie,
      renderer: 'svg',
      loop: el.hasAttribute('data-lottie-loop'),
      autoplay: el.hasAttribute('data-lottie-autoplay'),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    });
    players.set(el, anim);
  }
  // exposed for the screenshot tooling (tools/lib/capture.mjs freezes every player)
  window.lottie = lottie;
}

export function getLottie(el) {
  return el ? players.get(el) : undefined;
}

/** Resolves once the animation data is loaded (totalFrames known). */
export function whenLoaded(anim) {
  return new Promise((resolve) => {
    if (!anim) return;
    if (anim.isLoaded) resolve(anim);
    else anim.addEventListener('DOMLoaded', () => resolve(anim));
  });
}

/** Show a given progress (0..1) of a paused animation. */
export function setProgress(anim, p) {
  if (!anim || !anim.isLoaded) return;
  anim.goToAndStop(p * (anim.totalFrames - 1), true);
}

/**
 * Endless sequence of lottie progress tweens (the original "lottie loop" interactions).
 * steps: [[progressPercent, durationSeconds, delaySeconds?], ...]
 */
export function lottieLoop(anim, steps, gsap) {
  const state = { p: 0 };
  const render = () => setProgress(anim, state.p / 100);
  const tl = gsap.timeline({ repeat: -1, paused: true, defaults: { ease: 'none', onUpdate: render } });
  for (const [p, duration, delay = 0] of steps) {
    if (duration) tl.to(state, { p, duration, delay });
    else tl.set(state, { p, onComplete: render }, `+=${delay}`);
  }
  return tl;
}
