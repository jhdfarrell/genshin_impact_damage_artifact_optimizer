window.calcRowDamage = window.calcRowDamage || function (data) { return 0; };
window.updateDamageOnEnter = window.updateDamageOnEnter || null;
let lastCalcResult = null;

function getEquippedArtifacts() {
  const eq = appData.equippedArtifacts || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  return [0, 1, 2, 3, 4].map(slotIdx => {
    const list = appData.artifacts[slotIdx] ?? [];
    const cellIdx = eq[slotIdx] ?? 0;
    const art = list[cellIdx] || null;
    if (art && (art.slotIndex === undefined || art.slotIndex === null)) {
      art.slotIndex = slotIdx;
    }
    return art;
  });
}

function getRowCalculationData(row, artifactsOverride) {
  if (Array.isArray(artifactsOverride)) {
    var equipped = artifactsOverride;
  } else if (artifactsOverride && typeof artifactsOverride === 'object' && artifactsOverride.slotIndex != null) {
    var equipped = getEquippedArtifacts();
    const idx = Number(artifactsOverride.slotIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < 5) {
      equipped[idx] = artifactsOverride;
    }
  } else {
    var equipped = getEquippedArtifacts();
  }

  return {
    basePanel: { ...appData.basePanel },
    buffs: appData.buffs.map(b => ({ ...b })),
    artifacts: equipped.map(a => a ? JSON.parse(JSON.stringify(a)) : null),
    setEffects: appData.setEffects.map(s => ({ ...s })),
    cycleFlowRow: row ? { ...row } : null
  };
}

function setRowDamage(rowId, damage) {
  if (!lastCalcResult) lastCalcResult = { totalDamage: 0, rowDamages: [] };
  window.lastCalcResult = lastCalcResult;
  const existing = lastCalcResult.rowDamages.find(d => String(d.rowId) === String(rowId));
  if (existing) existing.damage = damage;
  else lastCalcResult.rowDamages.push({ rowId, damage });
}

function refreshDamageIfOnCyclePage() {
  if (document.getElementById('cycle')?.classList.contains('active') && typeof window.renderCycleFlow === 'function') {
    window.renderCycleFlow();
  }
}

function runDamageUpdate() {
  lastCalcResult = { totalDamage: 0, rowDamages: [] };
  window.lastCalcResult = lastCalcResult;
  const rows = appData.cycleFlow;
  if (typeof window.updateDamageOnEnter === 'function') {
    window.updateDamageOnEnter({
      getRowCalculationData,
      setRowDamage: (rowId, damage) => setRowDamage(rowId, damage),
      getRows: () => rows
    });
  } else {
    rows.forEach(row => {
      const data = getRowCalculationData(row);
      const damage = window.calcRowDamage(data);
      setRowDamage(row.id, damage);
    });
  }
  const total = lastCalcResult.rowDamages.reduce((s, d) => s + (typeof d.damage === 'number' ? d.damage : 0), 0);
  lastCalcResult.totalDamage = total;
  window.lastCalcResult = lastCalcResult;
  const el = document.getElementById('cycle-total-damage');
  if (el) el.textContent = typeof total === 'number' ? String(total) : '—';
}

/** 给定 5 件圣遗物数组，计算循环总伤害（所有行的伤害之和） */
function getCycleTotalDamage(artifacts) {
  const rows = appData.cycleFlow || [];
  if (rows.length === 0) return 0;
  let total = 0;
  for (const row of rows) {
    const data = getRowCalculationData(row, artifacts);
    const dmg = typeof window.calcRowDamage === 'function' ? window.calcRowDamage(data) : 0;
    total += typeof dmg === 'number' ? dmg : 0;
  }
  return total;
}
