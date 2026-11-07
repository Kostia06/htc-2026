// CTA card border light. The original drives the same blob with three interactions; here they
// are composed instead of fighting over one transform:
//   M60 loop around the border          → xPercent / yPercent (modules/glow-loop.js)
//   M59 one-off sweep in from the left  → x  (-90% of the blob width → 0, 2s, at 10% in view)
//   M61 rises with the scroll           → y  (+100% of the blob height → 0 between 0 and 45%)
import { gsap, scrollKeyframes, onceInView } from './motion.js';
import { borderLoop } from './glow-loop.js';

export function initCta() {
  const section = document.querySelector('.section.is-cta');
  if (!section) return;
  const wrap = section.querySelector('.cta-wrap');
  const card = section.querySelector('.cta-card-wrapper');
  const blob = card.querySelector('.stats-card-gradient');

  borderLoop(wrap, blob);

  const width = () => blob.offsetWidth;
  const height = () => blob.offsetHeight;
  gsap.set(blob, { x: () => -0.9 * width() });
  onceInView(card, () => gsap.to(blob, { x: 0, duration: 2, ease: 'none' }), 10);

  scrollKeyframes(section, [
    [blob, 0, { y: height }],
    [blob, 45, { y: 0 }],
  ]);
}
