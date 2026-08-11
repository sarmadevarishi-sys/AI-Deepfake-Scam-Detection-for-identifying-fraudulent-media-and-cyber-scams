window.SatyaKavach = window.SatyaKavach || {};

window.SatyaKavach.Dashboard = (function() {
  const Utils = window.SatyaKavach.Utils;

  class Dashboard {
    constructor(containerSelector) {
      this.container = Utils.$(containerSelector);
    }

    render(analysisResult) {
      if (!this.container) return;
      this.container.innerHTML = '';
      
      const r = analysisResult;
      
      // Header & Overall Risk
      const header = Utils.createElement('div', 'dashboard-header');
      const scoreDiv = Utils.createElement('div', 'risk-score-container');
      const conf = Utils.formatConfidence(r.overallRisk.score);
      scoreDiv.innerHTML = `
        <h2 class="section-title">Forensic Risk Assessment</h2>
        <div class="score-display">
          <div class="score-number ${conf.class}" id="risk-score-num">0</div>
          <div class="score-label ${conf.class}">${conf.label} RISK</div>
        </div>
        <div class="confidence-bar-container">
          <div class="confidence-track">
            <div class="confidence-range" style="left: ${r.overallRisk.confidence.lower}%; width: ${r.overallRisk.confidence.upper - r.overallRisk.confidence.lower}%"></div>
            <div class="confidence-pin" style="left: ${r.overallRisk.confidence.mean}%"></div>
          </div>
          <div class="confidence-labels">
            <span>0</span>
            <span>Confidence Interval</span>
            <span>100</span>
          </div>
        </div>
      `;
      header.appendChild(scoreDiv);
      this.container.appendChild(header);

      Utils.animateValue(scoreDiv.querySelector('#risk-score-num'), 0, r.overallRisk.score, 1000);

      // Sections mapping
      const sectionsMap = [
        { title: 'Visual Forensics', key: 'visualForensics' },
        { title: 'Audio Forensics', key: 'audioForensics' },
        { title: 'Provenance', key: 'provenance' },
        { title: 'Threat Intelligence', key: 'threatIntel' }
      ];

      sectionsMap.forEach(sec => {
        if (r[sec.key]) {
          this.container.appendChild(this._createSection(sec.title, r[sec.key]));
        }
      });

      // Actions
      const actions = Utils.createElement('div', 'dashboard-actions');
      actions.innerHTML = `
        <button class="btn btn-primary" id="btn-request-human">Request Human Review</button>
        <button class="btn btn-secondary" id="btn-download-report">Download Certified Report (PDF)</button>
        <button class="btn btn-outline" id="btn-share">Share Securely</button>
      `;
      this.container.appendChild(actions);

      // We re-bind action buttons by dispatching an event that app.js can listen to, or we let app.js bind them via delegation
      // Actually app.js binds to the document so it handles these IDs
    }

    _createSection(title, data) {
      const section = Utils.createElement('div', 'dashboard-section');
      const header = Utils.createElement('div', 'section-header');
      header.innerHTML = `<h3>${title}</h3><span class="collapse-icon">▼</span>`;
      
      const content = Utils.createElement('div', 'section-content');
      
      header.addEventListener('click', () => {
        content.classList.toggle('collapsed');
        header.querySelector('.collapse-icon').style.transform = content.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';
      });
      section.appendChild(header);

      for (const [key, val] of Object.entries(data)) {
        if (key === 'c2pa' || key === 'deviceId' || key === 'editHistory' || key === 'timeline' || key === 'heatmapData') continue; // Handle nested objects separately if needed, simplified for now
        
        const row = Utils.createElement('div', 'metric-row');
        // format key from camelCase to Title Case
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const label = Utils.createElement('div', 'metric-label', { textContent: formattedKey });
        
        let valueStr = '';
        let confClass = '';
        if (typeof val === 'object' && val !== null) {
          if (val.score !== undefined) {
             valueStr = `${val.score}%`;
             if(val.label) valueStr += ` (${val.label})`;
             if(val.details) valueStr += ` - ${val.details}`;
             confClass = Utils.formatConfidence(val.score).class;
          } else if (val.matched !== undefined) {
             valueStr = val.matched ? 'MATCHED' : 'CLEAN';
             if(val.name) valueStr += ` (${val.name})`;
             confClass = val.matched ? 'text-danger' : 'text-success';
          } else {
             valueStr = JSON.stringify(val);
          }
        } else {
          valueStr = val.toString();
        }

        const value = Utils.createElement('div', 'metric-value', { textContent: valueStr });
        if (confClass) value.classList.add(confClass);

        row.appendChild(label);
        row.appendChild(value);
        content.appendChild(row);
      }
      section.appendChild(content);
      return section;
    }

    clear() {
      if (this.container) this.container.innerHTML = '';
    }

    showLoading() {
      if (this.container) {
        this.container.innerHTML = '<div class="loading-skeleton"><div class="pulse">Extracting Forensics...</div></div>';
      }
    }
  }

  return Dashboard;
})();
