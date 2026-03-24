(function () {
  const SAVE_VERSION = 1;

  function ensureBasePanelSynced() {
    if (typeof syncBasePanelToData === 'function') syncBasePanelToData();
  }

  function getSaveData() {
    ensureBasePanelSynced();
    return {
      version: SAVE_VERSION,
      basePanel: { ...appData.basePanel },
      buffs: (appData.buffs || []).map(b => ({ ...b })),
      cycleFlow: (appData.cycleFlow || []).map(r => ({ ...r })),
      artifacts: JSON.parse(JSON.stringify(appData.artifacts || {})),
      setEffects: (appData.setEffects || []).map(s => ({ ...s })),
      equippedArtifacts: { ...(appData.equippedArtifacts || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }) },
      effectiveSubstats: Array.isArray(appData.effectiveSubstats) ? [...appData.effectiveSubstats] : [],
      cycleBuffTemplates: (appData.cycleBuffTemplates || []).map(t => ({
        id: t.id,
        name: t.name || '',
        buffRefs: Array.isArray(t.buffRefs) ? t.buffRefs.filter(Boolean) : []
      })),
      counters: {
        setEffectIdCounter: typeof setEffectIdCounter !== 'undefined' ? setEffectIdCounter : 0,
        buffIdCounter: typeof buffIdCounter !== 'undefined' ? buffIdCounter : 0,
        cycleFlowIdCounter: typeof cycleFlowIdCounter !== 'undefined' ? cycleFlowIdCounter : 0,
        cycleBuffTemplateIdCounter: typeof cycleBuffTemplateIdCounter !== 'undefined' ? cycleBuffTemplateIdCounter : 0
      }
    };
  }

  function normalizeSetPiece(val) {
    if (Array.isArray(val)) return val.filter(Boolean);
    return val ? [val] : [];
  }

  function loadSaveData(data) {
    if (!data || typeof data !== 'object') return;

    const resistIds = typeof BASE_RESIST_IDS !== 'undefined' ? BASE_RESIST_IDS : [];

    if (data.basePanel && typeof data.basePanel === 'object') {
      const def = {};
      ['charLevel', 'monsterLevel', 'hp', 'atk', 'def', 'em', 'er', 'critRate', 'critDmg', ...resistIds].forEach(k => { def[k] = ''; });
      appData.basePanel = { ...def, ...data.basePanel };
    }

    if (Array.isArray(data.buffs)) {
      appData.buffs = data.buffs.map(b => ({
        ...b,
        isArtifactBuff: b.isArtifactBuff === true,
        artifactPieces: b.artifactPieces === 4 ? 4 : (b.artifactPieces === 2 ? 2 : null)
      }));
    }

    if (Array.isArray(data.cycleFlow)) {
      appData.cycleFlow = data.cycleFlow.map(r => ({
        ...r,
        damageType: r.damageType === 'transformative' ? 'transformative' : 'direct',
        reaction: r.reaction || '',
        swirlElement: r.swirlElement || '',
        buffRefs: Array.isArray(r.buffRefs) ? r.buffRefs : [],
        element: r.element != null ? r.element : '',
        amplify: r.amplify != null ? r.amplify : ''
      }));
    }

    if (data.artifacts && typeof data.artifacts === 'object') {
      const arts = {};
      for (let i = 0; i < 5; i++) {
        const arr = data.artifacts[String(i)] ?? data.artifacts[i];
        arts[i] = Array.isArray(arr) ? JSON.parse(JSON.stringify(arr)) : [];
      }
      appData.artifacts = arts;
    }

    if (Array.isArray(data.setEffects)) {
      appData.setEffects = data.setEffects.map(s => ({
        ...s,
        twoPiece: normalizeSetPiece(s.twoPiece),
        fourPiece: normalizeSetPiece(s.fourPiece)
      }));
    }

    if (data.equippedArtifacts && typeof data.equippedArtifacts === 'object') {
      const eq = {};
      for (let j = 0; j < 5; j++) {
        const v = data.equippedArtifacts[String(j)] ?? data.equippedArtifacts[j];
        eq[j] = typeof v === 'number' ? v : 0;
      }
      appData.equippedArtifacts = eq;
    }

    if (Array.isArray(data.effectiveSubstats)) {
      const allowed = (typeof EFFECTIVE_SUBSTATS_ALLOWED !== 'undefined')
        ? new Set(EFFECTIVE_SUBSTATS_ALLOWED.map(s => s.value))
        : (ARTIFACT_SUBSTATS ? new Set(ARTIFACT_SUBSTATS.map(s => s.value)) : new Set());
      const max = (typeof EFFECTIVE_SUBSTATS_MAX !== 'undefined') ? EFFECTIVE_SUBSTATS_MAX : 5;
      appData.effectiveSubstats = data.effectiveSubstats.filter(s => allowed.has(s)).slice(0, max);
    }

    if (Array.isArray(data.cycleBuffTemplates)) {
      appData.cycleBuffTemplates = data.cycleBuffTemplates.map(t => ({
        id: t.id,
        name: t.name || '',
        buffRefs: Array.isArray(t.buffRefs) ? t.buffRefs.filter(Boolean) : []
      }));
      const maxId = appData.cycleBuffTemplates.reduce((m, t) => typeof t.id === 'number' && t.id > m ? t.id : m, 0);
      if (typeof cycleBuffTemplateIdCounter !== 'undefined' && maxId > cycleBuffTemplateIdCounter) {
        cycleBuffTemplateIdCounter = maxId;
      }
    }

    if (data.counters) {
      if (typeof setEffectIdCounter !== 'undefined' && data.counters.setEffectIdCounter != null) setEffectIdCounter = data.counters.setEffectIdCounter;
      if (typeof buffIdCounter !== 'undefined' && data.counters.buffIdCounter != null) buffIdCounter = data.counters.buffIdCounter;
      if (typeof cycleFlowIdCounter !== 'undefined' && data.counters.cycleFlowIdCounter != null) cycleFlowIdCounter = data.counters.cycleFlowIdCounter;
      if (typeof cycleBuffTemplateIdCounter !== 'undefined' && data.counters.cycleBuffTemplateIdCounter != null) cycleBuffTemplateIdCounter = data.counters.cycleBuffTemplateIdCounter;
    }
  }

  async function save() {
    const json = JSON.stringify(getSaveData(), null, 2);
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'ysy-optimizer-save.json',
          types: [{ description: 'JSON 文件', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
      } catch (err) {
        if (err.name !== 'AbortError') alert('保存失败：' + (err.message || String(err)));
      }
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ysy-optimizer-save.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function load() {
    const input = document.getElementById('save-load-file-input');
    if (!input) return;
    input.value = '';
    input.click();
  }

  function onFileSelected(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('无效的存档格式');
        loadSaveData(data);
        if (typeof syncDataToBasePanel === 'function') syncDataToBasePanel();
        if (typeof window.renderAllBuffs === 'function') window.renderAllBuffs();
        if (typeof renderArtifacts === 'function') renderArtifacts();
        if (typeof window.renderCycleFlow === 'function') window.renderCycleFlow();
        if (typeof populateBuffContent === 'function') populateBuffContent(0);
      } catch (err) {
        alert('加载失败：' + (err && err.message ? err.message : '文件格式错误'));
      }
    };
    reader.onerror = () => alert('加载失败：无法读取文件');
    reader.readAsText(file, 'UTF-8');
  }

  function init() {
    const saveBtn = document.getElementById('save-load-save-btn');
    const loadBtn = document.getElementById('save-load-load-btn');
    if (!saveBtn && !loadBtn) return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.id = 'save-load-file-input';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', onFileSelected);
    document.body.appendChild(fileInput);

    if (saveBtn) saveBtn.addEventListener('click', save);
    if (loadBtn) loadBtn.addEventListener('click', load);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
