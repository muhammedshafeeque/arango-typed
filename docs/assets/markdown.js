(async () => {
  // Load marked.js from CDN if not present
  if (!window.marked) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  const root = document.getElementById('md-root');
  if (!root) return;
  const src = root.getAttribute('data-src');
  if (!src) { root.innerHTML = '<p>Missing data-src for markdown.</p>'; return; }
  try {
    const res = await fetch(src);
    const text = await res.text();
    const html = window.marked.parse(text);
    root.innerHTML = html;
  } catch (e) {
    root.innerHTML = '<p>Failed to load content.</p>';
  }
})();


