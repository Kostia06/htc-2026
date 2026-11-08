// M12 – social tiles drift a few pixels towards the cursor.
const STRENGTH = 10;

export function initMagnetic() {
  for (const el of document.querySelectorAll('.social-footer-wrap')) {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - (r.left + r.width / 2)) / r.width) * STRENGTH;
      const dy = ((e.clientY - (r.top + r.height / 2)) / r.height) * STRENGTH;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    el.addEventListener('mouseleave', () => (el.style.transform = 'translate(0, 0)'));
  }
}
