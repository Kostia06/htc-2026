// M37/M60 – light travelling around a card border: the radial blob behind the card loops
// through four positions once the card has scrolled into view.
import { loop, onceInView } from './motion.js';

export function borderLoop(wrapper, blob = wrapper.querySelector('.stats-card-gradient')) {
  if (!blob) return null;
  const tl = loop(blob, [
    [{ xPercent: 0, yPercent: 0 }, 0.5],
    [{ xPercent: 45 }, 1.5],
    [{ yPercent: 29 }, 1.5],
    [{ xPercent: 0, yPercent: 48 }, 1.5],
    [{ yPercent: 0 }, 1.5],
  ]);
  onceInView(wrapper, () => tl.play());
  return tl;
}
