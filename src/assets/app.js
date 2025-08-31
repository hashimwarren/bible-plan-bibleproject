(function(){
  'use strict';

  // Utility functions
  const utils = {
    safeExecute(fn) {
      try {
        return fn();
      } catch (error) {
        console.warn('Script error:', error);
      }
    },
    
    toggleNavigation(menuButton, nav, isOpen) {
      menuButton.setAttribute('aria-expanded', String(isOpen));
      nav.classList.toggle('hidden', !isOpen);
      nav.classList.toggle('mobile-nav-open', isOpen);
    }
  };

  // Header scroll effects
  utils.safeExecute(() => {
    const header = document.querySelector('header');
    if (!header) return;

    let lastScrollY = 0;
    
    function updateHeaderState() {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const shouldCompact = currentScrollY > 8;
      const isCompact = header.dataset.compact === '1';
      
      if (shouldCompact !== isCompact) {
        header.dataset.compact = shouldCompact ? '1' : '0';
        header.classList.toggle('py-2', shouldCompact);
        header.classList.toggle('py-3', !shouldCompact);
      }
      
      lastScrollY = currentScrollY;
    }
    
    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
  });

  // Mobile navigation
  utils.safeExecute(() => {
    const menuButton = document.getElementById('menu-button');
    const nav = document.getElementById('main-nav');
    
    if (!menuButton || !nav) return;

    function closeNavigation() {
      utils.toggleNavigation(menuButton, nav, false);
    }

    function openNavigation() {
      utils.toggleNavigation(menuButton, nav, true);
    }

    // Toggle on button click
    menuButton.addEventListener('click', function() {
      const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        closeNavigation();
      } else {
        openNavigation();
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!menuButton.contains(e.target) && !nav.contains(e.target)) {
        closeNavigation();
      }
    });

    // Close menu when pressing escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        closeNavigation();
        menuButton.focus();
      }
    });

    // Close menu when navigating to a new page
    nav.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') {
        closeNavigation();
      }
    });
  });

  // Scripture search functionality with async loading
  utils.safeExecute(() => {
    const form = document.getElementById('scripture-form');
    const input = document.getElementById('scripture');
    
    if (!form || !input) return;

    let scriptureIndex = [];
    let isIndexLoaded = false;

    // Load scripture index asynchronously
    async function loadScriptureIndex() {
      if (isIndexLoaded) return;
      
      try {
        const response = await fetch('/api/scripture-index.json');
        if (response.ok) {
          scriptureIndex = await response.json();
          isIndexLoaded = true;
          
          // Create datalist for autocomplete
          const datalist = document.createElement('datalist');
          datalist.id = 'scriptures';
          scriptureIndex.forEach(item => {
            const option = document.createElement('option');
            option.value = item.ref;
            datalist.appendChild(option);
          });
          document.body.appendChild(datalist);
          input.setAttribute('list', 'scriptures');
        }
      } catch (error) {
        console.warn('Failed to load scripture index:', error);
      }
    }

    // Load index on first focus for better performance
    input.addEventListener('focus', loadScriptureIndex, { once: true });

    function findDaysForRef(ref) {
      if (!ref || !isIndexLoaded) return [];
      
      const query = String(ref).trim().toLowerCase();
      
      // Try exact match first
      let matches = scriptureIndex.filter(item => 
        (item.ref || '').toLowerCase() === query
      );
      
      // Try partial matching if no exact match
      if (matches.length === 0) {
        // Handle verse references (e.g., "James 1:5" -> "James 1")
        const verseMatch = query.match(/^(.+?)\s+(\d+):.*$/);
        if (verseMatch) {
          const bookChapter = `${verseMatch[1]} ${verseMatch[2]}`;
          matches = scriptureIndex.filter(item => 
            (item.ref || '').toLowerCase() === bookChapter
          );
        }
        
        // Try book name matching if still no match
        if (matches.length === 0) {
          matches = scriptureIndex.filter(item => {
            const itemRef = (item.ref || '').toLowerCase();
            return itemRef.startsWith(query + ' ') || 
                   (query.length > 2 && itemRef.includes(query));
          });
          
          // Prefer first chapter for book-only searches
          if (matches.length > 0) {
            const firstChapterMatch = matches.find(item => {
              const itemRef = (item.ref || '').toLowerCase();
              return itemRef === query + ' 1' || itemRef.startsWith(query + ' 1 ');
            });
            
            matches = firstChapterMatch ? [firstChapterMatch] : [matches[0]];
          }
        }
      }
      
      return matches.map(item => item.day);
    }

    function showSearchFeedback(message, isError = false) {
      const originalPlaceholder = input.placeholder;
      input.placeholder = message;
      input.value = '';
      
      if (isError) {
        input.style.borderColor = '#ef4444';
      }
      
      setTimeout(() => {
        input.placeholder = originalPlaceholder;
        input.style.borderColor = '';
      }, 3000);
      
      input.focus();
    }

    // Handle form submission
    form.addEventListener('submit', function(e) {
      if (!input.value) return;
      
      const matchingDays = findDaysForRef(input.value);
      
      if (matchingDays.length > 0) {
        e.preventDefault();
        window.location.href = `/day/${matchingDays[0]}/`;
      } else {
        e.preventDefault();
        const query = input.value.trim();
        showSearchFeedback(
          `No matches found for "${query}". Try "James 1" or "Genesis 1"`,
          true
        );
      }
    });

    // Focus input when pressing Enter on empty field
    form.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !input.value) {
        input.focus();
      }
    });
  });

  // Load more days functionality
  utils.safeExecute(() => {
    const loadMoreBtn = document.getElementById('load-more-days');
    const daysGrid = document.getElementById('days-grid');
    const remainingDataEl = document.getElementById('remaining-days-data');
    
    if (!loadMoreBtn || !daysGrid || !remainingDataEl) return;

    let remainingDays = [];
    try {
      remainingDays = JSON.parse(remainingDataEl.textContent || '[]');
    } catch (error) {
      console.warn('Failed to parse remaining days data:', error);
      return;
    }

    let currentLoaded = parseInt(loadMoreBtn.dataset.loaded, 10) || 30;
    const batchSize = 30;

    function createDayCard(day) {
      return `
        <div class="border border-border p-3 rounded-sm">
          <div class="flex items-center justify-between">
            <div class="font-medium">Day ${day.day}</div>
            <div class="flex items-center gap-1.5">
              ${day.hasJustice ? '<span class="text-sm" title="Justice scripture present">⭐</span>' : ''}
              ${day.hasVideos ? '<span class="text-sm" title="Has video">🎬</span>' : ''}
            </div>
          </div>
          <div class="mt-1 text-sm text-text-secondary">OT: ${day.otReading}</div>
          <div class="text-sm text-text-secondary">NT: ${day.ntReading}</div>
          <div class="mt-2"><a class="btn-primary" href="/day/${day.day}/">Open Day</a></div>
        </div>
      `;
    }

    loadMoreBtn.addEventListener('click', function() {
      const nextBatch = remainingDays.slice(currentLoaded - 30, currentLoaded - 30 + batchSize);
      
      if (nextBatch.length === 0) {
        loadMoreBtn.style.display = 'none';
        return;
      }

      // Add new cards with fade-in animation
      const fragment = document.createDocumentFragment();
      nextBatch.forEach(day => {
        const div = document.createElement('div');
        div.innerHTML = createDayCard(day);
        div.firstElementChild.style.opacity = '0';
        div.firstElementChild.style.transform = 'translateY(20px)';
        fragment.appendChild(div.firstElementChild);
      });

      daysGrid.appendChild(fragment);

      // Trigger animation
      requestAnimationFrame(() => {
        const newCards = daysGrid.querySelectorAll('[style*="opacity: 0"]');
        newCards.forEach((card, index) => {
          setTimeout(() => {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, index * 50);
        });
      });

      currentLoaded += batchSize;
      const remaining = remainingDays.length - (currentLoaded - 30);
      
      if (remaining <= 0) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.innerHTML = `Load More Days (${remaining} remaining)`;
      }
    });
  });

  // Lazy video loading
  utils.safeExecute(() => {
    const lazyVideos = document.querySelectorAll('.lazy-video[data-src]');
    
    lazyVideos.forEach(placeholder => {
      const loadVideo = () => {
        const src = placeholder.dataset.src;
        if (!src) return;
        
        const iframe = document.createElement('iframe');
        iframe.className = 'w-full aspect-video';
        iframe.src = src;
        iframe.title = 'BibleProject Video';
        iframe.allowFullscreen = true;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.loading = 'lazy';
        
        // Fade transition
        placeholder.style.opacity = '0';
        placeholder.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
          placeholder.parentNode.replaceChild(iframe, placeholder);
        }, 300);
      };
      
      placeholder.addEventListener('click', loadVideo);
      placeholder.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadVideo();
        }
      });
    });
  });
})();
