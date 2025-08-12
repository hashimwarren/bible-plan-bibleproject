(function(){
  // Subtle header compaction on scroll
  try {
    const header = document.querySelector('header');
    let last = 0;
    function onScroll(){
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const compact = y > 8;
      if (compact !== (header?.dataset.compact === '1')) {
        if (header) {
          header.dataset.compact = compact ? '1' : '0';
          header.classList.toggle('py-2', compact);
          header.classList.toggle('py-3', !compact);
        }
      }
      last = y;
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  } catch {}

  const form = document.getElementById('scripture-form');
  const input = document.getElementById('scripture');
  const indexEl = document.getElementById('scriptureIndex');
  let index = [];
  try { index = JSON.parse(indexEl?.textContent || '[]'); } catch {}

  function findDaysForRef(ref) {
    if (!ref) return [];
    const q = String(ref).trim().toLowerCase();
    return index.filter(x => (x.ref||'').toLowerCase() === q).map(x => x.day);
  }

  form?.addEventListener('submit', function(e){
    if (!input?.value) return;
    const days = findDaysForRef(input.value);
    if (days.length > 0) {
      e.preventDefault();
      const day = days[0];
      window.location.href = '/day/' + day + '/';
    }
  });

  // Minor UX: pressing Enter with empty field focuses it
  form?.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !input?.value) {
      input?.focus();
    }
  });
})();
