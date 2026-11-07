// M6 – logo lottie draws itself on hover.
//   dark logo: plays forward over 2s after a short delay, snaps back on leave
//   white logo: replays from the start at native speed
import { gsap } from './motion.js';
import { getLottie, setProgress } from './lottie.js';

export function initNavLogo() {
  const black = document.querySelector('.logo-black');
  const white = document.querySelector('.logo-white');

  if (black) {
    const state = { p: 0 };
    let tween;
    black.addEventListener('mouseenter', () => {
      tween?.kill();
      tween = gsap.to(state, {
        p: 1,
        duration: 2 * (1 - state.p),
        delay: 0.141,
        ease: 'none',
        onUpdate: () => setProgress(getLottie(black), state.p),
      });
    });
    black.addEventListener('mouseleave', () => {
      tween?.kill();
      state.p = 0;
      setProgress(getLottie(black), 0);
    });
  }

  white?.addEventListener('mouseenter', () => getLottie(white)?.goToAndPlay(0, true));
}
