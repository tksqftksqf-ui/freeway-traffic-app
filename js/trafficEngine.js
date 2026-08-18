/**
 * 國道即時路況運算與事故模擬/分析引擎 (Traffic Engine)
 */

class TrafficEngine {
  constructor() {
    this.useLiveApi = false;
    this.incidentsSeed = [];
    this.generateMockIncidents();
  }

  /**
   * 隨機生成貼近台灣真實國道狀況的動態事故與施工維護事件
   */
  generateMockIncidents() {
    const incidentTemplates = [
      { type: 'accident', title: '小客車追撞事故', severity: 'high', speedDrop: 45, icon: '💥', desc: '占用內側車道，後方回堵約 2.5 公里，警方已抵達處理中。' },
      { type: 'accident', title: '大貨車翻覆/掉落物', severity: 'critical', speedDrop: 60, icon: '⚠️', desc: '占用中內側車道，掉落散落物清理中，建議提早改道。' },
      { type: 'construction', title: '路面高架修補施工', severity: 'medium', speedDrop: 25, icon: '🚧', desc: '封閉外側路肩與外側車道，工期至 17:00 止。' },
      { type: 'construction', title: '邊坡與綠美化剪修工程', severity: 'low', speedDrop: 15, icon: '🌱', desc: '移動性施工占用外車道，請減速慢行。' },
      { type: 'control', title: '交流道匝道儀控管制', severity: 'medium', speedDrop: 20, icon: '🚦', desc: '尖峰時間匝道儀控綠燈縮短，入口車流排隊。' },
      { type: 'weather', title: '強降雨與濃霧視線不良', severity: 'medium', speedDrop: 30, icon: '🌧️', desc: '路段強降雨積水，請拉大車距並開大燈。' }
    ];

    const newIncidents = [];

    // 國道1號事故生成 (3-5個點)
    const n1KmPoints = [15.2, 42.5, 65.0, 95.8, 175.0, 198.0, 242.0, 315.0, 362.0];
    // 國道3號事故生成 (3-5個點)
    const n3KmPoints = [26.0, 43.5, 78.0, 100.5, 169.0, 211.0, 269.0, 346.0, 391.0];

    // 為國1隨機選取 3 個事故
    this.shuffle(n1KmPoints).slice(0, 3).forEach(km => {
      const tmpl = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
      const dir = Math.random() > 0.5 ? '南向' : '北向';
      newIncidents.push({
        id: `inc_n1_${km}_${Date.now()}`,
        highwayId: 'n1',
        km: km,
        direction: dir,
        type: tmpl.type,
        title: tmpl.title,
        severity: tmpl.severity,
        speedDrop: tmpl.speedDrop,
        icon: tmpl.icon,
        desc: tmpl.desc,
        locationName: `國道1號 ${dir} ${km.toFixed(1)}K`,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      });
    });

    // 為國3隨機選取 3 個事故
    this.shuffle(n3KmPoints).slice(0, 3).forEach(km => {
      const tmpl = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
      const dir = Math.random() > 0.5 ? '南向' : '北向';
      newIncidents.push({
        id: `inc_n3_${km}_${Date.now()}`,
        highwayId: 'n3',
        km: km,
        direction: dir,
        type: tmpl.type,
        title: tmpl.title,
        severity: tmpl.severity,
        speedDrop: tmpl.speedDrop,
        icon: tmpl.icon,
        desc: tmpl.desc,
        locationName: `國道3號 ${dir} ${km.toFixed(1)}K`,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      });
    });

    this.incidentsSeed = newIncidents;
  }

  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 計算特定路段即時速與路況評估
   */
  evaluateRoute(highwayId, startInterchangeId, endInterchangeId) {
    const hwData = HIGHWAY_DATA[highwayId];
    if (!hwData) return null;

    const interchanges = hwData.interchanges;
    const startIndex = interchanges.findIndex(item => item.id === startInterchangeId);
    const endIndex = interchanges.findIndex(item => item.id === endInterchangeId);

    if (startIndex === -1 || endIndex === -1) return null;

    const isSouthbound = startIndex < endIndex;
    const directionName = isSouthbound ? '南下 (Southbound)' : '北上 (Northbound)';
    const dirTag = isSouthbound ? '南向' : '北向';

    // 取得途經的所有交流道節點
    const step = isSouthbound ? 1 : -1;
    const routeInterchanges = [];
    for (let i = startIndex; isSouthbound ? i <= endIndex : i >= endIndex; i += step) {
      routeInterchanges.push(interchanges[i]);
    }

    const startKm = interchanges[startIndex].km;
    const endKm = interchanges[endIndex].km;
    const minKm = Math.min(startKm, endKm);
    const maxKm = Math.max(startKm, endKm);
    const totalDistance = Math.abs(endKm - startKm);

    // 篩選本路段發生的事故與維護
    const activeIncidents = this.incidentsSeed.filter(inc => {
      return inc.highwayId === highwayId && inc.km >= minKm && inc.km <= maxKm;
    });

    // 分段計算車速 (Sub-segments)
    const segments = [];
    let totalTravelMinutes = 0;
    let worstSpeed = 110;
    let totalSpeedSum = 0;

    for (let i = 0; i < routeInterchanges.length - 1; i++) {
      const fromNode = routeInterchanges[i];
      const toNode = routeInterchanges[i + 1];
      const segDistance = Math.abs(toNode.km - fromNode.km);
      const segMinKm = Math.min(fromNode.km, toNode.km);
      const segMaxKm = Math.max(fromNode.km, toNode.km);

      // 檢查此細分區段是否有事故或瓶頸（如林口坡、湖口段、大雅段等常塞車區域）
      const segIncidents = activeIncidents.filter(inc => inc.km >= segMinKm && inc.km <= segMaxKm);

      // 基礎預估車速
      let baseSpeed = 95 + Math.floor(Math.sin(segMinKm * 0.1) * 12);
      
      // 常態瓶頸路段車速調低
      const bottleneckKeywords = ['林口', '湖口', '竹北', '大雅', '台中', '彰化', '木柵', '中和', '土城', '霧峰', '鼎金'];
      const isBottleneck = bottleneckKeywords.some(kw => fromNode.name.includes(kw) || toNode.name.includes(kw));
      if (isBottleneck) {
        baseSpeed -= 25;
      }

      // 扣除事故影響
      segIncidents.forEach(inc => {
        baseSpeed -= inc.speedDrop;
      });

      // 限制速度區間 15 km/h ~ 110 km/h
      let speed = Math.max(15, Math.min(110, Math.round(baseSpeed)));

      if (speed < worstSpeed) worstSpeed = speed;
      totalSpeedSum += speed * segDistance;

      // 計算行駛分鐘數 = (距離 / 車速) * 60
      const travelMins = Math.round((segDistance / speed) * 60);
      totalTravelMinutes += travelMins;

      // 取得狀態等級與燈號顏色
      const statusInfo = this.getSpeedStatus(speed);

      segments.push({
        from: fromNode,
        to: toNode,
        distance: Math.round(segDistance * 10) / 10,
        speed: speed,
        travelMins: Math.max(1, travelMins),
        status: statusInfo,
        incidents: segIncidents
      });
    }

    const averageSpeed = totalDistance > 0 ? Math.round(totalSpeedSum / totalDistance) : 90;
    const overallStatus = this.getSpeedStatus(averageSpeed);

    // 評估改道路線 (Detour Recommendation)
    const needsDetour = worstSpeed < 45 || activeIncidents.some(i => i.severity === 'high' || i.severity === 'critical');
    const detourRule = findBestDetourRule(highwayId, startKm, endKm);

    // 估算替代道路的時間與距離
    let detourDistance = Math.round(totalDistance * 1.08 * 10) / 10;
    let detourTravelMins = Math.round((detourDistance / detourRule.baseSpeed) * 60) + 8; // 加計燈號等待約 8 分鐘
    
    // 省時評估 (Minutes saved)
    const minutesSaved = totalTravelMinutes - detourTravelMins;

    return {
      highway: hwData,
      start: interchanges[startIndex],
      end: interchanges[endIndex],
      directionName: directionName,
      directionTag: dirTag,
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTravelMinutes: totalTravelMinutes,
      averageSpeed: averageSpeed,
      worstSpeed: worstSpeed,
      overallStatus: overallStatus,
      segments: segments,
      incidents: activeIncidents,
      detourAdvice: {
        recommended: needsDetour || minutesSaved > 5,
        rule: detourRule,
        detourDistance: detourDistance,
        detourTravelMins: detourTravelMins,
        minutesSaved: minutesSaved,
        reason: activeIncidents.length > 0 
          ? `該路段目前發生 ${activeIncidents.length} 起事故/施工（最慢車速僅 ${worstSpeed} km/h），建議改道避免二次堵塞。`
          : (averageSpeed < 60 ? `行車車多壅塞（平均車速 ${averageSpeed} km/h），建議評估替代路線。` : '目前路況順暢，行駛原國道最為迅速！')
      }
    };
  }

  /**
   * 根據車速判定路況等級與對應 UI 樣式
   */
  getSpeedStatus(speed) {
    if (speed >= 80) {
      return { level: 'smooth', label: '順暢', color: '#00B8D9', bg: 'rgba(0, 184, 217, 0.12)', border: '#00B8D9', icon: '🟢' };
    } else if (speed >= 60) {
      return { level: 'moderate', label: '車多', color: '#36B37E', bg: 'rgba(54, 179, 126, 0.12)', border: '#36B37E', icon: '🟡' };
    } else if (speed >= 40) {
      return { level: 'heavy', label: '壅塞', color: '#FFAB00', bg: 'rgba(255, 171, 0, 0.15)', border: '#FFAB00', icon: '🟠' };
    } else if (speed >= 20) {
      return { level: 'severe', label: '嚴重要塞', color: '#FF5630', bg: 'rgba(255, 86, 48, 0.18)', border: '#FF5630', icon: '🔴' };
    } else {
      return { level: 'stuck', label: '紫爆/定點停滯', color: '#6554C0', bg: 'rgba(101, 84, 192, 0.22)', border: '#6554C0', icon: '🟣' };
    }
  }
}
