window.SatyaKavach = window.SatyaKavach || {};

window.SatyaKavach.MockAnalyzer = (function() {
  const Utils = window.SatyaKavach.Utils;

  // Cache to store analysis results for the same file/url
  const resultCache = new Map();

  // Simple deterministic PRNG (Mulberry32)
  function createSeededRandom(seed) {
    let state = seed | 0;
    return function() {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Simple string hasher
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  function getCacheKey(file, type) {
    if (typeof file === 'string') return 'url:' + file;
    // For File objects, use name + size + lastModified for a stable key
    return 'file:' + (file.name || 'unknown') + ':' + (file.size || 0) + ':' + (file.lastModified || 0);
  }

  class MockAnalyzer {
    constructor() {}

    async analyzeImage(file, onProgress) {
      return this._simulateAnalysis(file, 'image', onProgress);
    }

    async analyzeVideo(file, onProgress) {
      return this._simulateAnalysis(file, 'video', onProgress);
    }

    async analyzeAudio(file, onProgress) {
      return this._simulateAnalysis(file, 'audio', onProgress);
    }

    async analyzeText(text, onProgress) {
      const textAnalyzer = window.SatyaKavach.TextAnalyzer;
      const res = textAnalyzer ? textAnalyzer.analyze(text) : { score: 75 };
      if (onProgress) onProgress('Scanning URL reputation & text vectors', 50);
      await Utils.delay(800);
      if (onProgress) onProgress('Complete', 100);
      return {
        overallRisk: {
          score: res.score,
          label: res.score >= 60 ? 'HIGH' : (res.score >= 30 ? 'MEDIUM' : 'LOW'),
          confidence: { lower: Math.max(0, res.score - 10), upper: Math.min(100, res.score + 10), mean: res.score }
        }
      };
    }

    async analyzeUrl(url, onProgress) {
      if (onProgress) onProgress('Fetching URL context', 30);
      await Utils.delay(1500);
      return this._simulateAnalysis({ name: url, size: url.length, lastModified: 0 }, 'video', onProgress);
    }

    async _simulateAnalysis(file, type, onProgress) {
      const cacheKey = getCacheKey(file, type);

      // Return cached result instantly (with brief loading for UX)
      if (resultCache.has(cacheKey)) {
        const stages = [
          { msg: 'Loading cached analysis...', progress: 50, delay: 300 },
          { msg: 'Complete', progress: 100, delay: 200 }
        ];
        for (const stage of stages) {
          if (onProgress) onProgress(stage.msg, stage.progress);
          await Utils.delay(stage.delay);
        }
        // Return a deep copy so the caller can't mutate the cache
        return JSON.parse(JSON.stringify(resultCache.get(cacheKey)));
      }

      // Full analysis stages
      const stages = [
        { msg: 'Extracting metadata...', progress: 10, delay: 500 },
        { msg: 'Running forensic models...', progress: 40, delay: 800 },
        { msg: 'Analyzing spectral features...', progress: 70, delay: 600 },
        { msg: 'Checking threat intel...', progress: 90, delay: 400 },
        { msg: 'Finalizing report...', progress: 100, delay: 200 }
      ];

      for (const stage of stages) {
        if (onProgress) onProgress(stage.msg, stage.progress);
        await Utils.delay(stage.delay);
      }

      // Create a seeded PRNG from the file identity
      const seed = hashString(cacheKey);
      const rand = createSeededRandom(seed);

      // Deterministic helper functions using the seeded PRNG
      const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
      const randFloat = (min, max) => rand() * (max - min) + min;

      // Determine fake/real based on seeded random (consistent per file)
      const isFake = rand() > 0.4; // 60% chance of fake - but SAME every time for this file
      
      const overallScore = isFake ? randInt(70, 99) : randInt(5, 30);
      const label = overallScore > 60 ? 'HIGH' : (overallScore > 30 ? 'MEDIUM' : 'LOW');
      const confSpread = randInt(5, 15);

      const result = {
        overallRisk: { 
          score: overallScore, 
          label: label, 
          confidence: { 
            lower: Math.max(0, overallScore - confSpread), 
            upper: Math.min(100, overallScore + confSpread), 
            mean: overallScore 
          } 
        },
        visualForensics: type !== 'audio' ? {
          faceSwapDetection: { 
            score: isFake ? randInt(60, 95) : randInt(0, 20), 
            confidence: 85, 
            boundingBoxes: [{x: 0.35 + randFloat(-0.05, 0.05), y: 0.25 + randFloat(-0.05, 0.05), w: 0.25, h: 0.3}] 
          },
          expressionSync: { 
            score: isFake ? randInt(70, 99) : randInt(5, 25), 
            confidence: 90, 
            label: isFake ? 'Inconsistent' : 'Natural' 
          },
          gazeConsistency: { 
            score: isFake ? randInt(65, 90) : randInt(0, 15), 
            details: isFake ? 'Unnatural pupil fixation detected' : 'Normal' 
          },
          lightingShadow: { 
            score: isFake ? randInt(50, 85) : randInt(0, 10), 
            details: isFake ? 'Inconsistent ambient occlusion' : 'Consistent' 
          },
          rppgPulse: { detected: true, bpm: isFake ? 0 : randInt(60, 90), consistency: isFake ? randInt(10, 25) : randInt(75, 95) },
          microBehaviors: { 
            blinkRate: isFake ? randFloat(0.1, 0.5) : randInt(12, 20), 
            pupilDilation: isFake ? 'Static' : 'Dynamic', 
            microTremors: isFake ? 'Absent' : 'Present', 
            throatMovement: isFake ? 'Irregular' : 'Normal' 
          }
        } : null,
        audioForensics: (type === 'audio' || type === 'video') ? {
          voiceClone: { score: isFake ? randInt(75, 99) : randInt(5, 20), confidence: 92 },
          ttsArtifacts: { score: isFake ? randInt(60, 95) : randInt(0, 15), confidence: 88 },
          phonemeVisemeSync: type === 'video' ? { 
            score: isFake ? randInt(60, 95) : randInt(0, 10), 
            details: isFake ? 'Lipsync mismatch detected' : 'Synced' 
          } : null,
          spectralAnomalies: isFake ? [{timestamp: '00:' + randInt(5, 30), type: 'Phase Discontinuity', severity: 'High'}] : [],
          breathPauses: { natural: isFake ? randInt(1, 4) : randInt(10, 18), synthetic: isFake ? randInt(8, 15) : randInt(0, 2) }
        } : null,
        provenance: {
          c2pa: { 
            status: isFake ? 'missing' : 'verified', 
            chain: isFake ? [] : [{node: 'Camera', software: 'Device', timestamp: new Date().toISOString()}] 
          },
          deviceId: { matched: !isFake, device: isFake ? 'Unknown' : 'Verified Device' },
          editHistory: [{
            software: isFake ? 'AI Generation Tool' : 'Camera', 
            action: isFake ? 'Generated' : 'Captured', 
            timestamp: new Date().toISOString()
          }]
        },
        threatIntel: {
          scamPattern: { matched: isFake, name: isFake ? 'Synthetic Media Distribution' : 'None' },
          vectorHistory: { count: isFake ? randInt(10, 80) : 0, details: isFake ? 'Pattern seen in known threat actor campaigns' : 'Clean' },
          sourceReputation: { score: isFake ? randInt(10, 35) : randInt(70, 95), platform: 'Unknown' }
        },
        timeline: type === 'video' ? [
          { timestamp: randFloat(1, 4), frameIndex: randInt(30, 120), type: isFake ? 'anomaly' : 'normal', label: isFake ? 'Face Swap Seam' : 'Normal', score: isFake ? randInt(70, 95) : randInt(5, 15) },
          { timestamp: randFloat(4, 8), frameIndex: randInt(120, 240), type: isFake ? 'anomaly' : 'normal', label: isFake ? 'Audio Splice' : 'Normal', score: isFake ? randInt(80, 98) : randInt(3, 12) }
        ] : [],
        heatmapData: { width: 256, height: 256, matrix: (() => {
          // Use seeded PRNG for heatmap too - same file = same heatmap
          const m = new Float32Array(256 * 256);
          for (let i = 0; i < m.length; i++) m[i] = rand();
          return m;
        })() },
        metadata: { 
          fileName: file.name || 'stream_capture', 
          fileType: type, 
          fileSize: file.size || 0, 
          duration: type !== 'image' ? 12.5 : 0, 
          resolution: '1920x1080', 
          analyzedAt: new Date().toISOString() 
        }
      };

      // Cache the result (store a copy)
      resultCache.set(cacheKey, JSON.parse(JSON.stringify(result)));

      return result;
    }
  }

  return new MockAnalyzer();
})();
