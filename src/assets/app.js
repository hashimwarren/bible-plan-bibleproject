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

  // Mobile navigation toggle
  try {
    const menu = document.getElementById('menu-button');
    const nav = document.getElementById('main-nav');
    menu?.addEventListener('click', function(){
      const expanded = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      nav?.classList.toggle('hidden', expanded);
    });
  } catch {}

  const form = document.getElementById('scripture-form');
  const input = document.getElementById('scripture');
  const indexEl = document.getElementById('scriptureIndex');
  let index = [];
  try { index = JSON.parse(indexEl?.textContent || '[]'); } catch {}

  function findDaysForRef(ref) {
    if (!ref) return [];
    const q = String(ref).trim().toLowerCase();
    
    // First try exact match (existing behavior)
    let matches = index.filter(x => (x.ref||'').toLowerCase() === q);
    
    // If no exact match, try partial matching
    if (matches.length === 0) {
      // Handle verse references (e.g., "James 1:5" -> "James 1")
      const verseMatch = q.match(/^(.+?)\s+(\d+):.*$/);
      if (verseMatch) {
        const bookChapter = `${verseMatch[1]} ${verseMatch[2]}`;
        matches = index.filter(x => (x.ref||'').toLowerCase() === bookChapter);
      }
      
      // If still no match, try book name only (e.g., "James" -> "James 1")
      if (matches.length === 0) {
        matches = index.filter(x => {
          const ref = (x.ref||'').toLowerCase();
          return ref.startsWith(q + ' ') || 
                 (q.length > 2 && ref.includes(q)); // Fuzzy matching for longer queries
        });
        
        // For book-only searches, prefer the first chapter
        if (matches.length > 0) {
          const firstChapter = matches.find(x => {
            const ref = (x.ref||'').toLowerCase();
            return ref === q + ' 1' || ref.startsWith(q + ' 1 ');
          });
          if (firstChapter) {
            matches = [firstChapter];
          } else {
            // Take the first match if no chapter 1 found
            matches = [matches[0]];
          }
        }
      }
    }
    
    return matches.map(x => x.day);
  }

  form?.addEventListener('submit', function(e){
    if (!input?.value) return;
    
    const days = findDaysForRef(input.value);
    if (days.length > 0) {
      e.preventDefault();
      const day = days[0];
      window.location.href = '/day/' + day + '/';
    } else {
      // Provide user feedback for no matches
      e.preventDefault();
      const query = input.value.trim();
      
      // Show temporary feedback
      const originalPlaceholder = input.placeholder;
      input.placeholder = `No matches found for "${query}". Try "James 1" or "Genesis 1"`;
      input.value = '';
      input.style.borderColor = '#ef4444'; // red border
      
      // Reset after 3 seconds
      setTimeout(() => {
        input.placeholder = originalPlaceholder;
        input.style.borderColor = '';
      }, 3000);
      
      input.focus();
    }
  });

  // Minor UX: pressing Enter with empty field focuses it
  form?.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !input?.value) {
      input?.focus();
    }
  });
})();
