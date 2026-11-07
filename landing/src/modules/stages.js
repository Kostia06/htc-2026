// "Stages of startup development":
//   M29/M30 heading fades in and out while it passes
//   M31 sticky scroller: stage texts scroll up, the screenshot wheel rotates and cross-fades
//   M33 small offset for 800–840px tall viewports
import { gsap, scrollKeyframes, MQ } from './motion.js';

export function initStages() {
  const heading = document.querySelector('.case--new-heading-wrap:not(._2)');
  const scroller = document.querySelector('.height-cases');
  if (!heading || !scroller) return;
  const mm = gsap.matchMedia();

  mm.add(MQ.desktop, () => {
    // M29
    scrollKeyframes(heading, [
      ['.case--new-heading', 20, { opacity: 0 }],
      ['.case--new-heading', 52, { opacity: 1 }],
      ['.case--new-heading', 61, { opacity: 1 }],
      ['.case--new-heading', 84, { opacity: 0 }],
    ]);

    // M31
    const wheel = '.rotate-ellipse-2';
    const texts = '.cards-cases-left-wrap';
    const img = (n) => `.case-rotate-img.set-${n}`;
    scrollKeyframes(scroller, [
      [wheel, 8, { rotation: -31, y: 0 }],
      ['.top-gradient', 8, { opacity: 1 }],
      ['.case--new-heading', 14, { opacity: 0 }],
      [texts, 19, { y: 0, yPercent: 25 }],
      [wheel, 19, { rotation: -31 }],
      ['.case--new-heading', 20, { opacity: 1 }],
      ['.case--new-heading-wrap', 22, { yPercent: 0 }],
      [img(1), 30, { opacity: 0 }],
      [img(2), 30, { opacity: 0 }],
      [img(1), 35, { opacity: 1 }],
      [wheel, 38, { rotation: -14, yPercent: 8 }],
      ['.case--new-heading-wrap', 39, { yPercent: -112 }],
      [img(1), 46, { opacity: 1 }],
      [img(2), 50, { opacity: 0 }],
      [img(3), 50, { opacity: 0 }],
      [img(1), 54, { opacity: 0 }],
      [img(2), 58, { opacity: 1 }],
      [wheel, 60, { rotation: 0, yPercent: 3 }],
      [img(2), 63, { opacity: 1 }],
      [img(3), 67, { opacity: 0 }],
      [img(2), 71, { opacity: 0 }],
      [img(3), 77, { opacity: 1 }],
      [texts, 80, { yPercent: -79 }],
      [wheel, 80, { rotation: 14, yPercent: -2 }],
      ['.cards-cases-right', 89, { backgroundColor: 'rgb(23, 23, 23)' }],
      ['.cards-cases-left', 89, { opacity: 1 }],
      ['.top-gradient', 89, { opacity: 1 }],
      ['.cards-cases-right', 94, { backgroundColor: 'rgb(8, 8, 8)' }],
      ['.cards-cases-left', 94, { opacity: 0 }],
      ['.top-gradient', 94, { opacity: 0 }],
    ]);
  });

  // M30
  mm.add(MQ.mobile, () => {
    scrollKeyframes(heading, [
      ['.case--new-heading', 20, { opacity: 0 }],
      ['.case--new-heading', 52, { opacity: 1 }],
      ['.case--new-heading', 76, { opacity: 0 }],
      [scroller, 55, { opacity: 0 }],
      [scroller, 70, { opacity: 1 }],
    ]);
  });

  // M33
  const wrap = document.querySelector('.cards-cases-left-wrap');
  const checkHeight = () => wrap?.classList.toggle('height', window.innerHeight >= 800 && window.innerHeight <= 840);
  window.addEventListener('load', checkHeight);
  window.addEventListener('resize', checkHeight);
}
