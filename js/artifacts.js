const artifactPanelsEl = document.getElementById('artifact-slot-panels');
const STAT_LABEL_MAP = Object.fromEntries([
  ...Object.values(ARTIFACT_MAIN_STATS).flat().map(o => [o.value, o.label]),
  ...ARTIFACT_SUBSTATS.map(o => [o.value, o.label])
]);
const MAIN_STAT_PERCENT = new Set(['hp_pct', 'atk_pct', 'def_pct', 'er', 'phys', 'pyro', 'hydro', 'electro', 'cryo', 'anemo', 'dendro', 'geo', 'cr', 'cd', 'atk', 'def']);

/** 有效词条可选范围：排除固定生/攻/防与充能效率 */
const EFFECTIVE_SUBSTATS_ALLOWED = ARTIFACT_SUBSTATS.filter(s => !['hp', 'atk', 'def', 'er'].includes(s.value));
const EFFECTIVE_SUBSTATS_MAX = 5;

/** 当前视为有效的副词条集合；空数组表示全部有效（全部 = 上述可选范围内全部） */
function getEffectiveSubstatSet() {
  const list = appData.effectiveSubstats;
  const allowedValues = EFFECTIVE_SUBSTATS_ALLOWED.map(s => s.value);
  if (!Array.isArray(list) || list.length === 0) {
    return new Set(allowedValues);
  }
  return new Set(list);
}

/** 单件圣遗物副词条价值 = 有效副词条的 (数值 × 该词条价格) 之和，价格 = 1/单次强化期望 */
function getArtifactSubstatValue(artifact) {
  if (!artifact || !artifact.substats) return 0;
  const effective = getEffectiveSubstatSet();
  let sum = 0;
  for (const s of artifact.substats) {
    if (!s.stat || SUBSTAT_PRICE[s.stat] == null || !effective.has(s.stat)) continue;
    const val = parseFloat(s.value);
    if (Number.isFinite(val)) sum += val * SUBSTAT_PRICE[s.stat];
  }
  return sum;
}

/** 单件圣遗物主词条价值（主词条数值 × 该类型单价，单价 = 1/单次强化期望；无对应副词条类型的主词条不计） */
function getArtifactMainStatValue(artifact) {
  if (!artifact || !artifact.mainStat) return 0;
  const slotIdx = artifact.slotIndex != null ? artifact.slotIndex : 0;
  const key = getMainStatRangeKey(artifact.mainStat, slotIdx);
  const priceKey = key === 'flat_atk' ? 'atk' : key;
  if (SUBSTAT_PRICE[priceKey] == null) return 0;
  // 只统计「当前有效词条」内的主词条价值，保持与优化页口径一致
  const effective = getEffectiveSubstatSet();
  if (!effective.has(priceKey)) return 0;
  const numVal = getMainStatValue(artifact.mainStat, artifact.level ?? 20, slotIdx);
  return numVal * SUBSTAT_PRICE[priceKey];
}

/** 当前装备的 5 件圣遗物总主词条价值 */
function getEquippedMainStatTotal() {
  const equipped = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
  return equipped.reduce((acc, art) => acc + (art ? getArtifactMainStatValue(art) : 0), 0);
}

/** 当前装备的 5 件圣遗物总副词条价值 */
function getEquippedSubstatTotal() {
  const equipped = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
  return equipped.reduce((acc, art) => acc + (art ? getArtifactSubstatValue(art) : 0), 0);
}

/** 主词条对应的禁止重复的副词条 key（与主同类型的副不能选） */
function getForbiddenSubstatByMain(mainStat, slotIdx) {
  if (!mainStat) return null;
  const key = getMainStatRangeKey(mainStat, slotIdx);
  return key === 'flat_atk' ? 'atk' : key;
}

function renderArtifactSubstats() {
  const form = document.getElementById('artifact-new-form');
  const list = document.getElementById('artifact-substats-list');
  if (!list || !form) return;
  const slotIdx = parseInt(form.dataset.slot, 10);
  const mainStat = (form.mainStat && form.mainStat.value) ? form.mainStat.value : '';
  const forbiddenMain = getForbiddenSubstatByMain(mainStat, isNaN(slotIdx) ? 0 : slotIdx);
  const otherSubs = [0, 1, 2, 3].map(j => (form[`substat${j}`] && form[`substat${j}`].value) ? form[`substat${j}`].value : '');

  list.innerHTML = Array.from({ length: 4 }, (_, i) => {
    const disabledValues = new Set([forbiddenMain].filter(Boolean));
    otherSubs.forEach((v, j) => { if (j !== i && v) disabledValues.add(v); });
    const options = ARTIFACT_SUBSTATS.map(s =>
      disabledValues.has(s.value)
        ? `<option value="${escapeHtml(s.value)}" disabled>${escapeHtml(s.label)}</option>`
        : `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`
    ).join('');
    return `
    <div class="artifact-substat-row">
      <select name="substat${i}" style="flex:1;min-width:11rem">
        <option value="">-- 请选择 --</option>
        ${options}
      </select>
      <input type="number" name="substatValue${i}" step="any" placeholder="数值" style="width:7rem">
    </div>`;
  }).join('');

  [0, 1, 2, 3].forEach(j => {
    const sel = form[`substat${j}`];
    const val = otherSubs[j];
    if (!sel) return;
    if (val) {
      const opt = sel.querySelector(`option[value="${escapeHtml(val)}"]`);
      if (opt && !opt.disabled) sel.value = val;
      else sel.value = '';
    } else {
      sel.value = '';
    }
  });
}

function getMainStatRangeKey(mainStat, slotIdx) {
  if (slotIdx === 0 && mainStat === 'hp') return 'hp';
  if (slotIdx === 1 && mainStat === 'flat_atk') return 'flat_atk';
  if (slotIdx >= 2 && ['hp', 'atk', 'def'].includes(mainStat)) return mainStat + '_pct';
  return mainStat in MAIN_STAT_RANGES ? mainStat : mainStat;
}

function getMainStatValue(mainStat, level, slotIdx) {
  const key = getMainStatRangeKey(mainStat, slotIdx);
  const range = MAIN_STAT_RANGES[key] || MAIN_STAT_RANGES.hp;
  const lvl = Math.max(0, Math.min(20, parseInt(level, 10) || 0));
  const v = range[0] + (range[1] - range[0]) * lvl / 20;
  return MAIN_STAT_PERCENT.has(key) ? Math.round(v * 10) / 10 : Math.round(v);
}

function formatMainStatDisplay(mainStat, level, slotIdx) {
  const key = getMainStatRangeKey(mainStat, slotIdx);
  const val = getMainStatValue(mainStat, level, slotIdx);
  const suffix = MAIN_STAT_PERCENT.has(key) ? '%' : '';
  return `${val}${suffix}`;
}

function showArtifactDetail(art) {
  const se = appData.setEffects?.find(s => s.id === art.setId);
  const twoStr = se && (Array.isArray(se.twoPiece) ? se.twoPiece : se.twoPiece ? [se.twoPiece] : []).join('、') || '（无）';
  const fourStr = se && (Array.isArray(se.fourPiece) ? se.fourPiece : se.fourPiece ? [se.fourPiece] : []).join('、') || '（无）';
  const setStr = se ? (se.setName ? se.setName + ' | ' : '') + `二件套: ${twoStr} / 四件套: ${fourStr}` : '（无）';
  const mainLabel = STAT_LABEL_MAP[art.mainStat] || art.mainStat;
  const subStr = (art.substats || []).filter(s => s.stat).map(s => {
    const label = STAT_LABEL_MAP[s.stat] || s.stat;
    return `  ${label}: ${s.value}`;
  }).join('\n');
  document.getElementById('artifact-view-content').innerHTML = `
    <div style="line-height:1.6;color:#ccc">
      <p><b>名称</b>: ${escapeHtml(art.name)}</p>
      <p><b>套装</b>: ${escapeHtml(setStr)}</p>
      <p><b>主词条</b>: ${escapeHtml(mainLabel)}</p>
      <p><b>等级</b>: ${art.level ?? 20}</p>
      <p><b>副词条</b>:</p>
      <pre style="margin:0;font-family:inherit;white-space:pre-wrap">${escapeHtml(subStr || '（无）')}</pre>
    </div>
  `;
  document.getElementById('artifact-view-modal').classList.add('visible');
}

document.getElementById('artifact-view-close').addEventListener('click', () => {
  document.getElementById('artifact-view-modal').classList.remove('visible');
});

document.getElementById('artifact-view-modal').addEventListener('click', (e) => {
  if (e.target.id === 'artifact-view-modal') e.target.classList.remove('visible');
});

function openArtifactModal(slotIdx, cellIdx, editArt) {
  const form = document.getElementById('artifact-new-form');
  form.dataset.slot = slotIdx;
  form.dataset.cell = cellIdx;
  form.reset();
  form.level.value = 20;

  const setIdSelect = document.getElementById('artifact-set-select');
  const setOpts = appData.setEffects?.length ? appData.setEffects.map((se) =>
    `<option value="${se.id}">${escapeHtml(se.setName || formatSetPiece(se.twoPiece) + ' / ' + formatSetPiece(se.fourPiece))}</option>`
  ).join('') : '<option value="">（请先添加套装效果）</option>';
  setIdSelect.innerHTML = setOpts ? '<option value="">-- 请选择 --</option>' + setOpts : setOpts;

  const mainStatSelect = document.getElementById('artifact-main-stat');
  const mainOpts = (ARTIFACT_MAIN_STATS[slotIdx] || []).map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
  mainStatSelect.innerHTML = mainOpts;

  if (editArt) {
    form.name.value = editArt.name || '';
    form.setId.value = editArt.setId || '';
    form.mainStat.value = editArt.mainStat || '';
    form.level.value = editArt.level ?? 20;
    if (form.maxRolls) {
      const mr = editArt.maxRolls === 4 ? 4 : 5;
      const input = form.querySelector(`input[name="maxRolls"][value="${mr}"]`);
      if (input) input.checked = true;
    }
    renderArtifactSubstats();
    (editArt.substats || []).forEach((s, i) => {
      const subSelect = form[`substat${i}`];
      const subVal = form[`substatValue${i}`];
      if (subSelect) subSelect.value = s.stat || '';
      if (subVal) subVal.value = s.value || '';
    });
    document.querySelector('#artifact-new-modal .modal-title').textContent = '修改圣遗物';
  } else {
    renderArtifactSubstats();
    if (form.maxRolls) {
      const input = form.querySelector('input[name="maxRolls"][value="5"]');
      if (input) input.checked = true;
    }
    document.querySelector('#artifact-new-modal .modal-title').textContent = '新建圣遗物';
  }
  document.getElementById('artifact-new-modal').classList.add('visible');
}

function renderEffectiveSubstats() {
  const listEl = document.getElementById('artifact-effective-substats-list');
  if (!listEl) return;
  const effective = appData.effectiveSubstats;
  const allowed = EFFECTIVE_SUBSTATS_ALLOWED;
  const allValues = allowed.map(s => s.value);
  const saved = Array.isArray(effective) ? effective.filter(v => allValues.includes(v)).slice(0, EFFECTIVE_SUBSTATS_MAX) : [];
  const checkedSet = saved.length > 0 ? new Set(saved) : new Set(allValues);
  listEl.innerHTML = allowed.map(s => `
    <label class="artifact-effective-substat-item">
      <input type="checkbox" class="artifact-effective-substat-cb" value="${escapeHtml(s.value)}" ${checkedSet.has(s.value) ? 'checked' : ''}>
      <span>${escapeHtml(s.label)}</span>
    </label>
  `).join('');
  listEl.querySelectorAll('.artifact-effective-substat-cb').forEach(cb => {
    cb.addEventListener('change', function () {
      let checked = Array.from(listEl.querySelectorAll('.artifact-effective-substat-cb:checked')).map(el => el.value);
      if (checked.length > EFFECTIVE_SUBSTATS_MAX) {
        this.checked = false;
        checked = checked.filter(v => v !== this.value);
      }
      appData.effectiveSubstats = checked.length === allValues.length ? [] : checked;
      updateSubstatValueDisplays();
    });
  });
}

function updateSubstatValueDisplays() {
  const totalEl = document.getElementById('artifact-substat-total-value');
  if (totalEl) {
    const total = getEquippedSubstatTotal();
    totalEl.textContent = Number.isFinite(total) ? total.toFixed(2) : '—';
  }
  artifactPanelsEl.querySelectorAll('.artifact-cell').forEach(cell => {
    const slotIdx = parseInt(cell.dataset.slot, 10);
    const cellIdx = parseInt(cell.dataset.cell, 10);
    const art = (appData.artifacts[slotIdx] ?? [])[cellIdx];
    const valueSpan = cell.querySelector('.artifact-cell-value');
    if (valueSpan && art) {
      const v = getArtifactSubstatValue(art);
      valueSpan.textContent = '副词条价值: ' + (Number.isFinite(v) ? v.toFixed(2) : '—');
    }
  });
}

function renderArtifacts() {
  renderEffectiveSubstats();
  artifactPanelsEl.innerHTML = ARTIFACT_SLOTS.map((name, slotIdx) => {
    const list = (appData.artifacts[slotIdx] ?? []);
    const cells = Array.from({ length: 5 }, (_, cellIdx) => {
      const art = list[cellIdx];
      const equipped = (appData.equippedArtifacts || {})[slotIdx];
      const isEquipped = equipped === cellIdx;
      if (!art) {
        const radioName = `artifact-equip-${slotIdx}`;
        return `<div class="artifact-cell" data-slot="${slotIdx}" data-cell="${cellIdx}">
          <div class="artifact-cell-equip"><input type="radio" name="${radioName}" value="${cellIdx}" ${isEquipped ? 'checked' : ''} data-equip><label>装备</label></div>
          <button type="button" class="artifact-cell-btn">新建</button>
        </div>`;
      }
      const se = art.setId != null ? appData.setEffects?.find(s => s.id === art.setId) : null;
      const setName = se && se.setName ? se.setName : '';
      const mainLabel = STAT_LABEL_MAP[art.mainStat] || art.mainStat;
      const mainVal = formatMainStatDisplay(art.mainStat, art.level ?? 20, slotIdx);
      const subRows = (art.substats || []).filter(s => s.stat).map(s => {
        const label = STAT_LABEL_MAP[s.stat] || s.stat;
        const pct = ['hp_pct', 'atk_pct', 'def_pct', 'er', 'cr', 'cd'].includes(s.stat);
        const valStr = s.value != null ? (pct ? `${s.value}%` : s.value) : '';
        return `<div class="artifact-cell-sub-row"><span>${escapeHtml(label)}: ${escapeHtml(valStr)}</span></div>`;
      }).join('');
      const substatValue = getArtifactSubstatValue(art);
      const valueStr = Number.isFinite(substatValue) ? substatValue.toFixed(2) : '—';
      const maxRolls = art.maxRolls === 4 ? 4 : 5;
      const radioName = `artifact-equip-${slotIdx}`;
      return `
        <div class="artifact-cell" data-slot="${slotIdx}" data-cell="${cellIdx}">
          <div class="artifact-cell-content">
            <div class="artifact-cell-equip"><input type="radio" name="${radioName}" value="${cellIdx}" ${isEquipped ? 'checked' : ''} data-equip><label>装备</label></div>
            <div class="artifact-cell-name-wrap">
              <span class="artifact-cell-name">${escapeHtml(art.name)}</span>
              ${setName ? `<span class="artifact-cell-set-name">${escapeHtml(setName)}</span>` : ''}
            </div>
            <span class="artifact-cell-level">强化 +${parseInt(art.level, 10) || 0}</span>
            <span class="artifact-cell-main">${escapeHtml(mainLabel)} ${escapeHtml(mainVal)}</span>
            ${subRows ? `<div class="artifact-cell-subs">${subRows}</div>` : ''}
            <span class="artifact-cell-value">副词条价值: ${escapeHtml(valueStr)} | 最大强化次数: ${maxRolls}</span>
            <div class="artifact-cell-actions">
              <button type="button" class="artifact-cell-edit-btn">修改</button>
              <button type="button" class="artifact-cell-del-btn">删除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    return `
      <div class="artifact-slot-panel">
        <div class="artifact-slot-title">${name}</div>
        <div class="artifact-slot-cells">${cells}</div>
      </div>
    `;
  }).join('');

  const totalEl = document.getElementById('artifact-substat-total-value');
  if (totalEl) {
    const total = getEquippedSubstatTotal();
    totalEl.textContent = Number.isFinite(total) ? total.toFixed(2) : '—';
  }

  artifactPanelsEl.querySelectorAll('.artifact-cell-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cell = btn.closest('.artifact-cell');
      openArtifactModal(parseInt(cell.dataset.slot, 10), parseInt(cell.dataset.cell, 10));
    });
  });
  artifactPanelsEl.querySelectorAll('input[data-equip]').forEach(radio => {
    radio.addEventListener('change', () => {
      const cell = radio.closest('.artifact-cell');
      const slotIdx = parseInt(cell.dataset.slot, 10);
      const cellIdx = parseInt(radio.value, 10);
      if (!appData.equippedArtifacts) appData.equippedArtifacts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      appData.equippedArtifacts[slotIdx] = cellIdx;
      const totalEl = document.getElementById('artifact-substat-total-value');
      if (totalEl) {
        const total = getEquippedSubstatTotal();
        totalEl.textContent = Number.isFinite(total) ? total.toFixed(2) : '—';
      }
      refreshDamageIfOnCyclePage();
    });
  });
  artifactPanelsEl.querySelectorAll('.artifact-cell-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cell = btn.closest('.artifact-cell');
      const slotIdx = parseInt(cell.dataset.slot, 10);
      const cellIdx = parseInt(cell.dataset.cell, 10);
      openArtifactModal(slotIdx, cellIdx, (appData.artifacts[slotIdx] ?? [])[cellIdx]);
    });
  });
  artifactPanelsEl.querySelectorAll('.artifact-cell-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cell = btn.closest('.artifact-cell');
      const slotIdx = parseInt(cell.dataset.slot, 10);
      const cellIdx = parseInt(cell.dataset.cell, 10);
      if (confirm('确定删除该圣遗物？')) {
        const arr = appData.artifacts[slotIdx];
        if (arr && arr[cellIdx]) {
          arr[cellIdx] = undefined;
          renderArtifacts();
          refreshDamageIfOnCyclePage();
        }
      }
    });
  });

  const setEffectListEl = document.getElementById('artifact-set-effect-list');
  setEffectListEl.innerHTML = (appData.setEffects || []).map(se => `
    <div class="artifact-set-effect-item" data-id="${se.id}">
      <span class="artifact-set-effect-item-main">${escapeHtml(se.setName || '（未命名）')} | 二件套：${escapeHtml(formatSetPiece(se.twoPiece))} | 四件套：${escapeHtml(formatSetPiece(se.fourPiece))}</span>
      <button type="button" class="buff-item-edit-btn">修改</button>
      <button type="button" class="buff-item-del-btn">删除</button>
    </div>
  `).join('');
  setEffectListEl.querySelectorAll('.buff-item-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.artifact-set-effect-item');
      const id = parseInt(item.dataset.id, 10);
      const se = appData.setEffects.find(s => s.id === id);
      if (se) openSetEffectModal(se);
    });
  });
  setEffectListEl.querySelectorAll('.buff-item-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.artifact-set-effect-item');
      const id = parseInt(item.dataset.id, 10);
      appData.setEffects = appData.setEffects.filter(s => s.id !== id);
      renderArtifacts();
    });
  });
}

function formatSetPiece(val) {
  if (!val) return '（无）';
  return Array.isArray(val) ? val.join('、') : String(val);
}

function toArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  return val ? [val] : [];
}

function populateSetEffectChecks(twoSelected = [], fourSelected = []) {
  const names = typeof window.getBuffNames === 'function' ? window.getBuffNames() : [];
  const twoEl = document.getElementById('artifact-two-piece-checks');
  const fourEl = document.getElementById('artifact-four-piece-checks');
  if (twoEl) {
    twoEl.innerHTML = names.length ? names.map(n => `
      <label class="artifact-set-effect-check-item">
        <input type="checkbox" name="twoPiece" value="${escapeHtml(n)}" ${twoSelected.includes(n) ? 'checked' : ''}>
        ${escapeHtml(n)}
      </label>
    `).join('') : '<span class="artifact-set-effect-empty">（请先在加成页添加）</span>';
  }
  if (fourEl) {
    fourEl.innerHTML = names.length ? names.map(n => `
      <label class="artifact-set-effect-check-item">
        <input type="checkbox" name="fourPiece" value="${escapeHtml(n)}" ${fourSelected.includes(n) ? 'checked' : ''}>
        ${escapeHtml(n)}
      </label>
    `).join('') : '<span class="artifact-set-effect-empty">（请先在加成页添加）</span>';
  }
}

function openSetEffectModal(editData) {
  const form = document.getElementById('artifact-set-effect-form');
  if (editData) {
    form.dataset.editingId = editData.id;
    const setNameEl = form.elements.setName || document.getElementById('artifact-set-name');
    if (setNameEl) setNameEl.value = editData.setName || '';
    populateSetEffectChecks(toArray(editData.twoPiece), toArray(editData.fourPiece));
    document.getElementById('artifact-set-effect-modal-title').textContent = '修改套装效果';
  } else {
    delete form.dataset.editingId;
    const setNameEl = form.elements.setName || document.getElementById('artifact-set-name');
    if (setNameEl) setNameEl.value = '';
    populateSetEffectChecks([], []);
    document.getElementById('artifact-set-effect-modal-title').textContent = '添加套装效果';
  }
  document.getElementById('artifact-set-effect-modal').classList.add('visible');
}

document.getElementById('artifact-add-set-effect-btn').addEventListener('click', () => openSetEffectModal());

document.getElementById('artifact-set-effect-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = document.getElementById('artifact-set-effect-form');
  const setName = (form.elements.setName || document.getElementById('artifact-set-name'))?.value?.trim() || '';
  const twoPiece = [...(form.querySelectorAll('input[name="twoPiece"]:checked') || [])].map(cb => cb.value).filter(Boolean);
  const fourPiece = [...(form.querySelectorAll('input[name="fourPiece"]:checked') || [])].map(cb => cb.value).filter(Boolean);
  const editingId = form.dataset.editingId;
  if (editingId) {
    const se = appData.setEffects.find(s => s.id === parseInt(editingId, 10));
    if (se) {
      se.setName = setName;
      se.twoPiece = twoPiece;
      se.fourPiece = fourPiece;
    }
  } else {
    appData.setEffects.push({ id: ++setEffectIdCounter, setName, twoPiece, fourPiece });
  }
  document.getElementById('artifact-set-effect-modal').classList.remove('visible');
  renderArtifacts();
});

document.getElementById('artifact-set-effect-modal-cancel').addEventListener('click', () => {
  document.getElementById('artifact-set-effect-modal').classList.remove('visible');
});

document.getElementById('artifact-set-effect-modal').addEventListener('click', (e) => {
  if (e.target.id === 'artifact-set-effect-modal') e.target.classList.remove('visible');
});

document.getElementById('artifact-new-modal-cancel').addEventListener('click', () => {
  document.getElementById('artifact-new-modal').classList.remove('visible');
});

document.getElementById('artifact-new-modal').addEventListener('click', (e) => {
  if (e.target.id === 'artifact-new-modal') e.target.classList.remove('visible');
});

const artifactNewForm = document.getElementById('artifact-new-form');
if (artifactNewForm) {
  artifactNewForm.addEventListener('change', (e) => {
    const t = e.target;
    if (t && (t.name === 'mainStat' || (t.name && String(t.name).match(/^substat\d+$/)))) {
      renderArtifactSubstats();
    }
  });
}

document.getElementById('artifact-new-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = document.getElementById('artifact-new-form');
  const slotIdx = parseInt(form.dataset.slot, 10);
  const cellIdx = parseInt(form.dataset.cell, 10);
  const substats = Array.from({ length: 4 }, (_, i) => ({
    stat: form[`substat${i}`]?.value,
    value: form[`substatValue${i}`]?.value
  }));
  const maxRollsInput = form.querySelector('input[name="maxRolls"]:checked');
  const maxRolls = maxRollsInput ? parseInt(maxRollsInput.value, 10) : 5;
  const artifact = {
    slotIndex: slotIdx,
    name: form.name.value.trim(),
    setId: form.setId.value ? parseInt(form.setId.value, 10) : null,
    mainStat: form.mainStat.value,
    level: parseInt(form.level.value, 10) || 20,
    maxRolls: maxRolls === 4 ? 4 : 5,
    substats
  };
  if (!appData.artifacts[slotIdx]) appData.artifacts[slotIdx] = [];
  appData.artifacts[slotIdx][cellIdx] = artifact;
  document.getElementById('artifact-new-modal').classList.remove('visible');
  renderArtifacts();
  refreshDamageIfOnCyclePage();
});

document.getElementById('artifact-new-form').addEventListener('reset', () => {
  document.querySelector('#artifact-new-modal .modal-title').textContent = '新建圣遗物';
});

function runAutoBestArtifacts() {
  if (typeof getCycleTotalDamage !== 'function' || typeof getEquippedArtifacts !== 'function') {
    alert('当前环境不支持自动配置最优套装。');
    return;
  }
  const slotNames = typeof ARTIFACT_SLOTS !== 'undefined'
    ? ARTIFACT_SLOTS
    : ['生之花', '死之羽', '时之沙', '空之杯', '理之冠'];

  const initialEquippedIndices = { ...(appData.equippedArtifacts || {}) };
  const initialArtifacts = getEquippedArtifacts();
  const baseDamage = getCycleTotalDamage(initialArtifacts);

  const slots = [0, 1, 2, 3, 4];
  const choicesPerSlot = slots.map(slotIdx => {
    const list = appData.artifacts[slotIdx] || [];
    const res = [];
    list.forEach((art, cellIdx) => {
      if (art) res.push({ art, cellIdx });
    });
    return res;
  });

  let bestDamage = baseDamage;
  let bestArtifacts = initialArtifacts.slice();
  let bestEquipIndices = { ...initialEquippedIndices };

  function dfs(slotIdx, currentArtifacts, currentEquip) {
    if (slotIdx >= 5) {
      const dmg = getCycleTotalDamage(currentArtifacts);
      if (dmg > bestDamage) {
        bestDamage = dmg;
        bestArtifacts = currentArtifacts.slice();
        bestEquipIndices = { ...currentEquip };
      }
      return;
    }
    const choices = choicesPerSlot[slotIdx];
    if (!choices || choices.length === 0) {
      currentArtifacts[slotIdx] = null;
      dfs(slotIdx + 1, currentArtifacts, currentEquip);
      return;
    }
    for (const { art, cellIdx } of choices) {
      currentArtifacts[slotIdx] = art;
      currentEquip[slotIdx] = cellIdx;
      dfs(slotIdx + 1, currentArtifacts, currentEquip);
    }
  }

  dfs(0, initialArtifacts.slice(), { ...initialEquippedIndices });

  // 应用最优结果到当前装备
  appData.equippedArtifacts = bestEquipIndices;
  renderArtifacts();
  refreshDamageIfOnCyclePage();

  const delta = bestDamage - baseDamage;
  const pct = baseDamage > 0 ? (delta / baseDamage) * 100 : 0;

  const lines = [];
  lines.push(`原循环总伤害：${baseDamage.toFixed(0)}`);
  lines.push(`新循环总伤害：${bestDamage.toFixed(0)}`);
  lines.push(`提升：${delta >= 0 ? '+' : ''}${delta.toFixed(0)}（${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`);
  lines.push('');
  lines.push('圣遗物更换情况：');

  slots.forEach(slotIdx => {
    const name = slotNames[slotIdx] || `部位${slotIdx}`;
    const oldArt = initialArtifacts[slotIdx];
    const newArt = bestArtifacts[slotIdx];
    const oldCell = initialEquippedIndices[slotIdx];
    const newCell = bestEquipIndices[slotIdx];
    if (!oldArt && !newArt) {
      lines.push(`- ${name}：无圣遗物`);
      return;
    }
    if (oldArt === newArt && oldCell === newCell) {
      lines.push(`- ${name}：保持不变（${oldArt ? (oldArt.name || '（未命名）') : '无'}）`);
      return;
    }
    const oldDesc = oldArt ? `格子 ${oldCell ?? 0}：${oldArt.name || '（未命名）'}` : '无';
    const newDesc = newArt ? `格子 ${newCell ?? 0}：${newArt.name || '（未命名）'}` : '无';
    lines.push(`- ${name}：${oldDesc} → ${newDesc}`);
  });

  const contentEl = document.getElementById('artifact-auto-best-content');
  if (contentEl) {
    contentEl.textContent = lines.join('\n');
  }
  const modal = document.getElementById('artifact-auto-best-modal');
  if (modal) {
    modal.classList.add('visible');
  }
}

const artifactAutoBtn = document.getElementById('artifact-auto-best-btn');
if (artifactAutoBtn) {
  artifactAutoBtn.addEventListener('click', () => {
    runAutoBestArtifacts();
  });
}

document.getElementById('artifact-auto-best-close')?.addEventListener('click', () => {
  document.getElementById('artifact-auto-best-modal')?.classList.remove('visible');
});

document.getElementById('artifact-auto-best-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'artifact-auto-best-modal') e.target.classList.remove('visible');
});
