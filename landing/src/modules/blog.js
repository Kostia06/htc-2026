// Blog:
//   M53 heading fades in then out again, the articles fade in (desktop)
//   M54 heading mask on mobile (the mask is hidden on this page, kept for parity)
import { gsap, scrollKeyframes, MQ } from './motion.js';
import { maskOnView } from './reveal-mask.js';

export function initBlog() {
  const section = document.querySelector('.section.is-blog');
  if (!section) return;
  const mm = gsap.matchMedia();
  const heading = '.heading-2.text-align-center.max-w-55.text-color-white';

  mm.add(MQ.desktop, () => {
    scrollKeyframes(section, [
      [heading, 16, { opacity: 0 }],
      ['.collection-news-wrap', 16, { opacity: 0 }],
      [heading, 34, { opacity: 1 }],
      ['.collection-news-wrap', 34, { opacity: 1 }],
      [heading, 44, { opacity: 1 }],
      [heading, 52, { opacity: 0 }],
    ]);
  });

  mm.add(MQ.mobile, () => {
    maskOnView(section, section.querySelector('.shadow.vertical'), { from: -30, to: 30, duration: 1, offset: 20 });
  });
}
