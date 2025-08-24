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

  // Scripture search functionality
  utils.safeExecute(() => {
    const form = document.getElementById('scripture-form');
    const input = document.getElementById('scripture');
    const indexEl = document.getElementById('scriptureIndex');
    
    if (!form || !input) return;

    let scriptureIndex = [];
    try {
      scriptureIndex = JSON.parse(indexEl?.textContent || '[]');
    } catch (error) {
      console.warn('Failed to parse scripture index:', error);
    }

    function findDaysForRef(ref) {
      if (!ref) return [];
      
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
})();
