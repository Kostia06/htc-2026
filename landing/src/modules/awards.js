// Awards:
//   M50 heading + list fade in while scrolling (desktop)
//   M51 heading mask on mobile
//   (the CSS handles the row hover visuals, M52)
import { gsap, scrollKeyframes, MQ } from './motion.js';
import { maskOnView } from './reveal-mask.js';

export function initAwards() {
  const section = document.querySelector('.section.is-awwards');
  if (!section) return;
  const mm = gsap.matchMedia();

  mm.add(MQ.desktop, () => {
    scrollKeyframes(section, [
      ['.heading-2.text-align-center.max-w-55', 20, { opacity: 0 }],
      ['.awards-list', 20, { opacity: 0 }],
      ['.awards-list', 30, { opacity: 1 }],
      ['.heading-2.text-align-center.max-w-55', 32, { opacity: 1 }],
    ]);
  });

  mm.add(MQ.mobile, () => {
    maskOnView(section, section.querySelector('.shadow.vertical'), { from: -40, to: 30, duration: 1 });
  });
}
