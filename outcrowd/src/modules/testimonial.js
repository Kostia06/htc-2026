// Testimonials:
//   M48 "Clients speak out / about us on [C]" collapses into "on [Clutch]" while scrolling down
//   M49 reviews slider (Swiper, looped, 2.25 slides from 767px) + dark hover on slides
import Swiper, { Mousewheel, Keyboard } from 'swiper';

function initClutchMorph(section) {
  if (window.innerWidth <= 767) return;
  const aboutUs = section.querySelector('.heading-2.text-align-center.size');
  const fullLogo = section.querySelector('.icon-clutch-full-icon');
  const firstLine = section.querySelector('.first-line-testimoniall');
  const smallLogo = section.querySelector('.icon-clutch-small');
  const line = section.querySelector('.heading-wrap-testimoniall');
  const logoBox = section.querySelector('.icon-clutch-full');
  const header = section.querySelector('.header-block');

  const expanded = () => {
    Object.assign(aboutUs.style, { width: '19.5rem', opacity: '1' });
    fullLogo.style.opacity = '0';
    Object.assign(firstLine.style, { height: '4vw', transform: 'scale(1)', opacity: '1' });
    smallLogo.style.opacity = '1';
    line.style.width = '33rem';
    Object.assign(logoBox.style, { width: '3.875vw', opacity: '1' });
  };
  const collapsed = () => {
    Object.assign(aboutUs.style, { width: '0rem', opacity: '0', transition: 'width 0.5s ease, opacity 0.4s ease' });
    Object.assign(fullLogo.style, { opacity: '1', transition: 'opacity 0.7s ease' });
    Object.assign(firstLine.style, {
      height: '0vw',
      transform: 'scale(0.4)',
      opacity: '0',
      transition: 'height 0.7s ease, transform 0.7s ease, opacity 0.3s ease',
    });
    Object.assign(smallLogo.style, { opacity: '0', transition: 'opacity 0.5s ease' });
    Object.assign(line.style, { width: '4rem', transition: 'width 0.7s ease' });
    Object.assign(logoBox.style, { width: '16.6vw', opacity: '1', transition: 'width 0.7s ease, opacity 0.7s ease' });
  };

  expanded();
  let last = 0;
  window.addEventListener(
    'scroll',
    () => {
      const r = header.getBoundingClientRect();
      const mark = window.innerHeight / 5;
      if (r.top <= mark && r.bottom >= mark) (window.scrollY > last ? collapsed : expanded)();
      last = window.scrollY;
    },
    { passive: true },
  );
}

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
  initClutchMorph(section);
  initSlider(section);
}
