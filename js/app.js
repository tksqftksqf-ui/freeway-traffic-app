/**
 * 國道1號與3號即時路況 UI 與 互動邏輯 (App Controller)
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = new TrafficEngine();
  
  // 當前選取狀態
  let currentHighwayId = 'n1';
  let currentCountyFilter = 'ALL';
  let savedPresets = JSON.parse(localStorage.getItem('freeway_saved_presets') || '[]');

  // DOM 元素引用
  const highwayTabs = document.querySelectorAll('.highway-tab');
  const startSelect = document.getElementById('startInterchange');
  const endSelect = document.getElementById('endInterchange');
  const swapBtn = document.getElementById('swapBtn');
  const queryBtn = document.getElementById('queryBtn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const closureTestBtn = document.getElementById('closureTestBtn');
  const countyChipsContainer = document.getElementById('countyChips');
  const presetsList = document.getElementById('presetsList');

  // UI 結果展現區 DOM
  const summaryBox = document.getElementById('summaryCard');
  const detourCardContainer = document.getElementById('detourCardContainer');
  const timelineContainer = document.getElementById('visualTimeline');
  const incidentsListContainer = document.getElementById('incidentsList');

  // 初始化列表
  initPresetButtons();
  renderCountyChips();
  populateInterchangeSelects();

  // 預設選取五股到中壢 (國1) 或 土城到關西 (國3)
  setSelectValues('n1_33', 'n1_62');

  // ----------------------------------------------------
  // 事件監聽 Event Listeners
  // ----------------------------------------------------

  // 1. 切換國1 / 國3
  highwayTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      highwayTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentHighwayId = tab.dataset.hw;
      currentCountyFilter = 'ALL';
      renderCountyChips();
      populateInterchangeSelects();
      
      // 設定該國道典型常用預設點
      if (currentHighwayId === 'n1') {
        setSelectValues('n1_33', 'n1_62'); // 五股 -> 中壢
      } else if (currentHighwayId === 'n3') {
        setSelectValues('n3_35', 'n3_79'); // 中和 -> 關西
      } else if (currentHighwayId === 'e88') {
        setSelectValues('e88_0', 'e88_21'); // 五甲系統 -> 竹田系統
      } else if (currentHighwayId === 'cross') {
        setSelectValues('n1_33', 'e88_22'); // 五股 (國1) -> 竹田端 (台88)
      }
      performQuery();
    });
  });

  // 2. 起終點反轉
  swapBtn.addEventListener('click', () => {
    const temp = startSelect.value;
    startSelect.value = endSelect.value;
    endSelect.value = temp;
    performQuery();
  });

  // 3. 即時查詢按鈕
  queryBtn.addEventListener('click', performQuery);

  // 4. 下拉選單切換即觸發查詢
  startSelect.addEventListener('change', performQuery);
  endSelect.addEventListener('change', performQuery);

  // 5. 重新整理 / 模擬更新 (清除模擬並刷新路況)
  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    engine.clearClosure();
    engine.generateMockIncidents();
    setTimeout(() => {
      performQuery();
      updateClosureBtnState();
      refreshBtn.classList.remove('spinning');
    }, 400);
  });

  // 5.1 模擬全線封閉警示測試與一鍵還原開關
  if (closureTestBtn) {
    closureTestBtn.addEventListener('click', () => {
      if (engine.hasActiveClosure()) {
        engine.clearClosure();
      } else {
        const startId = startSelect.value;
        const endId = endSelect.value;
        engine.simulateClosureForRoute(currentHighwayId, startId, endId);
      }
      performQuery();
      updateClosureBtnState();
    });
  }

  // 6. 儲存至常用路線 (Bookmark)
  bookmarkBtn.addEventListener('click', () => {
    const startId = startSelect.value;
    const endId = endSelect.value;
    if (!startId || !endId || startId === endId) {
      alert('請選擇有效的起點與終點交流道！');
      return;
    }

    let routeName = '';
    if (currentHighwayId === 'cross') {
      const startHwKey = startId.split('_')[0];
      const endHwKey = endId.split('_')[0];
      const startHw = HIGHWAY_DATA[startHwKey];
      const endHw = HIGHWAY_DATA[endHwKey];
      const startNode = startHw?.interchanges.find(i => i.id === startId);
      const endNode = endHw?.interchanges.find(i => i.id === endId);
      const startLabel = startNode ? `[${startHw.shortName}] ${startNode.name}` : startId;
      const endLabel = endNode ? `[${endHw.shortName}] ${endNode.name}` : endId;
      routeName = `跨線：${startLabel} ➔ ${endLabel}`;
    } else {
      const hw = HIGHWAY_DATA[currentHighwayId];
      if (!hw) return;
      const startNode = hw.interchanges.find(i => i.id === startId);
      const endNode = hw.interchanges.find(i => i.id === endId);
      const startLabel = startNode ? startNode.name : startId;
      const endLabel = endNode ? endNode.name : endId;
      routeName = `${hw.shortName}：${startLabel} ➔ ${endLabel}`;
    }

    const presetId = `preset_${currentHighwayId}_${startId}_${endId}`;
    if (savedPresets.some(p => p.id === presetId)) {
      alert('此路線已儲存在常用清單中囉！');
      return;
    }

    const newPreset = {
      id: presetId,
      highwayId: currentHighwayId,
      startId: startId,
      endId: endId,
      name: routeName
    };

    savedPresets.push(newPreset);
    localStorage.setItem('freeway_saved_presets', JSON.stringify(savedPresets));
    initPresetButtons();
    alert(`⭐️ 已成功將「${routeName}」加入常用路線！`);
  });

  // 7. 初始執行首次查詢
  performQuery();

  // ----------------------------------------------------
  // 核心功能函數 Functions
  // ----------------------------------------------------

  function renderCountyChips() {
    let counties = [];
    if (currentHighwayId === 'cross') {
      const set = new Set();
      ['n1', 'n3', 'e88'].forEach(k => {
        if (HIGHWAY_DATA[k]) HIGHWAY_DATA[k].counties.forEach(c => set.add(c));
      });
      counties = Array.from(set);
    } else {
      const hw = HIGHWAY_DATA[currentHighwayId];
      if (!hw) return;
      counties = hw.counties;
    }

    countyChipsContainer.innerHTML = '';

    const allChip = document.createElement('div');
    allChip.className = `county-chip ${currentCountyFilter === 'ALL' ? 'active' : ''}`;
    allChip.textContent = '全部縣市';
    allChip.addEventListener('click', () => {
      currentCountyFilter = 'ALL';
      renderCountyChips();
      populateInterchangeSelects();
    });
    countyChipsContainer.appendChild(allChip);

    counties.forEach(county => {
      const chip = document.createElement('div');
      chip.className = `county-chip ${currentCountyFilter === county ? 'active' : ''}`;
      chip.textContent = county;
      chip.addEventListener('click', () => {
        currentCountyFilter = county;
        renderCountyChips();
        populateInterchangeSelects();
      });
      countyChipsContainer.appendChild(chip);
    });
  }

  function populateInterchangeSelects() {
    if (currentHighwayId === 'cross') {
      const curStart = startSelect.value;
      const curEnd = endSelect.value;

      startSelect.innerHTML = '';
      endSelect.innerHTML = '';

      ['n1', 'n3', 'e88'].forEach(hwKey => {
        const hw = HIGHWAY_DATA[hwKey];
        if (!hw) return;
        let list = hw.interchanges;
        if (currentCountyFilter !== 'ALL') {
          list = hw.interchanges.filter(item => item.county === currentCountyFilter);
        }
        if (list.length === 0) return;

        const group1 = document.createElement('optgroup');
        group1.label = hw.name;
        const group2 = document.createElement('optgroup');
        group2.label = hw.name;

        list.forEach(item => {
          const opt1 = document.createElement('option');
          opt1.value = item.id;
          opt1.textContent = `[${hw.shortName}] ${item.km.toFixed(1)}K ${item.name} (${item.county})`;

          const opt2 = document.createElement('option');
          opt2.value = item.id;
          opt2.textContent = `[${hw.shortName}] ${item.km.toFixed(1)}K ${item.name} (${item.county})`;

          group1.appendChild(opt1);
          group2.appendChild(opt2);
        });

        startSelect.appendChild(group1);
        endSelect.appendChild(group2);
      });

      if (curStart && startSelect.querySelector(`option[value="${curStart}"]`)) {
        startSelect.value = curStart;
      } else {
        startSelect.value = 'n1_33';
      }

      if (curEnd && endSelect.querySelector(`option[value="${curEnd}"]`)) {
        endSelect.value = curEnd;
      } else {
        endSelect.value = 'e88_22';
      }
      return;
    }

    const hw = HIGHWAY_DATA[currentHighwayId];
    let filteredList = hw.interchanges;

    if (currentCountyFilter !== 'ALL') {
      filteredList = hw.interchanges.filter(item => item.county === currentCountyFilter);
    }

    const curStart = startSelect.value;
    const curEnd = endSelect.value;

    startSelect.innerHTML = '';
    endSelect.innerHTML = '';

    hw.interchanges.forEach(item => {
      const opt1 = document.createElement('option');
      opt1.value = item.id;
      opt1.textContent = `${item.km.toFixed(1)}K ${item.name} (${item.county})`;

      const opt2 = document.createElement('option');
      opt2.value = item.id;
      opt2.textContent = `${item.km.toFixed(1)}K ${item.name} (${item.county})`;

      startSelect.appendChild(opt1);
      endSelect.appendChild(opt2);
    });

    if (hw.interchanges.some(i => i.id === curStart)) {
      startSelect.value = curStart;
    } else {
      startSelect.value = hw.interchanges[0].id;
    }

    if (hw.interchanges.some(i => i.id === curEnd) && curEnd !== startSelect.value) {
      endSelect.value = curEnd;
    } else {
      endSelect.value = hw.interchanges[hw.interchanges.length - 1].id;
    }
  }

  function setSelectValues(startId, endId) {
    if (startSelect.querySelector(`option[value="${startId}"]`)) startSelect.value = startId;
    if (endSelect.querySelector(`option[value="${endId}"]`)) endSelect.value = endId;
  }

  function updateClosureBtnState() {
    if (!closureTestBtn) return;
    const hasClosure = engine.hasActiveClosure();
    if (hasClosure) {
      closureTestBtn.classList.add('restore-mode');
      closureTestBtn.innerHTML = '<span>🟢 解除封閉 (還原)</span>';
      closureTestBtn.title = '點擊立即解除全線封閉管制並還原正常路況';
    } else {
      closureTestBtn.classList.remove('restore-mode');
      closureTestBtn.innerHTML = '<span>🚨 模擬全線封閉</span>';
      closureTestBtn.title = '模擬當前路線全線封閉警示測試';
    }
  }

  function performQuery() {
    const startId = startSelect.value;
    const endId = endSelect.value;

    if (!startId || !endId) return;

    if (startId === endId) {
      summaryBox.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: #94A3B8; padding: 20px;">請選擇不同的起點與終點交流道。</div>`;
      detourCardContainer.innerHTML = '';
      timelineContainer.innerHTML = '';
      if (incidentsListContainer) incidentsListContainer.innerHTML = '';
      return;
    }

    const result = engine.evaluateRoute(currentHighwayId, startId, endId);
    if (!result) return;

    renderSummary(result);
    renderDetourCard(result);
    renderVisualTimeline(result);
    if (incidentsListContainer) renderIncidentsList(result);
    updateClosureBtnState();
  }

  function renderSummary(result) {
    const status = result.overallStatus;
    const isClosed = result.hasFullClosure;

    summaryBox.innerHTML = `
      <div class="stat-box">
        <span class="stat-label">行駛路段與方向</span>
        <span class="stat-value" style="font-size: 1.15rem; color: #0284C7;">
          ${result.start.name} ➔ ${result.end.name}
        </span>
        <span class="stat-unit">${result.directionName} · 約 ${result.totalDistance} km</span>
      </div>

      <div class="stat-box" ${isClosed ? 'style="background: #FEF2F2; border: 1.5px solid #FCA5A5;"' : ''}>
        <span class="stat-label" ${isClosed ? 'style="color: #991B1B; font-weight: 800;"' : ''}>平均時速評估</span>
        <span class="stat-value" style="color: ${status.color};">
          ${result.averageSpeed} <span class="stat-unit">km/h</span>
        </span>
        <span class="stat-unit" ${isClosed ? 'style="color: #DC2626; font-weight: 800;"' : ''}>${isClosed ? '⛔ 全線通行中斷' : `最低時速: ${result.worstSpeed} km/h`}</span>
      </div>

      <div class="stat-box" ${isClosed ? 'style="background: #FEF2F2; border: 1.5px solid #FCA5A5;"' : ''}>
        <span class="stat-label" ${isClosed ? 'style="color: #991B1B; font-weight: 800;"' : ''}>預估行駛時間</span>
        <span class="stat-value" ${isClosed ? 'style="color: #DC2626; font-size: 1.25rem;"' : ''}>
          ${isClosed ? '無法通行' : `${result.totalTravelMinutes} <span class="stat-unit">分鐘</span>`}
        </span>
        <span class="stat-unit" ${isClosed ? 'style="color: #DC2626; font-weight: 800;"' : ''}>${isClosed ? '⚠️ 需強制改道' : `順暢正常時約 ${Math.round(result.totalDistance / 90 * 60)} 分鐘`}</span>
      </div>

      <div class="stat-box" ${isClosed ? 'style="background: #FEF2F2; border: 1.5px solid #FCA5A5;"' : ''}>
        <span class="stat-label" ${isClosed ? 'style="color: #991B1B; font-weight: 800;"' : ''}>整體即時路況</span>
        <div class="status-badge" style="background: ${status.bg}; color: ${status.color}; border: 1px solid ${status.border}; margin-top: 4px; ${isClosed ? 'font-weight: 900;' : ''}">
          ${status.icon} ${status.label}
        </div>
      </div>
    `;
  }

  function renderDetourCard(result) {
    const detour = result.detourAdvice;
    const isRecommended = detour.recommended;
    const rule = detour.rule;
    const isClosed = result.hasFullClosure;

    if (isClosed) {
      detourCardContainer.innerHTML = `
        <div class="emergency-closure-box">
          <div class="emergency-closure-header">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div class="emergency-badge">🚨 重大緊急管制警報</div>
              <div class="emergency-time">⚠️ 高公局交控中心緊急發布</div>
            </div>
            <button id="dismissClosureBtn" class="dismiss-closure-btn" title="立即解除模擬全線封閉管制並還原正常路況">
              <span>🟢 一鍵解除封閉（還原正常）</span>
            </button>
          </div>
          <div class="emergency-title">⛔ 該行走路線目前【全線封閉禁止通行】！</div>
          <div class="emergency-desc">偵測到您欲行駛之路段發生嚴重事故或緊急管制，原國道已完全阻斷無法通行，請切勿進入！</div>

          <div class="emergency-incidents-list">
            ${(result.closedIncidents || []).map(inc => `
              <div class="emergency-incident-pill">
                <div class="emergency-incident-icon">⛔</div>
                <div class="emergency-incident-content">
                  <div class="emergency-incident-loc">
                    <strong>${inc.locationName} ${inc.title}</strong>
                    ${inc.nearestInterchangeName ? `<span class="emergency-incident-near">(靠近 ${inc.nearestInterchangeName})</span>` : ''}
                  </div>
                  <div class="emergency-incident-desc">${inc.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="emergency-detour-notice">
            <div class="detour-notice-icon">📢</div>
            <div><strong>強制改道指令：</strong> 原國道路段已完全中斷！系統已為您啟動替代改道路線，請務必配合現場標誌提早於安全交流道駛離。</div>
          </div>
        </div>

        <div class="detour-card" style="border: 2px solid #EF4444; background: #FFFDF5;">
          <div class="detour-header">
            <div>
              <div class="detour-title" style="color: #991B1B;">🛣️ 系統指定避險改道路線：${rule.alternateRouteName}</div>
              <div class="detour-reason">${detour.reason}</div>
            </div>
            <div class="detour-badge" style="background: #DC2626; color: #FFFFFF; border-color: #B91C1C;">⛔ 強制改道</div>
          </div>

          <div class="comparison-grid">
            <div class="comparison-box" style="border-color: #F87171; background: #FEF2F2;">
              <div class="box-tag" style="color: #991B1B;">🚗 原國道路線 (${result.highway ? result.highway.shortName : '國道'})</div>
              <div class="box-value" style="color: #DC2626;">無法通行</div>
              <div style="font-size: 0.85rem; color: #B91C1C; margin-top: 4px; font-weight: 700;">⛔ 全線封閉中斷 (時速 0 km/h)</div>
            </div>

            <div class="comparison-box alt-box" style="border-color: #10B981; background: #F0FDF4;">
              <div class="box-tag" style="color: #065F46;">🛣️ 建議改道路線：${rule.alternateRouteName}</div>
              <div class="box-value" style="color: #047857;">預估 ${detour.detourTravelMins} 分鐘</div>
              <div class="save-time-highlight" style="color: #047857; font-size: 0.85rem; font-weight: 700; margin-top: 4px;">⚡ 唯一順暢可行替代路線！</div>
            </div>
          </div>

          <div class="turn-instructions">
            <div style="font-size: 0.88rem; font-weight: 800; color: #0F172A; margin-bottom: 10px;">📍 改道路線切換指引：</div>
            <div class="instruction-step">
              <span class="step-num" style="background: #DC2626;">1</span>
              <div><strong>駛離國道：</strong> ${rule.offRampInstruction}</div>
            </div>
            <div class="instruction-step">
              <span class="step-num" style="background: #DC2626;">2</span>
              <div><strong>替代道路：</strong> 順行 ${rule.alternateRouteName}，沿途注意省道/快速道路速限指示與警力疏導。</div>
            </div>
            <div class="instruction-step">
              <span class="step-num" style="background: #DC2626;">3</span>
              <div><strong>重新匯入：</strong> ${rule.onRampInstruction}</div>
            </div>
          </div>
        </div>
      `;

      const dismissBtn = document.getElementById('dismissClosureBtn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          engine.clearClosure();
          performQuery();
          updateClosureBtnState();
        });
      }

      return;
    }

    if (!isRecommended) {
      detourCardContainer.innerHTML = `
        <div class="detour-card smooth-route">
          <div class="detour-header">
            <div>
              <div class="detour-title">🟢 目前國道路況順暢，行駛原國道最快速！</div>
              <div class="detour-reason">${detour.reason}</div>
              ${result.incidents && result.incidents.length > 0 ? `
                <div class="header-incidents-block" style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                  ${result.incidents.map(inc => `
                    <div style="background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                      <span>${inc.icon}</span>
                      <div>
                        <strong style="color: #065F46;">${inc.locationName} ${inc.title}</strong>
                        ${inc.nearestInterchangeName ? `<span style="color: #B45309; font-weight: 700; margin-left: 6px;">(靠近 ${inc.nearestInterchangeName})</span>` : ''}
                        <span style="color: #334155; margin-left: 6px;">— ${inc.desc}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            <div class="detour-badge no-detour">👍 建議行駛原國道</div>
          </div>
        </div>
      `;
      return;
    }

    detourCardContainer.innerHTML = `
      <div class="detour-card">
        <div class="detour-header">
          <div>
            <div class="detour-title">⚠️ 偵測到壅塞/事故！建議最佳改道路線</div>
            <div class="detour-reason">${detour.reason}</div>
            ${result.incidents && result.incidents.length > 0 ? `
              <div class="header-incidents-block" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                ${result.incidents.map(inc => `
                  <div style="background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 8px 14px; border-radius: 8px; font-size: 0.88rem; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.1rem; flex-shrink: 0;">${inc.icon}</span>
                    <div>
                      <strong style="color: #991B1B;">${inc.locationName} ${inc.title}</strong>
                      ${inc.nearestInterchangeName ? `<span style="color: #B45309; font-weight: 700; margin-left: 6px;">(靠近 ${inc.nearestInterchangeName})</span>` : ''}
                      <span style="color: #475569; margin-left: 6px;">— ${inc.desc}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div class="detour-badge">🛣️ 建議改道</div>
        </div>

        <div class="comparison-grid">
          <div class="comparison-box">
            <div class="box-tag">🚗 原國道路線 (${result.highway ? result.highway.shortName : '國道'})</div>
            <div class="box-value">${result.totalTravelMinutes} 分鐘</div>
            <div style="font-size: 0.82rem; color: #DC2626; margin-top: 4px; font-weight: 600;">最慢車速僅 ${result.worstSpeed} km/h</div>
          </div>

          <div class="comparison-box alt-box">
            <div class="box-tag">🛣️ 建議改道路線：${rule.alternateRouteName}</div>
            <div class="box-value" style="color: #B45309;">預估 ${detour.detourTravelMins} 分鐘</div>
            ${detour.minutesSaved > 0 ? `<div class="save-time-highlight" style="color: #047857; font-size: 0.85rem; font-weight: 700; margin-top: 4px;">⏱️ 預估可為您節省約 ${detour.minutesSaved} 分鐘行車時間！</div>` : '<div style="font-size: 0.82rem; color: #64748B;">行駛時間相近，但可避開停滯車陣與事故二次風險。</div>'}
          </div>
        </div>

        <div class="turn-instructions">
          <div style="font-size: 0.88rem; font-weight: 800; color: #0F172A; margin-bottom: 10px;">📍 改道路線切換指引：</div>
          <div class="instruction-step">
            <span class="step-num">1</span>
            <div><strong>駛離國道：</strong> ${rule.offRampInstruction}</div>
          </div>
          <div class="instruction-step">
            <span class="step-num">2</span>
            <div><strong>替代道路：</strong> 順行 ${rule.alternateRouteName}，沿途注意省道/快速道路速限指示。</div>
          </div>
          <div class="instruction-step">
            <span class="step-num">3</span>
            <div><strong>重新匯入：</strong> ${rule.onRampInstruction}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderVisualTimeline(result) {
    timelineContainer.innerHTML = '';
    const segments = result.segments;

    segments.forEach((seg, idx) => {
      if (seg.isTransfer) {
        const transferNodeEl = document.createElement('div');
        transferNodeEl.className = 'timeline-node';
        transferNodeEl.innerHTML = `
          <div class="node-dot" style="background:#B45309; border-color:#FDE68A;"></div>
          <div class="node-name" style="color:#B45309; font-weight:800; white-space:nowrap; min-width:140px;">${seg.transferName}</div>
        `;
        timelineContainer.appendChild(transferNodeEl);
        return;
      }

      // 節點 1
      if (idx === 0) {
        const startNodeEl = document.createElement('div');
        startNodeEl.className = 'timeline-node';
        startNodeEl.innerHTML = `
          <div class="node-dot endpoint"></div>
          <div class="node-name">${seg.from.name}</div>
          <div class="node-km">${seg.from.km.toFixed(1)}K</div>
        `;
        timelineContainer.appendChild(startNodeEl);
      }

      // 路段條 Segment bar
      const segEl = document.createElement('div');
      segEl.className = `timeline-segment ${seg.isClosed ? 'closed-segment' : ''}`;
      if (!seg.isClosed) {
        segEl.style.backgroundColor = seg.status.color;
      }
      segEl.innerHTML = `
        <span class="segment-speed-tag ${seg.isClosed ? 'closed-tag' : ''}" style="${seg.isClosed ? '' : `color: ${seg.status.color};`}">
          ${seg.isClosed ? '⛔ 全線封閉' : `${seg.speed} km/h ${seg.incidents.length > 0 ? '⚠️' : ''}`}
        </span>
      `;
      timelineContainer.appendChild(segEl);

      // 節點 2
      const endNodeEl = document.createElement('div');
      endNodeEl.className = 'timeline-node';
      const isLast = idx === segments.length - 1;
      endNodeEl.innerHTML = `
        <div class="node-dot ${isLast ? 'endpoint' : ''} ${seg.isClosed ? 'closed-node' : ''}"></div>
        <div class="node-name" style="${seg.isClosed ? 'color: #DC2626; font-weight: 800;' : ''}">${seg.to.name}</div>
        <div class="node-km">${seg.to.km.toFixed(1)}K</div>
      `;
      timelineContainer.appendChild(endNodeEl);
    });
  }

  function renderIncidentsList(result) {
    if (!incidentsListContainer) return;
    incidentsListContainer.innerHTML = '';
    const incidents = result.incidents;

    if (incidents.length === 0) {
      incidentsListContainer.innerHTML = `
        <div style="text-align: center; color: #64748B; padding: 24px;">
          ✅ 目前該選定路段暫無通報事故或特殊工程維護。
        </div>
      `;
      return;
    }

    incidents.forEach(inc => {
      const item = document.createElement('div');
      item.className = 'incident-item';
      item.innerHTML = `
        <div class="incident-icon">${inc.icon}</div>
        <div class="incident-content">
          <div class="incident-header-row">
            <span class="incident-location">${inc.locationName} ${inc.nearestInterchangeName ? `<span style="color: #FDE047; font-weight: 700; margin-left: 6px;">(靠近 ${inc.nearestInterchangeName})</span>` : ''}</span>
            <span class="incident-time">通報時間: ${inc.timestamp}</span>
          </div>
          <div class="incident-title">${inc.title}</div>
          <div class="incident-desc">${inc.desc}</div>
        </div>
      `;
      incidentsListContainer.appendChild(item);
    });
  }

  function initPresetButtons() {
    presetsList.innerHTML = '';
    if (savedPresets.length === 0) {
      presetsList.innerHTML = `<div style="font-size: 0.8rem; color: #64748B; text-align: center; padding: 10px;">尚未新增常用路線。點擊上方 ⭐️ 即可儲存。</div>`;
      return;
    }

    savedPresets.forEach(preset => {
      const el = document.createElement('div');
      el.className = 'preset-item';
      el.innerHTML = `
        <div class="preset-info">
          <span class="preset-name">${preset.name}</span>
        </div>
        <button class="preset-delete" title="刪除">✕</button>
      `;

      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('preset-delete')) {
          e.stopPropagation();
          savedPresets = savedPresets.filter(p => p.id !== preset.id);
          localStorage.setItem('freeway_saved_presets', JSON.stringify(savedPresets));
          initPresetButtons();
          return;
        }

        // 載入預設
        currentHighwayId = preset.highwayId;
        highwayTabs.forEach(tab => {
          tab.classList.toggle('active', tab.dataset.hw === currentHighwayId);
        });
        currentCountyFilter = 'ALL';
        renderCountyChips();
        populateInterchangeSelects();
        setSelectValues(preset.startId, preset.endId);
        performQuery();
      });

      presetsList.appendChild(el);
    });
  }
});
