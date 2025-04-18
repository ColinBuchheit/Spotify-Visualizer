// VolumeControl.js
// Volume control component for Spotify player

/**
 * Create volume control UI
 * @param {Function} onVolumeChange - Callback for when volume changes
 * @param {number} initialVolume - Initial volume (0-1)
 * @returns {Object} - Volume control elements and methods
 */
export function createVolumeControl(onVolumeChange, initialVolume = 0.4) {
    // Create container element
    const container = document.createElement('div');
    container.id = 'volume-control';
    container.className = 'volume-control';
    
    // Create volume icon
    const icon = document.createElement('div');
    icon.className = 'volume-icon';
    icon.innerHTML = getVolumeIcon(initialVolume);
    
    // Create volume slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'volume-slider-container';
    
    // Create slider track
    const sliderTrack = document.createElement('div');
    sliderTrack.className = 'volume-slider-track';
    
    // Create slider fill (shows current volume level)
    const sliderFill = document.createElement('div');
    sliderFill.className = 'volume-slider-fill';
    sliderFill.style.width = `${initialVolume * 100}%`;
    
    // Create slider knob
    const sliderKnob = document.createElement('div');
    sliderKnob.className = 'volume-slider-knob';
    sliderKnob.style.left = `${initialVolume * 100}%`;
    
    // Append elements
    sliderTrack.appendChild(sliderFill);
    sliderTrack.appendChild(sliderKnob);
    sliderContainer.appendChild(sliderTrack);
    container.appendChild(icon);
    container.appendChild(sliderContainer);
    
    // Track current volume
    let currentVolume = initialVolume;
    let isDragging = false;
    let previousVolume = initialVolume;
    
    // Add event listeners for dragging
    sliderTrack.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch support
    sliderTrack.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);
    
    // Click on icon to mute/unmute
    icon.addEventListener('click', () => {
      if (currentVolume > 0) {
        // Store current volume and set to 0 (mute)
        previousVolume = currentVolume;
        setVolume(0);
      } else {
        // Restore previous volume
        setVolume(previousVolume);
      }
    });
    
    /**
     * Start dragging the volume knob
     * @param {Event} e - Mouse or touch event
     */
    function startDrag(e) {
      e.preventDefault();
      isDragging = true;
      drag(e);
    }
    
    /**
     * Handle dragging of volume knob
     * @param {Event} e - Mouse or touch event
     */
    function drag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Get position relative to slider
      const rect = sliderTrack.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - rect.left;
      
      // Calculate new volume (0-1)
      let newVolume = Math.max(0, Math.min(1, x / rect.width));
      
      setVolume(newVolume);
    }
    
    /**
     * End dragging of volume knob
     */
    function endDrag() {
      isDragging = false;
    }
    
    /**
     * Set the volume level with logarithmic scaling for more natural volume perception
     * @param {number} rawVolume - Volume level (0-1) from UI
     */
    function setVolume(rawVolume) {
      // Apply logarithmic curve for more natural volume control
      // Human hearing perceives volume logarithmically, not linearly
      const scaledVolume = Math.pow(rawVolume, 2); // Stronger curve for lower volumes
      
      // Update current volume
      currentVolume = rawVolume;
      
      // Update UI
      sliderFill.style.width = `${rawVolume * 100}%`;
      sliderKnob.style.left = `${rawVolume * 100}%`;
      icon.innerHTML = getVolumeIcon(rawVolume);
      
      // Save to localStorage for persistence
      try {
        localStorage.setItem('spotify_visualizer_volume', rawVolume.toString());
      } catch (e) {
        console.warn('Could not save volume to localStorage:', e);
      }
      
      // Call callback with scaled volume
      if (onVolumeChange) {
        onVolumeChange(scaledVolume);
      }
    }
    
    // Return the component and methods
    return {
      element: container,
      setVolume,
      getVolume: () => currentVolume
    };
}
  
/**
 * Get the appropriate volume icon based on level
 * @param {number} volume - Volume level (0-1)
 * @returns {string} - SVG icon markup
 */
function getVolumeIcon(volume) {
  if (volume === 0) {
    // Muted
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
    `;
  } else if (volume < 0.5) {
    // Low volume
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    `;
  } else {
    // High volume
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    `;
  }
}