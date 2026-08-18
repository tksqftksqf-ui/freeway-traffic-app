/**
 * 台灣國道主要塞車路段改道路線規則資料庫 (Detour Routes Database)
 */

const DETOUR_DATABASE = [
  {
    id: 'detour_north_61',
    highwayId: 'n1',
    name: '台北-新竹/苗栗段 避開國1壅塞改走台61西濱快速道路',
    startKm: 33.0, // 五股
    endKm: 110.0,  // 頭份/新竹
    description: '行經五股至新竹/頭份路段時，若遇到林口爬坡段、湖口-竹北嚴重要塞，建議由五股/八里接台64/台61線西濱快速道路。',
    alternateRouteName: '台61線 西濱快速道路 (八里 ➔ 香山 ➔ 竹南)',
    offRampInstruction: '從五股交流道改接台64線快速道路（八里方向），隨後轉入台61線西濱快速道路南下。',
    onRampInstruction: '於台61線香山/竹南匝道駛離，依指標轉台1己線或縣道124線重新接回國道1號頭份/竹北交流道。',
    timeMultiplier: 1.15, // 順暢時西濱約多15%時間，但塞車時可節省30~60分鐘
    baseSpeed: 75,
    distanceKm: 82.0,
    tags: ['北部', '西濱快速道路', '防塞車首選']
  },
  {
    id: 'detour_n3_north_61',
    highwayId: 'n3',
    name: '土城/關西-新竹段 改走台3線/台61線',
    startKm: 42.0, // 土城
    endKm: 109.0,  // 香山
    description: '國3三峽至關西路段假日易因遊客湧入嚴重卡車，可提前改走台3線內山公路或由大溪交流道接台66線轉台61線。',
    alternateRouteName: '台66線 ➔ 台61線 西濱快速道路',
    offRampInstruction: '於國3大溪交流道駛離，轉入台66線快速道路（往觀音方向），並於觀音交流道銜接台61線西濱快速道路。',
    onRampInstruction: '於台61線香山交流道離去，接台1線即可重新匯入國3香山或國1新竹系統。',
    timeMultiplier: 1.12,
    baseSpeed: 80,
    distanceKm: 72.0,
    tags: ['北部', '台66線', '西濱快速道路']
  },
  {
    id: 'detour_central_74_61',
    highwayId: 'n1',
    name: '台中-彰化段 (大雅-埔鹽) 改走台74線與台61線',
    startKm: 174.0, // 大雅
    endKm: 207.0,  // 埔鹽
    description: '台中市區段（大雅、台中、南屯）與彰化系統至埔鹽極易車多卡死，改走台74線環中快速道路接台61線西濱快速道路。',
    alternateRouteName: '台74線 快速道路 ➔ 台61線 西濱快速道路',
    offRampInstruction: '於國1大雅交流道銜接台74線（往快官/和美方向），並於快官交流道接台61乙線轉台61線西濱快速道路。',
    onRampInstruction: '於台61線鹿港/漢寶匝道駛出，改接台76線快速道路即可東行接回國1埔鹽系統。',
    timeMultiplier: 1.1,
    baseSpeed: 75,
    distanceKm: 45.0,
    tags: ['中部', '台74線', '台中彰化替代']
  },
  {
    id: 'detour_n3_central_63',
    highwayId: 'n3',
    name: '台中-南投段 (霧峰-名間) 改走台63線中投公路或台3線',
    startKm: 209.0, // 中投
    endKm: 237.0,  // 名間
    description: '國3霧峰至名間南投觀光路段壅塞時，建議改走台63線（中投公路）銜接台14線/台3線。',
    alternateRouteName: '台63線 (中投公路) ➔ 台3線 (草屯/南投)',
    offRampInstruction: '於國3中投交流道切出接台63線，或由霧峰交流道駛離接台3線南下。',
    onRampInstruction: '於台3線名間段順行，即可於名間交流道重新回到國道3號。',
    timeMultiplier: 1.2,
    baseSpeed: 60,
    distanceKm: 32.0,
    tags: ['中部', '中投公路', '南投觀光替代']
  },
  {
    id: 'detour_south_61_86',
    highwayId: 'n1',
    name: '嘉義-台南段 改走台61線與台84/86線',
    startKm: 272.0, // 嘉義系統
    endKm: 330.0,  // 仁德系統
    description: '雲嘉南高連假國1車流極大，避開國1新營/麻豆段事故，可走台82線西行銜接台61線西濱快速道路一路南下。',
    alternateRouteName: '台61線 西濱快速道路 ➔ 台86線 / 台84線',
    offRampInstruction: '於國1嘉義系統轉台82線往西，接台61線西濱快速道路南下往北門/七股。',
    onRampInstruction: '於台61線南底接台86線快速道路往東，即可於仁德系統匯回國1，或至關廟匯回國3。',
    timeMultiplier: 1.08,
    baseSpeed: 85,
    distanceKm: 68.0,
    tags: ['南部', '雲嘉南替代', '西濱全線暢通']
  },
  {
    id: 'detour_general_line1',
    highwayId: 'n1',
    name: '短程區域替代：改走台1線 (省道中山路)',
    startKm: 0.0,
    endKm: 373.0,
    description: '若相鄰交流道間（10-20公里內）發生重大車禍完全卡死，建議立即由最近匝道駛離，改走省道台1線避開事故點。',
    alternateRouteName: '省道 台1線 (中山路)',
    offRampInstruction: '於前方最新交流道立刻駛離國道，跟隨「台1線」省道標誌行駛。',
    onRampInstruction: '通過事故/嚴重壅塞路段後，於下一個交流道重新進入國道。',
    timeMultiplier: 1.35,
    baseSpeed: 50,
    distanceKm: 0.0, // 動態計算
    tags: ['短程必備', '省道台1線']
  }
];

/**
 * 根據起終點交流道自動匹配最佳改道路線
 */
function findBestDetourRule(highwayId, startKm, endKm) {
  const minKm = Math.min(startKm, endKm);
  const maxKm = Math.max(startKm, endKm);
  
  // 優先匹配對應國道與里程重疊度高的專屬改道路線
  const matched = DETOUR_DATABASE.filter(rule => {
    if (rule.highwayId !== highwayId && rule.id !== 'detour_general_line1') return false;
    if (rule.id === 'detour_general_line1') return true;
    
    // 計算里程重疊
    const overlapStart = Math.max(minKm, rule.startKm);
    const overlapEnd = Math.min(maxKm, rule.endKm);
    return overlapEnd - overlapStart > 5.0; // 有顯著重疊
  });
  
  return matched.length > 0 ? matched[0] : DETOUR_DATABASE[DETOUR_DATABASE.length - 1];
}
