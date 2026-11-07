// Stats cards:
//   M25 desktop: the four cards fly in rotated from the sides, black side masks follow
//   M26 mobile: heading fade
//   M27 light travelling around each card border (loop)
import { gsap, scrollKeyframes, loop, onceInView, rem, vw, MQ } from './motion.js';

export function initCards() {
  const section = document.querySelector('.section.bg-dark.cards');
  if (!section) return;
  const mm = gsap.matchMedia();

  mm.add(MQ.desktop, () => {
    const c1 = '.stats-card-wrapper.img-list-set-1';
    const c2 = '.stats-card-wrapper.set-2';
    const c3 = '.stats-card-wrapper.set-3';
    const c4 = '.stats-card-wrapper.set-4';
    const lt = '.left-stat-gradient.top', lb = '.left-stat-gradient.bot';
    const rt = '.right-stat-gradient.top', rb = '.right-stat-gradient.bot';
    scrollKeyframes(section, [
      [c1, 20, { x: rem(-30), rotation: -15 }],
      [lt, 20, { width: rem(60) }],
      [c3, 29, { x: rem(28), y: rem(5.69), rotation: 15 }],
      [rt, 29, { width: rem(60) }],
      [c2, 33, { x: rem(-23), y: rem(5), rotation: -15 }],
      [lb, 33, { width: rem(60) }],
      [lt, 33, { opacity: 1 }],
      [c1, 38, { x: rem(0), rotation: 0 }],
      [lt, 38, { width: rem(23), opacity: 0 }],
      [c4, 42, { x: rem(28), y: rem(10.69), rotation: 15 }],
      [rb, 42, { width: rem(60) }],
      [rt, 42, { opacity: 1 }],
      [c3, 46, { x: rem(0), y: rem(5.69), rotation: 0 }],
      [rt, 46, { width: rem(23), opacity: 1 }],
      [lb, 47, { opacity: 1 }],
      [c2, 52, { x: rem(0), y: rem(0), rotation: 0 }],
      [lb, 52, { width: rem(23), opacity: 0 }],
      [rb, 56, { opacity: 1 }],
      [c4, 62, { x: rem(0), y: rem(5.69), rotation: 0 }],
      [rb, 62, { width: rem(23), opacity: 0 }],
    ]);
  });

  mm.add(MQ.mobile, () => {
    scrollKeyframes(section, [
      ['.anim-heading-home', 4, { opacity: 0 }],
      ['.anim-heading-home', 25, { opacity: 1 }],
    ]);
  });

  for (const card of section.querySelectorAll('.stats-card-wrapper')) {
    const glow = loop(card.querySelector('.stats-card-gradient'), [
      [{ x: vw(-20), y: vw(17) }, 2],
      [{ x: vw(29), y: vw(10) }, 2],
      [{ x: vw(17), y: vw(26) }, 2],
      [{ x: vw(-2), y: vw(26) }, 1],
    ]);
    onceInView(card, () => glow.play());
  }
}
