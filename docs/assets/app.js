(() => {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('light');
    });
  }
  // Smooth scroll for on-page anchors
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id && id.length > 1) {
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Sidebar search filter
  const search = document.getElementById('doc-search');
  if (search) {
    const links = Array.from(document.querySelectorAll('.side a'));
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      links.forEach(l => {
        l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  // Build right-hand TOC from main content h2/h3
  const main = document.querySelector('main');
  const tocRoot = document.getElementById('toc');
  if (main && tocRoot) {
    const headings = Array.from(main.querySelectorAll('h2, h3'));
    const frag = document.createDocumentFragment();
    headings.forEach(h => {
      if (!h.id) h.id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      a.className = h.tagName === 'H2' ? 'level-2' : 'level-3';
      frag.appendChild(a);
    });
    tocRoot.appendChild(frag);

    // Active section highlighting
    const tocLinks = Array.from(tocRoot.querySelectorAll('a'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const link = tocLinks.find(l => l.getAttribute('href') === `#${entry.target.id}`);
        if (link && entry.isIntersecting) {
          tocLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '0px 0px -70% 0px', threshold: 0.1 });
    headings.forEach(h => observer.observe(h));
  }
})();


