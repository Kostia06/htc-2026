// "Why not just apply?":
//   M49 contrast-card slider (Swiper, looped, 2.25 slides from 767px) + dark hover on slides
import Swiper, { Mousewheel, Keyboard } from 'swiper';

function initSlider(section) {
  const slides = section.querySelectorAll('.swiper-slide');
  for (const slide of slides) {
    slide.style.width = '600px';
    const transition = 'background-color 0.7s ease, color 0.3s ease';
    slide.addEventListener('mouseenter', () => Object.assign(slide.style, { transition, backgroundColor: '#080808', color: '#FFFFFF' }));
    slide.addEventListener('mouseleave', () => Object.assign(slide.style, { transition, backgroundColor: '#F5F5F5', color: '#080808' }));
  }
  return new Swiper(section.querySelector('.swiper'), {
    modules: [Mousewheel, Keyboard],
    speed: 2100,
    slidesPerView: 1,
    spaceBetween: 14,
    allowTouchMove: true,
    loop: true,
    mousewheel: { forceToAxis: true, sensitivity: 1 },
    keyboard: true,
    simulateTouch: true,
    touchRatio: 1,
    touchAngle: 45,
    breakpoints: { 767: { slidesPerView: 2.25, spaceBetween: 10 } },
  });
}

export function initTestimonial() {
  const section = document.querySelector('.section.is-testimonial');
  if (!section) return;
  initSlider(section);
}
