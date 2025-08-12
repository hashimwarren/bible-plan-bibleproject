// Client-side scripture lookup functionality
document.addEventListener('DOMContentLoaded', function() {
    const scriptureForm = document.getElementById('scripture-form');
    const scriptureInput = document.getElementById('scripture-input');
    const scriptureIndexElement = document.getElementById('scriptureIndex');
    
    if (!scriptureForm || !scriptureInput || !scriptureIndexElement) {
        return; // Not on the home page
    }
    
    let scriptureIndex = {};
    try {
        scriptureIndex = JSON.parse(scriptureIndexElement.textContent);
    } catch (e) {
        console.error('Failed to parse scripture index:', e);
        return;
    }
    
    // Handle form submission
    scriptureForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const selectedRef = scriptureInput.value.trim();
        if (!selectedRef) {
            return;
        }
        
        // Look for exact match first
        if (scriptureIndex[selectedRef]) {
            window.location.href = `/day/${scriptureIndex[selectedRef]}/`;
            return;
        }
        
        // Look for partial match (case-insensitive)
        const lowerRef = selectedRef.toLowerCase();
        const matchingRefs = Object.keys(scriptureIndex).filter(ref => 
            ref.toLowerCase().includes(lowerRef)
        );
        
        if (matchingRefs.length > 0) {
            // Go to the first match
            const firstMatch = matchingRefs[0];
            window.location.href = `/day/${scriptureIndex[firstMatch]}/`;
        } else {
            alert(`Scripture reference "${selectedRef}" not found. Try a different reference or browse the day list below.`);
        }
    });
    
    // Enhanced autocomplete behavior
    scriptureInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        if (value.length < 2) return;
        
        // Filter and update datalist options dynamically for better UX
        const datalist = document.getElementById('scripture-refs');
        const matchingRefs = Object.keys(scriptureIndex)
            .filter(ref => ref.toLowerCase().includes(value))
            .slice(0, 20); // Limit to first 20 matches for performance
        
        // Clear and repopulate datalist
        datalist.innerHTML = '';
        matchingRefs.forEach(ref => {
            const option = document.createElement('option');
            option.value = ref;
            option.textContent = `Day ${scriptureIndex[ref]}`;
            datalist.appendChild(option);
        });
    });
    
    // Handle selection from datalist
    scriptureInput.addEventListener('change', function() {
        const selectedRef = this.value.trim();
        if (scriptureIndex[selectedRef]) {
            window.location.href = `/day/${scriptureIndex[selectedRef]}/`;
        }
    });
});