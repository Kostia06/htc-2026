// M8–M11 – a dot (.explode) follows the cursor inside a button and scales up to fill it.

const GROUPS = [
  { selector: '.nav_link-c', scale: 50, textColor: 'white' },
  { selector: '.nav_link-cta', scale: 70, textColor: '#fff' },
  { selector: '.social-footer', scale: 20 },
];

function bind(button, { scale, textColor }) {
  const dot = button.querySelector('.explode');
  const text = button.querySelector('.btn-text');
  if (!dot) return;
  button.addEventListener('mousemove', (e) => {
    const r = button.getBoundingClientRect();
    dot.style.left = `${e.clientX - r.left}px`;
    dot.style.top = `${e.clientY - r.top}px`;
    dot.style.transform = `scale(${scale})`;
    dot.style.opacity = '1';
    if (text && textColor) text.style.color = textColor;
  });
  button.addEventListener('mouseleave', () => {
    dot.style.transform = 'scale(.1)';
    if (text && textColor) text.style.color = '';
  });
  // M11: hide the dot once it has shrunk back (it rests at scale .1)
  dot.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform' && dot.style.transform === 'scale(.1)') dot.style.opacity = '0';
  });
}

export function initExplode() {
  for (const g of GROUPS) for (const el of document.querySelectorAll(g.selector)) bind(el, g);
  // resting dots are invisible from the start
  for (const dot of document.querySelectorAll('.explode')) dot.style.opacity = '0';
}
