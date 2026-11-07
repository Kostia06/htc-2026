// Mobile heading masks (M36, M44, M51, M54, M57): a gradient mask slides down over a heading
// once the section scrolls into view.
import { gsap, onceInView } from './motion.js';

export function maskOnView(section, mask, { from, to, duration, offset = 0 }) {
  if (!section || !mask) return;
  gsap.set(mask, { yPercent: from });
  onceInView(section, () => gsap.to(mask, { yPercent: to, duration, ease: 'none' }), offset);
}
