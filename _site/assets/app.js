(function(){
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
})();
