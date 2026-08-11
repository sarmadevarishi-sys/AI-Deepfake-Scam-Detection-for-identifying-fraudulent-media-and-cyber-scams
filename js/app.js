/**
 * SatyaKavach — Main Application Controller
 * 
 * Orchestrates all modules: upload, analysis, dashboard, forensic overlays,
 * text analyzer, frame slider, and provenance tree. Manages application state,
 * view routing, split-pane resizing, and demo mode.
 */
window.SatyaKavach = window.SatyaKavach || {};

window.SatyaKavach.App = (function () {
  const Utils = window.SatyaKavach.Utils;

  // ─── Application State ─────────────────────────────────
  const state = {
    currentView: 'dashboard',
    currentMedia: null,
    analysisResult: null,
    isAnalyzing: false,
    analysisHistory: [],
    overlays: {
      heatmap: false,
      bounding: false,
      rppg: false
    }
  };

  // ─── Module References ─────────────────────────────────
  let uploadManager = null;
  let dashboard = null;
  let heatmapRenderer = null;
  let waveformRenderer = null;
  let frameSlider = null;
  let provenanceTree = null;

  // ─── DOM References ────────────────────────────────────
  const els = {};

  // ─── Initialization ────────────────────────────────────
  function init() {
    cacheElements();
    initUploadManager();
    initDashboard();
    initForensicOverlays();
    initSplitPaneResize();
    bindNavigationEvents();
    bindUploadEvents();
    bindToggleEvents();
    bindTextAnalyzer();
    bindDemoMode();
    bindKeyboardShortcuts();
    bindActionButtons();
    console.log('[SatyaKavach] Platform initialized');
  }

  function cacheElements() {
    // Upload
    els.dragDropBox = Utils.$('#drag-drop-box');
    els.fileInput = Utils.$('#file-upload-input');
    els.urlInput1 = Utils.$('#url-input-1');
    els.urlInput2 = Utils.$('#url-input-2');
    els.btnSubmitScan = Utils.$('#btn-submit-scan');
    els.btnWebRTC = Utils.$('#btn-webrtc');
    els.scanProgressContainer = Utils.$('#scan-progress-container');
    els.scanProgressFill = Utils.$('#scan-progress-fill');
    els.scanProgressLabel = Utils.$('#scan-progress-label');

    // Workspace
    els.workspaceLeft = Utils.$('#workspace-left');
    els.workspaceRight = Utils.$('#workspace-right');
    els.paneResizer = Utils.$('#pane-resizer');
    els.workspaceSplit = Utils.$('#workspace-split');

    // Media Viewport
    els.viewportEmpty = Utils.$('#viewport-empty');
    els.mediaImage = Utils.$('#media-image');
    els.mediaVideo = Utils.$('#media-video');
    els.mediaViewport = Utils.$('#media-viewport');
    els.heatmapCanvas = Utils.$('#heatmap-canvas');
    els.rppgCanvas = Utils.$('#rppg-canvas');
    els.boundingCanvas = Utils.$('#bounding-canvas');
    els.forensicLayersPanel = Utils.$('#forensic-layers-panel');

    // Timeline
    els.timelineContainer = Utils.$('#timeline-container');
    els.timelineCanvas = Utils.$('#timeline-canvas');
    els.frameSlider = Utils.$('#frame-slider');
    els.timelineMarkers = Utils.$('#timeline-markers');
    els.timelineTime = Utils.$('#timeline-time');
    els.timelineDuration = Utils.$('#timeline-duration');
    els.btnPlayPause = Utils.$('#btn-play-pause');

    // Audio
    els.audioSection = Utils.$('#audio-section');
    els.waveformCanvas = Utils.$('#waveform-canvas');
    els.spectrogramCanvas = Utils.$('#spectrogram-canvas');

    // Dashboard
    els.dashboardContent = Utils.$('#dashboard-content');
    els.dashboardEmpty = Utils.$('#dashboard-empty');
    els.dashboardActions = Utils.$('#dashboard-actions');
    els.riskScoreValue = Utils.$('#risk-score-value');
    els.riskBadge = Utils.$('#risk-badge');

    // Text Analyzer
    els.textAnalyzerView = Utils.$('#text-analyzer-view');
    els.textInput = Utils.$('#text-input');
    els.btnAnalyzeText = Utils.$('#btn-analyze-text');
    els.textResults = Utils.$('#text-results');
    els.textRiskScore = Utils.$('#text-risk-score');
    els.textClassification = Utils.$('#text-classification');
    els.textHighlighted = Utils.$('#text-highlighted');
    els.textTactics = Utils.$('#text-tactics');
    els.textRecommendation = Utils.$('#text-recommendation');

    // Upload section
    els.uploadSection = Utils.$('#upload-section');

    // Toggles
    els.toggleHeatmap = Utils.$('#toggle-heatmap');
    els.toggleBounding = Utils.$('#toggle-bounding');
    els.toggleRppg = Utils.$('#toggle-rppg');
    els.floatToggleHeatmap = Utils.$('#float-toggle-heatmap');
    els.floatToggleBounding = Utils.$('#float-toggle-bounding');
    els.floatToggleRppg = Utils.$('#float-toggle-rppg');
  }

  // ─── Upload Manager ───────────────────────────────────
  function initUploadManager() {
    uploadManager = new window.SatyaKavach.UploadManager('#drag-drop-box');

    // Click on drag-drop box opens file picker
    if (els.dragDropBox) {
      els.dragDropBox.addEventListener('click', () => {
        els.fileInput.click();
      });
    }

    // Upload events
    uploadManager.on('file-selected', (data) => {
      showMediaPreview(data.file);
    });

    uploadManager.on('analysis-start', (data) => {
      state.isAnalyzing = true;
      showProgressBar();
      showDashboardLoading();
    });

    uploadManager.on('analysis-progress', (data) => {
      updateProgressBar(data.percent, data.stage);
    });

    uploadManager.on('analysis-complete', (data) => {
      state.isAnalyzing = false;
      state.analysisResult = data.result;
      // Save to history
      state.analysisHistory.push({
        id: Utils.generateId(),
        result: data.result,
        timestamp: new Date().toISOString(),
        fileName: data.result?.metadata?.fileName || 'Unknown'
      });
      hideProgressBar();
      renderAnalysisResults(data.result);
    });
  }

  // ─── Dashboard ─────────────────────────────────────────
  function initDashboard() {
    dashboard = new window.SatyaKavach.Dashboard('#dashboard-content');
  }

  // ─── Forensic Overlays ─────────────────────────────────
  function initForensicOverlays() {
    // Defer heatmap renderer creation — will create on first render
    if (window.SatyaKavach.WaveformRenderer) {
      waveformRenderer = new window.SatyaKavach.WaveformRenderer();
    }
    if (window.SatyaKavach.ProvenanceTree) {
      provenanceTree = new window.SatyaKavach.ProvenanceTree();
    }
  }

  // ─── Split Pane Resize ─────────────────────────────────
  function initSplitPaneResize() {
    if (!els.paneResizer) return;

    let isResizing = false;

    els.paneResizer.addEventListener('pointerdown', (e) => {
      isResizing = true;
      els.paneResizer.setPointerCapture(e.pointerId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      const splitRect = els.workspaceSplit.getBoundingClientRect();
      const newRightWidth = Math.max(280, Math.min(600, splitRect.right - e.clientX));
      els.workspaceRight.style.width = newRightWidth + 'px';
    });

    document.addEventListener('pointerup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // ─── Navigation ────────────────────────────────────────
  function bindNavigationEvents() {
    // Sidebar navigation
    Utils.$$('.sidebar-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        if (view === 'analysis' || view === 'threat-intel') {
          switchView('dashboard');
          if (view === 'threat-intel') {
            const ti = Utils.$('#section-threat-intel');
            if (ti) ti.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          switchView(view);
        }
      });
    });

    // Header tabs
    Utils.$$('.nav-tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        switchView(target);
      });
    });

    // User Profile Avatar Click
    const avatar = Utils.$('#user-avatar');
    const profileMenu = Utils.$('#user-profile-menu');
    if (avatar && profileMenu) {
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = profileMenu.style.display === 'block';
        profileMenu.style.display = isShown ? 'none' : 'block';
      });
      document.addEventListener('click', (e) => {
        if (!profileMenu.contains(e.target) && e.target !== avatar) {
          profileMenu.style.display = 'none';
        }
      });
    }

    // Settings Modal Triggers
    const settingsModal = Utils.$('#settings-modal');
    const openSettings = () => {
      if (settingsModal) settingsModal.style.display = 'flex';
      if (profileMenu) profileMenu.style.display = 'none';
    };
    const closeSettings = () => {
      if (settingsModal) settingsModal.style.display = 'none';
    };

    ['#nav-status', '#profile-settings-btn', '#btn-settings'].forEach(sel => {
      const btn = Utils.$(sel);
      if (btn) btn.addEventListener('click', openSettings);
    });

    const closeBtn = Utils.$('#close-settings-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);

    const saveBtn = Utils.$('#save-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        closeSettings();
        alert('✅ SatyaKavach Settings & Model Preferences Saved.');
      });
    }
  }

  function switchView(view) {
    state.currentView = view;

    // Update sidebar
    Utils.$$('.sidebar-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === view);
    });

    // Update header tabs
    Utils.$$('.nav-tab[data-tab]').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === view);
    });

    // Hide all special views
    const specialViews = ['text-analyzer-view', 'history-view', 'api-docs-view', 'enterprise-view'];
    specialViews.forEach(id => {
      const el = Utils.$('#' + id);
      if (el) el.style.display = 'none';
    });

    // Show/hide main workspace vs special views
    const isSpecialView = (view === 'text-analyzer' || view === 'history' || view === 'api' || view === 'enterprise');
    if (els.workspaceSplit) els.workspaceSplit.style.display = isSpecialView ? 'none' : 'flex';
    if (els.uploadSection) els.uploadSection.style.display = isSpecialView ? 'none' : '';

    // Show the target special view
    if (view === 'text-analyzer') {
      showView('text-analyzer-view');
    } else if (view === 'history') {
      showHistoryView();
    } else if (view === 'api') {
      showApiDocsView();
    } else if (view === 'enterprise') {
      showEnterpriseView();
    }
  }

  function showView(viewId) {
    const el = Utils.$('#' + viewId);
    if (el) el.style.display = 'flex';
  }

  // ─── Analysis History View ─────────────────────────────
  function showHistoryView() {
    let historyView = Utils.$('#history-view');
    if (!historyView) {
      historyView = document.createElement('div');
      historyView.id = 'history-view';
      historyView.className = 'special-view';
      els.workspaceSplit.parentElement.appendChild(historyView);
    }
    historyView.style.display = 'flex';

    if (state.analysisHistory.length === 0) {
      historyView.innerHTML = `
        <div class="special-view-content">
          <div class="special-view-header">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <h2>Analysis History</h2>
            <p class="text-muted">Your previous analyses will appear here. Upload media or run a demo scan to get started.</p>
          </div>
        </div>`;
    } else {
      historyView.innerHTML = `
        <div class="special-view-content">
          <div class="special-view-header">
            <h2>Analysis History</h2>
            <p class="text-secondary">${state.analysisHistory.length} analysis result(s)</p>
          </div>
          <div class="history-list">
            ${state.analysisHistory.map((item, i) => {
              const r = item.result;
              const score = r.overallRisk.score;
              const conf = Utils.formatConfidence(score);
              const date = new Date(item.timestamp).toLocaleString();
              return `
                <div class="history-item card" data-history-index="${i}">
                  <div class="history-item-header">
                    <div>
                      <div class="history-filename">${r.metadata.fileName}</div>
                      <div class="history-date text-muted">${date}</div>
                    </div>
                    <div class="history-score">
                      <span class="badge badge-${score > 60 ? 'danger' : (score > 30 ? 'warning' : 'success')}">${conf.label}</span>
                      <span class="risk-score-value" style="font-size:24px;color:${conf.color};">${score}%</span>
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`;

      // Click to load history item
      historyView.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.historyIndex);
          const historyEntry = state.analysisHistory[idx];
          if (historyEntry) {
            state.analysisResult = historyEntry.result;
            switchView('dashboard');
            renderAnalysisResults(historyEntry.result);
          }
        });
      });
    }
  }

  // ─── API Docs View ─────────────────────────────────────
  function showApiDocsView() {
    let apiView = Utils.$('#api-docs-view');
    if (!apiView) {
      apiView = document.createElement('div');
      apiView.id = 'api-docs-view';
      apiView.className = 'special-view';
      els.workspaceSplit.parentElement.appendChild(apiView);
    }
    apiView.style.display = 'flex';
    apiView.innerHTML = `
      <div class="special-view-content api-docs">
        <div class="special-view-header">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1" stroke-linecap="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <h2>API Documentation</h2>
          <p class="text-secondary">Integrate SatyaKavach into your existing infrastructure</p>
        </div>
        <div class="api-section card">
          <h3>REST API — Analyze Media</h3>
          <div class="api-endpoint">
            <span class="badge badge-success">POST</span>
            <code>/api/v1/analyze</code>
          </div>
          <pre class="api-code"><code>curl -X POST https://api.satyakavach.gov.in/v1/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@suspicious_video.mp4" \\
  -F "mode=deep_scan"</code></pre>
          <h4>Response Schema</h4>
          <pre class="api-code"><code>{
  "overallRisk": {
    "score": 88,
    "label": "HIGH",
    "confidence": { "lower": 82, "upper": 93, "mean": 88 }
  },
  "visualForensics": {
    "faceSwapDetection": { "score": 92, "confidence": 95 },
    "expressionSync": { "score": 55, "confidence": 78 },
    "rppgPulse": { "detected": true, "bpm": 0, "consistency": 20 }
  },
  "audioForensics": {
    "voiceClone": { "score": 84, "confidence": 91 },
    "phonemeVisemeSync": { "score": 72 }
  },
  "provenance": {
    "c2pa": { "status": "missing" },
    "deviceId": { "matched": false }
  }
}</code></pre>
        </div>
        <div class="api-section card">
          <h3>WebSocket — Live Stream Analysis</h3>
          <div class="api-endpoint">
            <span class="badge badge-warning">WS</span>
            <code>wss://api.satyakavach.gov.in/v1/stream</code>
          </div>
          <pre class="api-code"><code>const ws = new WebSocket('wss://api.satyakavach.gov.in/v1/stream');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'start', mode: 'realtime' }));
};
ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log('Frame analysis:', result.frameScore);
};</code></pre>
        </div>
        <div class="api-section card">
          <h3>Rate Limits</h3>
          <div class="metric-row"><span class="metric-label">Free Tier</span><span class="metric-value">100 requests/day</span></div>
          <div class="metric-row"><span class="metric-label">Government</span><span class="metric-value">Unlimited</span></div>
          <div class="metric-row"><span class="metric-label">Enterprise</span><span class="metric-value">10,000 requests/day</span></div>
        </div>
      </div>`;
  }

  // ─── Enterprise View ───────────────────────────────────
  function showEnterpriseView() {
    let entView = Utils.$('#enterprise-view');
    if (!entView) {
      entView = document.createElement('div');
      entView.id = 'enterprise-view';
      entView.className = 'special-view';
      els.workspaceSplit.parentElement.appendChild(entView);
    }
    entView.style.display = 'flex';
    entView.innerHTML = `
      <div class="special-view-content">
        <div class="special-view-header">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1" stroke-linecap="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          <h2>Enterprise Integration</h2>
          <p class="text-secondary">Deploy SatyaKavach across your organization's security infrastructure</p>
        </div>
        <div class="enterprise-cards">
          <div class="card enterprise-card">
            <h3>🔌 SIEM Integration</h3>
            <p class="text-secondary">Connect with Splunk, IBM QRadar, Microsoft Sentinel, and other SIEM platforms for automated threat response.</p>
            <button class="btn btn-primary" onclick="alert('SIEM integration setup wizard would launch here. Contact admin@satyakavach.gov.in for enterprise onboarding.')">Configure SIEM</button>
          </div>
          <div class="card enterprise-card">
            <h3>🏢 On-Premise Deployment</h3>
            <p class="text-secondary">Air-gapped deployment for classified environments. All models run locally with no data leaving your network.</p>
            <button class="btn btn-secondary" onclick="alert('On-premise deployment guide would open here. Requires Docker/Kubernetes setup.')">Request Deploy Guide</button>
          </div>
          <div class="card enterprise-card">
            <h3>📊 Bulk Processing</h3>
            <p class="text-secondary">Submit thousands of media files for batch analysis via S3/Azure Blob integration.</p>
            <button class="btn btn-secondary" onclick="alert('Bulk upload portal would open here. Supports S3, Azure Blob, and GCS buckets.')">Setup Bulk Pipeline</button>
          </div>
          <div class="card enterprise-card">
            <h3>🔑 SSO & RBAC</h3>
            <p class="text-secondary">SAML 2.0 / OIDC single sign-on with role-based access control for analyst, reviewer, and admin roles.</p>
            <button class="btn btn-secondary" onclick="alert('SSO configuration panel would open here. Supports Okta, Azure AD, and Google Workspace.')">Configure SSO</button>
          </div>
        </div>
      </div>`;
  }

  // ─── Upload Events ─────────────────────────────────────
  function bindUploadEvents() {
    // Submit scan button
    if (els.btnSubmitScan) {
      els.btnSubmitScan.addEventListener('click', () => {
        // Check for URL input first
        const url1 = (els.urlInput1 && els.urlInput1.value.trim()) || '';
        const url2 = (els.urlInput2 && els.urlInput2.value.trim()) || '';
        const url = url1 || url2;

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          uploadManager.processUrl(url);
        } else if (state.currentMedia && state.currentMedia.file) {
          uploadManager.processFile(state.currentMedia.file);
        } else {
          // Prompt file selection
          els.fileInput.click();
        }
      });
    }

    // URL paste buttons — use fallback if clipboard API unavailable
    const bindPasteButton = (btnId, inputEl) => {
      const btn = Utils.$(btnId);
      if (!btn || !inputEl) return;
      btn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            inputEl.value = text;
            detectUrlPlatform(inputEl, text);
          } else {
            // Fallback: focus the input and let user Ctrl+V
            inputEl.focus();
            inputEl.placeholder = 'Press Ctrl+V to paste your URL here...';
            inputEl.select();
          }
        } catch {
          // Clipboard access denied — focus input instead
          inputEl.focus();
          inputEl.placeholder = 'Press Ctrl+V to paste your URL here...';
          inputEl.select();
        }
      });
    };

    bindPasteButton('#url-paste-btn-1', els.urlInput1);
    bindPasteButton('#url-paste-btn-2', els.urlInput2);

    // URL input auto-detection on paste/type
    [els.urlInput1, els.urlInput2].forEach(input => {
      if (!input) return;
      input.addEventListener('input', () => {
        detectUrlPlatform(input, input.value);
      });
      // Also handle paste event directly
      input.addEventListener('paste', (e) => {
        setTimeout(() => {
          detectUrlPlatform(input, input.value);
        }, 50);
      });
      // Handle Enter key to submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const url = input.value.trim();
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            uploadManager.processUrl(url);
          }
        }
      });
    });

    // WebRTC button
    if (els.btnWebRTC) {
      els.btnWebRTC.addEventListener('click', startWebRTCCapture);
    }
  }

  function detectUrlPlatform(inputEl, url) {
    const platform = Utils.detectPlatform(url);
    inputEl.setAttribute('data-platform', platform);
    if (platform !== 'Unknown') {
      inputEl.style.borderColor = 'var(--accent-cyan)';
      inputEl.style.boxShadow = '0 0 8px rgba(0, 212, 255, 0.15)';
    } else {
      inputEl.style.borderColor = '';
      inputEl.style.boxShadow = '';
    }
  }

  // ─── WebRTC Capture ────────────────────────────────────
  async function startWebRTCCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (els.mediaVideo) {
        els.mediaVideo.srcObject = stream;
        els.mediaVideo.style.display = 'block';
        els.mediaVideo.play();
        if (els.viewportEmpty) els.viewportEmpty.style.display = 'none';
        if (els.forensicLayersPanel) els.forensicLayersPanel.style.display = 'flex';
      }
    } catch (err) {
      alert('Camera access denied or unavailable. Please check your browser permissions.');
      console.error('WebRTC access denied:', err);
    }
  }

  // ─── Media Preview ─────────────────────────────────────
  function showMediaPreview(file) {
    const typeInfo = Utils.detectFileType(file);
    const objectURL = URL.createObjectURL(file);

    state.currentMedia = { file, type: typeInfo.type, objectURL };

    // Hide empty state
    if (els.viewportEmpty) els.viewportEmpty.style.display = 'none';

    // Clean up previous demo canvas
    const existingDemo = Utils.$('#demo-canvas');
    if (existingDemo) existingDemo.remove();

    if (typeInfo.type === 'image') {
      els.mediaImage.src = objectURL;
      els.mediaImage.style.display = 'block';
      els.mediaVideo.style.display = 'none';
      els.timelineContainer.style.display = 'none';
      els.audioSection.style.display = 'none';

    } else if (typeInfo.type === 'video') {
      els.mediaVideo.src = objectURL;
      els.mediaVideo.style.display = 'block';
      els.mediaImage.style.display = 'none';
      els.timelineContainer.style.display = 'flex';
      els.audioSection.style.display = 'block';

      els.mediaVideo.addEventListener('loadedmetadata', () => {
        if (els.timelineDuration) {
          els.timelineDuration.textContent = '/ ' + Utils.formatDuration(els.mediaVideo.duration);
        }
      });

    } else if (typeInfo.type === 'audio') {
      els.mediaImage.style.display = 'none';
      els.mediaVideo.style.display = 'none';
      els.timelineContainer.style.display = 'none';
      els.audioSection.style.display = 'block';
    }

    // Show forensic layers panel
    if (els.forensicLayersPanel) els.forensicLayersPanel.style.display = 'flex';
  }

  // ─── Progress Bar ──────────────────────────────────────
  function showProgressBar() {
    if (els.scanProgressContainer) els.scanProgressContainer.style.display = 'block';
    if (els.scanProgressFill) els.scanProgressFill.style.width = '0%';
    if (els.scanProgressLabel) els.scanProgressLabel.textContent = 'Initializing...';
  }

  function updateProgressBar(percent, label) {
    if (els.scanProgressFill) els.scanProgressFill.style.width = percent + '%';
    if (els.scanProgressLabel) els.scanProgressLabel.textContent = label || 'Processing...';
  }

  function hideProgressBar() {
    setTimeout(() => {
      if (els.scanProgressFill) els.scanProgressFill.style.width = '100%';
      if (els.scanProgressLabel) els.scanProgressLabel.textContent = 'Analysis Complete';
      setTimeout(() => {
        if (els.scanProgressContainer) els.scanProgressContainer.style.display = 'none';
      }, 800);
    }, 300);
  }

  // ─── Dashboard Loading ─────────────────────────────────
  function showDashboardLoading() {
    if (els.dashboardEmpty) els.dashboardEmpty.style.display = 'none';
    if (els.dashboardContent) {
      els.dashboardContent.innerHTML = `
        <div class="loading-skeleton">
          <div class="skeleton" style="height:60px;margin-bottom:12px;"></div>
          <div class="skeleton" style="height:20px;width:70%;margin-bottom:8px;"></div>
          <div class="skeleton" style="height:20px;width:50%;margin-bottom:8px;"></div>
          <div class="skeleton" style="height:20px;width:80%;margin-bottom:16px;"></div>
          <div class="skeleton" style="height:20px;width:60%;margin-bottom:8px;"></div>
          <div class="skeleton" style="height:20px;width:40%;margin-bottom:8px;"></div>
        </div>`;
    }
  }

  // ─── Render Analysis Results ───────────────────────────
  function renderAnalysisResults(result) {
    if (!result) return;

    try {
      // 1. Update risk score header
      const score = result.overallRisk.score;
      const conf = Utils.formatConfidence(score);
      if (els.riskScoreValue) {
        els.riskScoreValue.textContent = (score > 60 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW') + ' (' + score + '%)';
        els.riskScoreValue.style.color = conf.color;
      }
      if (els.riskBadge) {
        els.riskBadge.style.display = 'inline-flex';
        els.riskBadge.className = score > 60 ? 'badge badge-danger' : (score > 30 ? 'badge badge-warning' : 'badge badge-success');
        els.riskBadge.textContent = score > 60 ? 'FAIL' : (score > 30 ? 'WARN' : 'PASS');
      }

      // 2. Render dashboard sections
      if (dashboard) {
        dashboard.render(result);
      }

      // 3. Show action buttons
      if (els.dashboardActions) els.dashboardActions.style.display = 'flex';

      // 4. Render forensic overlays (with error protection)
      try { renderForensicOverlays(result); } catch (e) { console.warn('Overlay render error:', e); }

      // 5. Render timeline if video
      if (result.timeline && result.timeline.length > 0) {
        try { renderTimeline(result); } catch (e) { console.warn('Timeline render error:', e); }
      }

      // 6. Render provenance tree
      if (result.provenance && provenanceTree) {
        try {
          const provenanceContainer = document.createElement('div');
          provenanceContainer.className = 'provenance-section';
          provenanceContainer.id = 'provenance-display';
          const existing = Utils.$('#provenance-display');
          if (existing) existing.remove();
          els.dashboardContent.appendChild(provenanceContainer);
          const scenario = result.overallRisk.score > 60 ? 'tampered' : 'authentic';
          const mockProvData = provenanceTree.generateMockProvenance(scenario);
          provenanceTree.render(provenanceContainer, mockProvData);
        } catch (e) { console.warn('Provenance render error:', e); }
      }

      // 7. Render audio waveform (mock)
      if ((result.metadata.fileType === 'video' || result.metadata.fileType === 'audio') && waveformRenderer) {
        try {
          if (els.audioSection) els.audioSection.style.display = 'block';
          waveformRenderer.renderWaveform(els.waveformCanvas);
          waveformRenderer.renderSpectrogram(els.spectrogramCanvas);
        } catch (e) { console.warn('Waveform render error:', e); }
      }
    } catch (e) {
      console.error('Error rendering results:', e);
    }
  }

  // ─── Forensic Overlays ─────────────────────────────────
  function renderForensicOverlays(result) {
    if (!result || !result.heatmapData) return;

    const viewport = els.mediaViewport;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return; // viewport not visible

    // Size canvases to match viewport
    [els.heatmapCanvas, els.rppgCanvas, els.boundingCanvas].forEach(canvas => {
      if (canvas) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
      }
    });

    // Create heatmap renderer lazily (after canvas is properly sized)
    if (els.heatmapCanvas) {
      heatmapRenderer = new window.SatyaKavach.HeatmapRenderer(els.heatmapCanvas);

      // Convert bounding boxes to face regions
      const boxes = result.visualForensics?.faceSwapDetection?.boundingBoxes || [];
      const faceRegions = boxes.map(b => ({
        x: (b.x + b.w / 2) * rect.width,
        y: (b.y + b.h / 2) * rect.height,
        radiusX: (b.w / 2) * rect.width,
        radiusY: (b.h / 2) * rect.height,
        intensity: 0.8
      }));
      if (faceRegions.length === 0) {
        faceRegions.push({ x: rect.width * 0.5, y: rect.height * 0.4, radiusX: rect.width * 0.15, radiusY: rect.height * 0.2, intensity: 0.7 });
      }
      const mockMatrix = heatmapRenderer.generateMockHeatmap(Math.floor(rect.width), Math.floor(rect.height), faceRegions);
      heatmapRenderer.renderHeatmap(mockMatrix, Math.floor(rect.width), Math.floor(rect.height), 0.6);
      els.heatmapCanvas.style.opacity = state.overlays.heatmap ? '1' : '0';
    }

    // Draw bounding boxes
    if (result.visualForensics?.faceSwapDetection?.boundingBoxes && els.boundingCanvas) {
      drawBoundingBoxes(result.visualForensics.faceSwapDetection.boundingBoxes, rect);
      els.boundingCanvas.style.opacity = state.overlays.bounding ? '1' : '0';
    }

    // rPPG pulse mask
    if (els.rppgCanvas && window.SatyaKavach.HeatmapRenderer) {
      const rppgRenderer = new window.SatyaKavach.HeatmapRenderer(els.rppgCanvas);
      rppgRenderer.renderRPPGMask(Math.floor(rect.width), Math.floor(rect.height));
      els.rppgCanvas.style.opacity = state.overlays.rppg ? '1' : '0';
    }
  }

  function drawBoundingBoxes(boxes, viewportRect) {
    const ctx = els.boundingCanvas.getContext('2d');
    ctx.clearRect(0, 0, els.boundingCanvas.width, els.boundingCanvas.height);

    boxes.forEach(box => {
      const x = box.x * viewportRect.width;
      const y = box.y * viewportRect.height;
      const w = box.w * viewportRect.width;
      const h = box.h * viewportRect.height;

      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      ctx.shadowBlur = 0;
      const cornerLen = 12;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00d4ff';

      // Corners
      ctx.beginPath(); ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen); ctx.stroke();

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ff3366';
      ctx.fillText('Face Swap Detected', x, y - 6);
    });
  }

  // ─── Timeline ──────────────────────────────────────────
  function renderTimeline(result) {
    if (!result.timeline || !els.timelineContainer) return;

    els.timelineContainer.style.display = 'flex';

    const canvas = els.timelineCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : 800;
    canvas.width = width;
    canvas.height = 40;

    const duration = result.metadata.duration || 12.5;

    ctx.fillStyle = '#10101c';
    ctx.fillRect(0, 0, width, 40);

    result.timeline.forEach(marker => {
      const x = (marker.timestamp / duration) * width;
      const color = marker.type === 'anomaly' ? '#ff3366' : (marker.type === 'suspicious' ? '#ffaa00' : '#00e676');

      ctx.fillStyle = color + '33';
      ctx.fillRect(x - 20, 0, 40, 40);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 40); ctx.stroke();

      ctx.beginPath(); ctx.arc(x, 20, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    });

    if (els.timelineMarkers) {
      els.timelineMarkers.innerHTML = result.timeline.map(marker => {
        const color = marker.type === 'anomaly' ? '#ff3366' : (marker.type === 'suspicious' ? '#ffaa00' : '#00e676');
        const time = Utils.formatDuration(marker.timestamp);
        return `<span class="marker-label" style="color:${color}">
          <span class="marker-dot" style="background:${color}"></span>
          ${time}: ${marker.label}
        </span>`;
      }).join('');
    }

    if (els.frameSlider) {
      els.frameSlider.max = Math.floor(duration * 30);
      els.frameSlider.addEventListener('input', () => {
        const frame = parseInt(els.frameSlider.value);
        const time = frame / 30;
        if (els.timelineTime) els.timelineTime.textContent = Utils.formatDuration(time);
        if (els.mediaVideo && !isNaN(els.mediaVideo.duration)) {
          els.mediaVideo.currentTime = time;
        }
      });
    }

    if (els.btnPlayPause) {
      els.btnPlayPause.onclick = () => {
        if (els.mediaVideo) {
          if (els.mediaVideo.paused) {
            els.mediaVideo.play();
            els.btnPlayPause.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          } else {
            els.mediaVideo.pause();
            els.btnPlayPause.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
          }
        }
      };
    }
  }

  // ─── Toggle Events ─────────────────────────────────────
  function bindToggleEvents() {
    const syncToggles = (source, targets, overlayKey, canvasEl) => {
      if (!source) return;
      source.addEventListener('change', () => {
        state.overlays[overlayKey] = source.checked;
        if (canvasEl) {
          canvasEl.style.transition = 'opacity 200ms ease';
          canvasEl.style.opacity = source.checked ? '1' : '0';
        }
        targets.forEach(t => { if (t) t.checked = source.checked; });
      });
    };

    syncToggles(els.toggleHeatmap, [els.floatToggleHeatmap], 'heatmap', els.heatmapCanvas);
    syncToggles(els.toggleBounding, [els.floatToggleBounding], 'bounding', els.boundingCanvas);
    syncToggles(els.toggleRppg, [els.floatToggleRppg], 'rppg', els.rppgCanvas);
    syncToggles(els.floatToggleHeatmap, [els.toggleHeatmap], 'heatmap', els.heatmapCanvas);
    syncToggles(els.floatToggleBounding, [els.toggleBounding], 'bounding', els.boundingCanvas);
    syncToggles(els.floatToggleRppg, [els.toggleRppg], 'rppg', els.rppgCanvas);
  }

  // ─── Text Analyzer ────────────────────────────────────
  function bindTextAnalyzer() {
    if (!els.btnAnalyzeText) return;

    els.btnAnalyzeText.addEventListener('click', () => {
      const text = els.textInput.value.trim();
      if (!text) {
        alert('Please paste a message to analyze.');
        return;
      }

      const analyzer = window.SatyaKavach.TextAnalyzer;
      const result = analyzer.analyze(text);

      els.textResults.style.display = 'block';

      const conf = Utils.formatConfidence(result.score);
      els.textRiskScore.innerHTML = `
        <div class="risk-score-display">
          <span class="risk-score-value" style="font-size:36px;color:${conf.color};">${result.score}%</span>
          <span class="badge badge-${result.score >= 60 ? 'danger' : (result.score >= 30 ? 'warning' : 'success')}">${conf.label} RISK</span>
        </div>`;

      els.textClassification.innerHTML = `
        <div class="metric-row">
          <span class="metric-label">Classification</span>
          <span class="metric-value" style="color:${conf.color};">${result.classification}</span>
        </div>`;

      analyzer.renderHighlightedText(els.textHighlighted, text, result.annotations);
      els.textHighlighted.className = 'text-highlighted-output card';

      const tactics = {};
      result.annotations.forEach(a => { tactics[a.type] = (tactics[a.type] || 0) + 1; });
      els.textTactics.innerHTML = Object.entries(tactics).map(([type, count]) => `
        <div class="metric-row">
          <span class="metric-label">${type.replace(/_/g, ' ').toUpperCase()}</span>
          <span class="metric-value">${count} indicator${count > 1 ? 's' : ''} found</span>
        </div>`).join('');

      els.textRecommendation.innerHTML = `
        <div class="card" style="margin-top:12px;border-left:3px solid ${conf.color};">
          <strong>Recommended Action:</strong> ${result.recommendedAction}
        </div>`;
    });
  }

  // ─── Action Buttons ────────────────────────────────────
  function bindActionButtons() {
    // Request Human Review
    const reviewBtn = Utils.$('#btn-human-review');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        if (!state.analysisResult) {
          alert('No analysis available. Please analyze media first.');
          return;
        }
        const score = state.analysisResult.overallRisk.score;
        const fileName = state.analysisResult.metadata.fileName;
        const confirmed = confirm(
          `📋 Human Review Request\n\n` +
          `File: ${fileName}\n` +
          `Risk Score: ${score}%\n` +
          `Confidence: ${state.analysisResult.overallRisk.confidence.lower}%-${state.analysisResult.overallRisk.confidence.upper}%\n\n` +
          `This will submit the analysis to the human review queue.\n` +
          `Estimated review time: 2-4 hours.\n\n` +
          `Proceed with submission?`
        );
        if (confirmed) {
          reviewBtn.textContent = '✓ Review Requested';
          reviewBtn.disabled = true;
          reviewBtn.style.opacity = '0.6';
          setTimeout(() => {
            alert('✅ Review request submitted successfully.\n\nCase ID: SK-' + Utils.generateId().toUpperCase() + '\nYou will be notified when a human analyst completes the review.');
          }, 500);
        }
      });
    }

    // Download Report
    const downloadBtn = Utils.$('#btn-download-report');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (!state.analysisResult) {
          alert('No analysis available. Please analyze media first.');
          return;
        }
        // Generate a text report
        const r = state.analysisResult;
        const report = [
          '═══════════════════════════════════════════════════════════',
          '  SATYAKAVACH — CERTIFIED FORENSIC ANALYSIS REPORT',
          '  AI Deepfake & Scam Detection Platform',
          '═══════════════════════════════════════════════════════════',
          '',
          `Report ID: SK-${Utils.generateId().toUpperCase()}`,
          `Generated: ${new Date().toISOString()}`,
          `File: ${r.metadata.fileName}`,
          `Type: ${r.metadata.fileType}`,
          `Resolution: ${r.metadata.resolution}`,
          '',
          '───────────────────────────────────────────────────────────',
          '  RISK ASSESSMENT',
          '───────────────────────────────────────────────────────────',
          `Overall Risk Score: ${r.overallRisk.score}% (${r.overallRisk.label})`,
          `Confidence Interval: ${r.overallRisk.confidence.lower}% - ${r.overallRisk.confidence.upper}%`,
          '',
        ];

        if (r.visualForensics) {
          report.push('───────────────────────────────────────────────────────────');
          report.push('  VISUAL FORENSICS');
          report.push('───────────────────────────────────────────────────────────');
          report.push(`Face Swap Detection: ${r.visualForensics.faceSwapDetection.score}%`);
          report.push(`Expression Sync: ${r.visualForensics.expressionSync.score}%`);
          report.push(`Gaze Consistency: ${r.visualForensics.gazeConsistency.score}%`);
          report.push(`rPPG Pulse: BPM=${r.visualForensics.rppgPulse.bpm}, Consistency=${r.visualForensics.rppgPulse.consistency}%`);
          report.push('');
        }

        if (r.audioForensics) {
          report.push('───────────────────────────────────────────────────────────');
          report.push('  AUDIO FORENSICS');
          report.push('───────────────────────────────────────────────────────────');
          report.push(`Voice Clone: ${r.audioForensics.voiceClone.score}%`);
          report.push(`TTS Artifacts: ${r.audioForensics.ttsArtifacts.score}%`);
          report.push('');
        }

        report.push('───────────────────────────────────────────────────────────');
        report.push('  PROVENANCE');
        report.push('───────────────────────────────────────────────────────────');
        report.push(`C2PA Status: ${r.provenance.c2pa.status.toUpperCase()}`);
        report.push(`Device ID: ${r.provenance.deviceId.matched ? 'MATCHED' : 'MISMATCHED'} (${r.provenance.deviceId.device})`);
        report.push('');
        report.push('═══════════════════════════════════════════════════════════');
        report.push('  This report was generated by SatyaKavach v1.0.0-alpha');
        report.push('  Decode SIH 2026 · Bharati Pravrti');
        report.push('═══════════════════════════════════════════════════════════');

        const blob = new Blob([report.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SatyaKavach_Report_${Utils.generateId()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Share Securely
    const shareBtn = Utils.$('#btn-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (!state.analysisResult) {
          alert('No analysis available. Please analyze media first.');
          return;
        }
        const score = state.analysisResult.overallRisk.score;
        const shareText = `🔍 SatyaKavach Analysis Report\n\nFile: ${state.analysisResult.metadata.fileName}\nRisk Score: ${score}% (${state.analysisResult.overallRisk.label})\nVerdict: ${score > 60 ? '⚠️ LIKELY MANIPULATED' : score > 30 ? '⚡ UNCERTAIN' : '✅ LIKELY AUTHENTIC'}\n\nAnalyzed by SatyaKavach — AI Deepfake & Scam Detection`;

        if (navigator.share) {
          navigator.share({ title: 'SatyaKavach Report', text: shareText }).catch(() => {});
        } else {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(shareText).then(() => {
            alert('📋 Report summary copied to clipboard.\n\nYou can now paste it in any messaging app or email.');
          }).catch(() => {
            // Final fallback: show in prompt
            prompt('Copy this report summary:', shareText);
          });
        }
      });
    }
  }

  // ─── Demo Mode ─────────────────────────────────────────
  function bindDemoMode() {
    const demoBtn = Utils.$('#btn-demo-mode');
    if (!demoBtn) return;

    demoBtn.addEventListener('click', async () => {
      try {
        // Switch to dashboard view
        switchView('dashboard');

        // Show progress
        showProgressBar();
        showDashboardLoading();

        // Prepare viewport
        if (els.viewportEmpty) els.viewportEmpty.style.display = 'none';
        if (els.mediaImage) els.mediaImage.style.display = 'none';
        if (els.mediaVideo) els.mediaVideo.style.display = 'none';

        // Remove any existing demo canvas
        const existingDemo = Utils.$('#demo-canvas');
        if (existingDemo) existingDemo.remove();

        // Create demo face canvas
        const demoCanvas = document.createElement('canvas');
        demoCanvas.width = 640;
        demoCanvas.height = 480;
        demoCanvas.className = 'media-content';
        demoCanvas.id = 'demo-canvas';
        demoCanvas.style.display = 'block';
        demoCanvas.style.maxWidth = '100%';
        demoCanvas.style.maxHeight = '100%';

        const dCtx = demoCanvas.getContext('2d');

        // Background
        dCtx.fillStyle = '#1a1a2e';
        dCtx.fillRect(0, 0, 640, 480);

        // Hair
        dCtx.beginPath();
        dCtx.ellipse(320, 175, 120, 100, 0, Math.PI, 0);
        dCtx.fillStyle = '#2a1a0a';
        dCtx.fill();

        // Face oval
        dCtx.beginPath();
        dCtx.ellipse(320, 220, 100, 130, 0, 0, Math.PI * 2);
        dCtx.fillStyle = '#c4956a';
        dCtx.fill();

        // Eyes
        dCtx.beginPath(); dCtx.ellipse(285, 200, 15, 10, 0, 0, Math.PI * 2); dCtx.fillStyle = '#fff'; dCtx.fill();
        dCtx.beginPath(); dCtx.ellipse(355, 200, 15, 10, 0, 0, Math.PI * 2); dCtx.fill();
        dCtx.beginPath(); dCtx.arc(287, 200, 6, 0, Math.PI * 2); dCtx.fillStyle = '#2a1a0a'; dCtx.fill();
        dCtx.beginPath(); dCtx.arc(357, 200, 6, 0, Math.PI * 2); dCtx.fill();

        // Eyebrows
        dCtx.lineWidth = 3; dCtx.strokeStyle = '#3a2a1a';
        dCtx.beginPath(); dCtx.moveTo(268, 183); dCtx.quadraticCurveTo(285, 175, 302, 183); dCtx.stroke();
        dCtx.beginPath(); dCtx.moveTo(338, 183); dCtx.quadraticCurveTo(355, 175, 372, 183); dCtx.stroke();

        // Nose
        dCtx.beginPath(); dCtx.moveTo(320, 215); dCtx.lineTo(310, 250); dCtx.lineTo(330, 250); dCtx.closePath();
        dCtx.fillStyle = '#b8855d'; dCtx.fill();

        // Mouth
        dCtx.beginPath(); dCtx.arc(320, 280, 25, 0.1, Math.PI - 0.1);
        dCtx.strokeStyle = '#8a5d3b'; dCtx.lineWidth = 2; dCtx.stroke();

        // Scan lines overlay
        for (let i = 0; i < 480; i += 4) {
          dCtx.fillStyle = 'rgba(0, 212, 255, 0.02)';
          dCtx.fillRect(0, i, 640, 1);
        }

        // Detection bounding box
        dCtx.strokeStyle = '#ff3366'; dCtx.lineWidth = 2; dCtx.setLineDash([6, 3]);
        dCtx.strokeRect(210, 80, 220, 280);
        dCtx.setLineDash([]);

        // Labels
        dCtx.font = 'bold 14px "JetBrains Mono", monospace';
        dCtx.fillStyle = '#00d4ff';
        dCtx.textAlign = 'center';
        dCtx.fillText('[ DEMO MODE — Synthetic Face Sample ]', 320, 420);
        dCtx.font = '12px "Inter", sans-serif';
        dCtx.fillStyle = '#8888aa';
        dCtx.fillText('SatyaKavach Forensic Analysis Engine v1.0', 320, 445);

        // Add to viewport
        els.mediaViewport.insertBefore(demoCanvas, els.heatmapCanvas);

        // Show panels
        if (els.forensicLayersPanel) els.forensicLayersPanel.style.display = 'flex';
        if (els.timelineContainer) els.timelineContainer.style.display = 'flex';
        if (els.audioSection) els.audioSection.style.display = 'block';

        // Progressive analysis stages
        const stages = [
          { msg: 'Extracting metadata & EXIF data...', pct: 10 },
          { msg: 'Running facial landmark detection...', pct: 25 },
          { msg: 'Analyzing rPPG vascular signals...', pct: 40 },
          { msg: 'Detecting face swap seam artifacts...', pct: 55 },
          { msg: 'Spectral voice analysis...', pct: 65 },
          { msg: 'C2PA provenance chain validation...', pct: 78 },
          { msg: 'Cross-referencing threat intelligence...', pct: 90 },
          { msg: 'Generating certified report...', pct: 100 }
        ];

        for (const stage of stages) {
          updateProgressBar(stage.pct, stage.msg);
          await Utils.delay(350);
        }

        // Build demo result directly (don't call MockAnalyzer to avoid extra delays)
        const demoResult = {
          overallRisk: { score: 88, label: 'HIGH', confidence: { lower: 82, upper: 93, mean: 88 } },
          visualForensics: {
            faceSwapDetection: { score: 92, confidence: 95, boundingBoxes: [{ x: 0.33, y: 0.17, w: 0.34, h: 0.58 }] },
            expressionSync: { score: 55, confidence: 78, label: 'Inconsistent' },
            gazeConsistency: { score: 72, details: 'Specular highlights mismatch detected' },
            lightingShadow: { score: 65, details: 'Inconsistent ambient occlusion on jawline' },
            rppgPulse: { detected: true, bpm: 0, consistency: 18 },
            microBehaviors: { blinkRate: 0.2, pupilDilation: 'Static', microTremors: 'Absent', throatMovement: 'Irregular' }
          },
          audioForensics: {
            voiceClone: { score: 84, confidence: 91 },
            ttsArtifacts: { score: 15, confidence: 65 },
            phonemeVisemeSync: { score: 72, details: 'Lip sync mismatch at 00:35' },
            spectralAnomalies: [
              { timestamp: '00:12', type: 'Phase Discontinuity', severity: 'High' },
              { timestamp: '00:35', type: 'Formant Gap', severity: 'Medium' }
            ],
            breathPauses: { natural: 3, synthetic: 11 }
          },
          provenance: {
            c2pa: { status: 'missing', chain: [] },
            deviceId: { matched: false, device: 'Unknown' },
            editHistory: [{ software: 'DeepFaceLab', action: 'Face Swap', timestamp: '2026-08-10T12:00:00Z' }]
          },
          threatIntel: {
            scamPattern: { matched: true, name: 'Deepfake Impersonation' },
            vectorHistory: { count: 42, details: 'Pattern seen in known threat actor campaigns' },
            sourceReputation: { score: 15, platform: 'Unknown' }
          },
          timeline: [
            { timestamp: 2.0, frameIndex: 60, type: 'anomaly', label: 'Anomaly', score: 88 },
            { timestamp: 5.8, frameIndex: 174, type: 'suspicious', label: 'Potential Phase Inconsistency', score: 65 },
            { timestamp: 10.5, frameIndex: 315, type: 'normal', label: 'Normal', score: 12 }
          ],
          heatmapData: { width: 256, height: 256, matrix: new Float32Array(256 * 256).map(() => Math.random()) },
          metadata: {
            fileName: 'demo_synthetic_face.mp4',
            fileType: 'video',
            fileSize: 24800000,
            duration: 12.5,
            resolution: '1920x1080',
            analyzedAt: new Date().toISOString()
          }
        };

        state.analysisResult = demoResult;
        state.analysisHistory.push({
          id: Utils.generateId(),
          result: demoResult,
          timestamp: new Date().toISOString(),
          fileName: 'demo_synthetic_face.mp4'
        });

        hideProgressBar();
        renderAnalysisResults(demoResult);

        // Auto-enable overlays for demo
        state.overlays.heatmap = true;
        state.overlays.bounding = true;
        [els.toggleHeatmap, els.floatToggleHeatmap].forEach(el => { if (el) el.checked = true; });
        [els.toggleBounding, els.floatToggleBounding].forEach(el => { if (el) el.checked = true; });
        if (els.heatmapCanvas) els.heatmapCanvas.style.opacity = '1';
        if (els.boundingCanvas) els.boundingCanvas.style.opacity = '1';

        console.log('[SatyaKavach] Demo mode loaded successfully');
      } catch (err) {
        console.error('[SatyaKavach] Demo mode error:', err);
        hideProgressBar();
        alert('Demo failed to load. Check browser console for details.\nError: ' + err.message);
      }
    });
  }

  // ─── Keyboard Shortcuts ────────────────────────────────
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case '1': switchView('dashboard'); break;
        case '2': switchView('history'); break;
        case '3': switchView('api'); break;
        case '4': switchView('text-analyzer'); break;
        case 'h':
          if (els.toggleHeatmap) { els.toggleHeatmap.checked = !els.toggleHeatmap.checked; els.toggleHeatmap.dispatchEvent(new Event('change')); }
          break;
        case 'b':
          if (els.toggleBounding) { els.toggleBounding.checked = !els.toggleBounding.checked; els.toggleBounding.dispatchEvent(new Event('change')); }
          break;
        case 'r':
          if (els.toggleRppg) { els.toggleRppg.checked = !els.toggleRppg.checked; els.toggleRppg.dispatchEvent(new Event('change')); }
          break;
        case ' ':
          e.preventDefault();
          if (els.btnPlayPause) els.btnPlayPause.click();
          break;
        case 'ArrowLeft':
          if (els.mediaVideo && !isNaN(els.mediaVideo.duration)) {
            els.mediaVideo.currentTime = Math.max(0, els.mediaVideo.currentTime - (e.shiftKey ? 10/30 : 1/30));
          }
          break;
        case 'ArrowRight':
          if (els.mediaVideo && !isNaN(els.mediaVideo.duration)) {
            els.mediaVideo.currentTime = Math.min(els.mediaVideo.duration, els.mediaVideo.currentTime + (e.shiftKey ? 10/30 : 1/30));
          }
          break;
      }
    });
  }

  return { init, state };
})();

// ─── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.SatyaKavach.App.init();
});
