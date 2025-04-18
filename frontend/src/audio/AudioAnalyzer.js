// src/audio/AudioAnalyzer.js
// Real-time audio analysis module using Spotify's audio analysis data

/**
 * AudioAnalyzer - Provides analysis of audio for visualizations
 * Uses Spotify's audio analysis and features APIs instead of microphone
 */
export class AudioAnalyzer {
    constructor() {
      this.initialized = true; // Always initialized
      this.analyzing = true;  // Always analyzing
      
      // Audio properties
      this.volume = 0.5;
      this.bass = 0.5;
      this.mid = 0.5;
      this.treble = 0.5;
      this.beatDetected = false;
      this.beatIntensity = 0;
      this.isPaused = false;
      
      // Track timing
      this.currentTrackId = null;
      this.trackStart = 0;
      this.trackProgress = 0;
      this.beats = [];
      this.segments = [];
      this.tatums = [];
      this.sections = [];
      
      // Audio features
      this.energy = 0.5;
      this.danceability = 0.5;
      this.valence = 0.5;
      this.tempo = 120;
      
      // Event callbacks
      this.onBeat = null;
      this.onAnalyzed = null;
      
      // Last beat time for calculations
      this.lastBeatTime = 0;
      
      // For interpolating between segments
      this.currentSegmentIndex = 0;
      this.nextSegmentIndex = 0;
    }
  
    /**
     * Initialize the analyzer - no setup needed with this approach
     */
    async initialize() {
      return true;
    }
  
    /**
     * Start audio analysis using Spotify data
     */
    async startAnalysis() {
      this.analyzing = true;
      return true;
    }
  
    /**
     * Stop audio analysis
     */
    stopAnalysis() {
      this.analyzing = false;
    }
    
    /**
     * Update track data from Spotify analysis
     * @param {Object} analysisData - Spotify audio analysis data
     * @param {Object} features - Spotify audio features
     */
    updateTrackData(analysisData, features) {
      if (!analysisData) return;
      
      // Store beats, segments and tatums from the analysis
      this.beats = analysisData.beats || [];
      this.segments = analysisData.segments || [];
      this.tatums = analysisData.tatums || [];
      this.sections = analysisData.sections || [];
      
      // Reset segment indices
      this.currentSegmentIndex = 0;
      this.nextSegmentIndex = this.segments.length > 1 ? 1 : 0;
      
      // Store audio features
      if (features) {
        this.energy = features.energy || 0.5;
        this.danceability = features.danceability || 0.5;
        this.valence = features.valence || 0.5;
        this.tempo = features.tempo || 120;
      }
    }
    
   /**
 * Update the current playback time to sync with the track
 * @param {number} progressMs - Current track progress in milliseconds
 */
updateProgress(progressMs) {
    // Convert to seconds
    this.trackProgress = progressMs / 1000;
  
    // If we haven’t loaded any analysis data yet, do nothing
    if (!this.beats || this.beats.length === 0) {
      return;
    }
  
    if (this.analyzing && !this.isPaused) {
      this.processAudioData();
    } else if (this.isPaused) {
      // Minimal values when paused
      this.volume = 0.1;
      this.bass = 0.1;
      this.mid = 0.1;
      this.treble = 0.1;
      this.beatDetected = false;
      this.beatIntensity = 0;
  
      // Call onAnalyzed callback
      if (this.onAnalyzed) {
        this.onAnalyzed({
          volume: this.volume,
          bass: this.bass,
          mid: this.mid,
          treble: this.treble,
          beatDetected: this.beatDetected,
          beatIntensity: this.beatIntensity
        });
      }
    }
  }
  
    
    /**
     * Process audio data based on track position to simulate real-time analysis
     */
    processAudioData() {
      // Find current beat
      const currentBeat = this.findCurrentEvent(this.beats);
      
      // Find current segment for frequency data
      const currentSegment = this.findCurrentEvent(this.segments);
      const currentSection = this.findCurrentEvent(this.sections);
      
      // Update current segment indices for smoother transitions
      this.updateSegmentIndices();
      
      // Detect beat
      if (currentBeat) {
        const now = performance.now() / 1000;
        
        // Only trigger a beat if enough time has passed since the last one
        // This prevents multiple beats triggering too close together
        if (now - this.lastBeatTime > 0.1) {
          this.beatDetected = true;
          this.beatIntensity = currentBeat.confidence || 0.8;
          this.lastBeatTime = now;
          
          // Call beat callback
          if (this.onBeat) {
            this.onBeat({
              time: now,
              intensity: this.beatIntensity,
              confidence: currentBeat.confidence || 0.8
            });
          }
        }
      } else {
        this.beatDetected = false;
        this.beatIntensity = 0;
      }
      
      // Extract frequency data from current segment
      if (currentSegment) {
        // Use timbre data from segment to approximate frequency bands
        // Spotify timbre vectors have 12 values representing different frequency characteristics
        const timbre = currentSegment.timbre || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        
        // Normalize timbre values (they can be negative)
        const normalizedTimbre = timbre.map(t => Math.min(1, Math.max(0, (t + 100) / 200)));
        
        // Map timbre components to frequency bands (approximate)
        this.bass = (normalizedTimbre[0] + normalizedTimbre[1]) / 2; // Low frequencies
        this.mid = (normalizedTimbre[2] + normalizedTimbre[3] + normalizedTimbre[4]) / 3; // Mid frequencies
        this.treble = (normalizedTimbre[5] + normalizedTimbre[6]) / 2; // High frequencies
        
        // Volume from loudness
        this.volume = Math.min(1, Math.max(0, (currentSegment.loudness_max + 60) / 60)) || 0.5;
        
        // Apply energy factor from audio features
        this.volume *= (0.5 + this.energy * 0.5);
        this.bass *= (0.4 + this.energy * 0.6);
        this.mid *= (0.4 + this.energy * 0.6);
        this.treble *= (0.4 + this.energy * 0.6);
      }
      
      // Adjust volume based on section if available
      if (currentSection && currentSection.loudness) {
        const sectionVolume = Math.min(1, Math.max(0, (currentSection.loudness + 60) / 60));
        this.volume = this.volume * 0.7 + sectionVolume * 0.3;
      }
      
      // Call analysis callback
      if (this.onAnalyzed) {
        this.onAnalyzed({
          volume: this.volume,
          bass: this.bass,
          mid: this.mid,
          treble: this.treble,
          beatDetected: this.beatDetected,
          beatIntensity: this.beatIntensity
        });
      }
    }
    
    /**
     * Update current segment indices for smoother transitions
     */
    updateSegmentIndices() {
      if (!this.segments || this.segments.length <= 1) return;
      
      for (let i = 0; i < this.segments.length - 1; i++) {
        const segment = this.segments[i];
        const nextSegment = this.segments[i + 1];
        
        if (this.trackProgress >= segment.start && this.trackProgress < nextSegment.start) {
          this.currentSegmentIndex = i;
          this.nextSegmentIndex = i + 1;
          return;
        }
      }
      
      // If we're at the last segment
      if (this.trackProgress >= this.segments[this.segments.length - 1].start) {
        this.currentSegmentIndex = this.segments.length - 1;
        this.nextSegmentIndex = this.segments.length - 1;
      }
    }
    
    /**
     * Find the current event (beat, segment, etc.) based on track progress
     * @param {Array} events - Array of timed events from Spotify analysis
     * @returns {Object|null} - Current event or null if not found
     */
    findCurrentEvent(events) {
      if (!events || events.length === 0) return null;
      
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const start = event.start;
        const end = start + (event.duration || 0);
        
        if (this.trackProgress >= start && this.trackProgress < end) {
          return event;
        }
      }
      
      return null;
    }
    
    /**
     * Get the current segment position
     * @returns {number} - Position within segment (0-1)
     */
    getSegmentProgress() {
      if (!this.segments || this.segments.length === 0) return 0;
      
      const segment = this.segments[this.currentSegmentIndex];
      if (!segment) return 0;
      
      const start = segment.start;
      const duration = segment.duration || 0;
      
      if (duration === 0) return 0;
      
      return Math.min(1, Math.max(0, (this.trackProgress - start) / duration));
    }
    
    /**
     * Set paused state
     * @param {boolean} isPaused - Whether audio is paused
     */
    setPaused(isPaused) {
      this.isPaused = isPaused;
    }
    
    /**
     * Get current audio data
     * @returns {Object} - Current audio data
     */
    getAudioData() {
      return {
        volume: this.volume,
        bass: this.bass,
        mid: this.mid,
        treble: this.treble,
        beatDetected: this.beatDetected,
        beatIntensity: this.beatIntensity
      };
    }
    
    /**
     * Generate synthetic data when no analysis is available
     * @param {number} time - Current animation time
     */
    generateSyntheticData(time) {
      const beatInterval = 60 / this.tempo;
      
      // Check if a beat should occur
      if (time - this.lastBeatTime >= beatInterval) {
        // Beat!
        this.beatDetected = true;
        this.beatIntensity = 0.5 + (this.energy * 0.5);
        this.lastBeatTime = time;
        
        // Call beat callback
        if (this.onBeat) {
          this.onBeat({
            time: time,
            intensity: this.beatIntensity,
            bass: this.bass,
            mid: this.mid,
            treble: this.treble
          });
        }
      } else {
        // Reset beat detection
        this.beatDetected = false;
      }
      
      // Generate waveforms for different frequency bands
      const energyFactor = this.energy * 0.8 + 0.2;
      const beatProgress = (time - this.lastBeatTime) / beatInterval;
      
      // Base volume with natural fade
      this.volume = energyFactor * (0.6 + 0.4 * (1 - beatProgress));
      
      // Bass frequencies - stronger for danceable tracks
      this.bass = energyFactor * (
        0.5 + 0.5 * Math.pow(Math.sin(time * (1 + this.danceability)), 2)
      );
      
      // Mid frequencies - more variation
      this.mid = energyFactor * (
        0.3 + 0.7 * Math.pow(Math.sin(time * 2.5 + 0.4), 2)
      );
      
      // Treble frequencies - fastest changes
      this.treble = energyFactor * (
        0.2 + 0.8 * Math.pow(Math.sin(time * 4.2 + 0.8), 2)
      );
      
      // Call analysis callback
      if (this.onAnalyzed) {
        this.onAnalyzed({
          volume: this.volume,
          bass: this.bass,
          mid: this.mid,
          treble: this.treble,
          beatDetected: this.beatDetected,
          beatIntensity: this.beatIntensity
        });
      }
    }
}

// Export a singleton instance
const audioAnalyzer = new AudioAnalyzer();
export default audioAnalyzer;