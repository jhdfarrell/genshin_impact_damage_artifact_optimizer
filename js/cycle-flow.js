const cycleFlowListEl = document.getElementById('cycle-flow-list');
const cycleTemplatePanelEl = document.getElementById('cycle-template-panel');
const cycleFlowForm = document.getElementById('cycle-flow-form');
const cycleElementSelect = document.getElementById('cycle-element-select');
if (cycleElementSelect && typeof CYCLE_ELEMENT_OPTIONS !== 'undefined') {
  cycleElementSelect.innerHTML = '<option value="">物理</option>' +
    CYCLE_ELEMENT_OPTIONS.filter(o => o.value !== 'phys').map(o =>
      `<option value="${o.value}">${o.label}</option>`
    ).join('');
}
const cycleAmplifySelect = document.getElementById('cycle-amplify-select');
if (cycleAmplifySelect && typeof CYCLE_AMPLIFY_OPTIONS !== 'undefined') {
  cycleAmplifySelect.innerHTML = CYCLE_AMPLIFY_OPTIONS.map(o =>
    `<option value="${o.value}">${o.label}</option>`
  ).join('');
}
const cycleDamageTypeSelect = document.getElementById('cycle-damage-type-select');
const cycleTransformativeOptions = document.getElementById('cycle-transformative-options');
const cycleSwirlElementRow = document.getElementById('cycle-swirl-element-row');
const cycleReactionSelect = document.getElementById('cycle-reaction-select');
const cycleSwirlElementSelect = document.getElementById('cycle-swirl-element-select');

const REACTION_LABELS = { swirl: '扩散', overload: '超载', shatter: '碎冰' };
const SWIRL_ELEMENT_LABELS = { pyro: '火', hydro: '水', electro: '雷', cryo: '冰' };

function updateCycleFormDamageTypeVisibility() {
  const isTransformative = cycleDamageTypeSelect?.value === 'transformative';
  const isSwirl = cycleReactionSelect?.value === 'swirl';
  if (cycleTransformativeOptions) cycleTransformativeOptions.style.display = isTransformative ? '' : 'none';
  if (cycleSwirlElementRow) cycleSwirlElementRow.style.display = isTransformative && isSwirl ? '' : 'none';
  document.querySelectorAll('.cycle-direct-only').forEach(el => {
    el.style.display = isTransformative ? 'none' : '';
  });
}
const cycleBuffSelectPreview = document.getElementById('cycle-buff-select-preview');
const cycleBuffChecksContainer = document.getElementById('cycle-buff-checks-container');
const cycleTemplateForm = document.getElementById('cycle-template-form');
const cycleTemplateChecks = document.getElementById('cycle-template-checks');

function getBuffNames() {
  return [...new Set(appData.buffs.map(b => b.name).filter(Boolean))];
}
window.getBuffNames = getBuffNames;

function getSelectedBuffRefs() {
  const raw = cycleFlowForm.dataset.buffRefs;
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function setSelectedBuffRefs(names) {
  cycleFlowForm.dataset.buffRefs = JSON.stringify(names);
  cycleBuffSelectPreview.textContent = names.length ? names.join(', ') : '（无）';
}

function populateCycleBuffChecks(selectedNames = []) {
  const names = getBuffNames();
  cycleBuffChecksContainer.innerHTML = names.map(n => `
    <label class="cycle-buff-check-item">
      <input type="checkbox" name="buffRef" value="${escapeHtml(n)}" ${selectedNames.includes(n) ? 'checked' : ''}>
      ${escapeHtml(n)}
    </label>
  `).join('');
}

function populateTemplateChecks(selectedNames = []) {
  if (!cycleTemplateChecks) return;
  const names = getBuffNames();
  cycleTemplateChecks.innerHTML = names.length ? names.map(n => `
    <label class="cycle-buff-check-item">
      <input type="checkbox" name="templateBuffRef" value="${escapeHtml(n)}" ${selectedNames.includes(n) ? 'checked' : ''}>
      ${escapeHtml(n)}
    </label>
  `).join('') : '<span class="cycle-buff-select-hint">（请先在加成页添加加成）</span>';
}

const ELEMENT_LABEL_MAP = (typeof CYCLE_ELEMENT_OPTIONS !== 'undefined' ? CYCLE_ELEMENT_OPTIONS : [])
  .reduce((m, o) => { m[o.value] = o.label; return m; }, { '': '物理' });

function getElementLabel(element) {
  return ELEMENT_LABEL_MAP[element] || (element ? element : '物理');
}

const AMPLIFY_LABEL_MAP = (typeof CYCLE_AMPLIFY_OPTIONS !== 'undefined' ? CYCLE_AMPLIFY_OPTIONS : [])
  .reduce((m, o) => { m[o.value || ''] = o.label; return m; }, { '': '无' });

function getAmplifyLabel(amplify) {
  return AMPLIFY_LABEL_MAP[amplify || ''] || '无';
}

function formatRatesDisplay(row) {
  const v = (x) => (x !== '' && x != null) ? x + '%' : '-';
  return [v(row.rateHp), v(row.rateAtk), v(row.rateDef), v(row.rateEm)].join(' / ');
}

function openCycleModal(insertIndex, rowData) {
  cycleFlowForm.dataset.insertIndex = String(insertIndex);
  delete cycleFlowForm.dataset.editingId;
  if (rowData) {
    cycleFlowForm.dataset.editingId = rowData.id;
    if (cycleDamageTypeSelect) cycleDamageTypeSelect.value = rowData.damageType === 'transformative' ? 'transformative' : 'direct';
    if (cycleReactionSelect) cycleReactionSelect.value = rowData.reaction || 'swirl';
    if (cycleSwirlElementSelect) cycleSwirlElementSelect.value = rowData.swirlElement || 'pyro';
    cycleFlowForm.damageName.value = rowData.damageName || '';
    if (cycleFlowForm.element) cycleFlowForm.element.value = rowData.element || '';
    if (cycleFlowForm.amplify) cycleFlowForm.amplify.value = rowData.amplify || '';
    cycleFlowForm.count.value = rowData.count ?? 1;
    cycleFlowForm.rateHp.value = rowData.rateHp ?? '';
    cycleFlowForm.rateAtk.value = rowData.rateAtk ?? '';
    cycleFlowForm.rateDef.value = rowData.rateDef ?? '';
    cycleFlowForm.rateEm.value = rowData.rateEm ?? '';
    cycleFlowForm.note.value = rowData.note || '';
    document.getElementById('cycle-modal-title').textContent = '修改伤害';
  } else {
    cycleFlowForm.reset();
    if (cycleDamageTypeSelect) cycleDamageTypeSelect.value = 'direct';
    if (cycleReactionSelect) cycleReactionSelect.value = 'swirl';
    if (cycleSwirlElementSelect) cycleSwirlElementSelect.value = 'pyro';
    if (cycleFlowForm.element) cycleFlowForm.element.value = '';
    if (cycleFlowForm.amplify) cycleFlowForm.amplify.value = '';
    cycleFlowForm.count.value = 1;
    document.getElementById('cycle-modal-title').textContent = '新建行';
  }
  updateCycleFormDamageTypeVisibility();
  setSelectedBuffRefs(rowData?.buffRefs ?? []);
  document.getElementById('cycle-flow-modal').classList.add('visible');
}

document.getElementById('cycle-buff-select-btn').addEventListener('click', () => {
  populateCycleBuffChecks(getSelectedBuffRefs());
  document.getElementById('cycle-buff-select-modal').classList.add('visible');
});

document.getElementById('cycle-buff-select-confirm').addEventListener('click', () => {
  const selected = [...cycleBuffChecksContainer.querySelectorAll('input[name="buffRef"]:checked')].map(cb => cb.value);
  setSelectedBuffRefs(selected);
  document.getElementById('cycle-buff-select-modal').classList.remove('visible');
});

document.getElementById('cycle-buff-select-cancel').addEventListener('click', () => {
  document.getElementById('cycle-buff-select-modal').classList.remove('visible');
});

document.getElementById('cycle-buffs-display-close').addEventListener('click', () => {
  document.getElementById('cycle-buffs-display-modal').classList.remove('visible');
});

document.getElementById('cycle-stats-panel-close').addEventListener('click', () => {
  document.getElementById('cycle-stats-panel-modal').classList.remove('visible');
});

document.getElementById('cycle-stats-panel-modal').addEventListener('click', (e) => {
  if (e.target.id === 'cycle-stats-panel-modal') e.target.classList.remove('visible');
});

document.getElementById('cycle-buffs-display-modal').addEventListener('click', (e) => {
  if (e.target.id === 'cycle-buffs-display-modal') e.target.classList.remove('visible');
});

document.getElementById('cycle-buff-select-modal').addEventListener('click', (e) => {
  if (e.target.id === 'cycle-buff-select-modal') e.target.classList.remove('visible');
});

function renderCycleBuffTemplates() {
  if (!cycleTemplatePanelEl) return;
  const list = appData.cycleBuffTemplates || [];
  const header = `
    <div class="cycle-template-header">
      <div class="cycle-template-title">加成模板</div>
      <button type="button" class="cycle-template-add-btn" id="cycle-template-add-btn">新建</button>
    </div>
  `;
  const body = list.length ? `
    <div class="cycle-template-list">
      ${list.map(t => `
        <div class="cycle-template-item" data-id="${t.id}">
          <div>
            <div class="cycle-template-name" title="${escapeHtml(t.name || '')}">${escapeHtml(t.name || '（未命名）')}</div>
            <div class="cycle-template-count">${(t.buffRefs || []).length} 项加成</div>
          </div>
          <div class="cycle-template-actions">
            <button type="button" class="cycle-template-btn apply">套用</button>
            <button type="button" class="cycle-template-btn edit">改</button>
            <button type="button" class="cycle-template-btn del">删</button>
          </div>
        </div>
      `).join('')}
    </div>
  ` : '<div class="cycle-template-empty">（暂无模板）</div>';
  cycleTemplatePanelEl.innerHTML = header + body;
  const addBtn = document.getElementById('cycle-template-add-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (!cycleTemplateForm) return;
      delete cycleTemplateForm.dataset.editId;
      cycleTemplateForm.name.value = '';
      populateTemplateChecks([]);
      const titleEl = document.getElementById('cycle-template-modal-title');
      if (titleEl) titleEl.textContent = '新建加成模板';
      document.getElementById('cycle-template-modal').classList.add('visible');
    };
  }
  cycleTemplatePanelEl.querySelectorAll('.cycle-template-item').forEach(item => {
    const id = parseInt(item.dataset.id, 10);
    const tpl = (appData.cycleBuffTemplates || []).find(t => t.id === id);
    if (!tpl) return;
    const editBtn = item.querySelector('.cycle-template-btn.edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (!cycleTemplateForm) return;
        cycleTemplateForm.dataset.editId = String(id);
        cycleTemplateForm.name.value = tpl.name || '';
        populateTemplateChecks(Array.isArray(tpl.buffRefs) ? tpl.buffRefs : []);
        const titleEl = document.getElementById('cycle-template-modal-title');
        if (titleEl) titleEl.textContent = '修改加成模板';
        document.getElementById('cycle-template-modal').classList.add('visible');
      });
    }
    const delBtn = item.querySelector('.cycle-template-btn.del');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (!confirm('确定删除该模板？')) return;
        appData.cycleBuffTemplates = (appData.cycleBuffTemplates || []).filter(t => t.id !== id);
        renderCycleBuffTemplates();
      });
    }
    const applyBtn = item.querySelector('.cycle-template-btn.apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const refs = Array.isArray(tpl.buffRefs) ? tpl.buffRefs.filter(Boolean) : [];
        appData.cycleFlow = (appData.cycleFlow || []).map(r => ({ ...r, buffRefs: refs.slice() }));
        renderCycleFlow();
      });
    }
  });
}

function renderCycleFlow() {
  runDamageUpdate();
  cycleFlowListEl.innerHTML = '';
  renderCycleBuffTemplates();
  const rows = appData.cycleFlow;
  for (let i = 0; i <= rows.length; i++) {
    const insertBtn = document.createElement('div');
    insertBtn.className = 'cycle-flow-insert';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cycle-flow-insert-btn';
    btn.textContent = i === 0 ? '+ 在开头插入' : '+ 在此插入';
    btn.dataset.insertIndex = String(i);
    btn.addEventListener('click', () => openCycleModal(i));
    insertBtn.appendChild(btn);
    cycleFlowListEl.appendChild(insertBtn);
    if (i < rows.length) {
      cycleFlowListEl.appendChild(renderCycleFlowRow(rows[i]));
    }
  }
  initCycleFlowDrag();
}
window.renderCycleFlow = renderCycleFlow;

function renderCycleFlowRow(row) {
  const div = document.createElement('div');
  div.className = 'cycle-flow-row';
  div.dataset.rowId = row.id;
  div.draggable = true;
  const buffCount = row.buffRefs?.length || 0;
  const isTransformative = row.damageType === 'transformative';
  const nameDisplay = isTransformative
    ? (row.damageName || (REACTION_LABELS[row.reaction] || '剧变') + (row.reaction === 'swirl' && row.swirlElement ? '(' + (SWIRL_ELEMENT_LABELS[row.swirlElement] || row.swirlElement) + ')' : ''))
    : (row.damageName || '（未命名）');
  const elemLabel = isTransformative ? (row.reaction ? '剧变·' + (REACTION_LABELS[row.reaction] || row.reaction) : '剧变') : getElementLabel(row.element);
  const ampLabel = isTransformative ? '—' : getAmplifyLabel(row.amplify);
  div.innerHTML = `
    <span class="cycle-flow-drag" title="拖动调整顺序">⋮⋮</span>
    <span class="cycle-flow-name">${escapeHtml(nameDisplay)} × ${row.count ?? 1}</span>
    <span class="cycle-flow-element" title="${isTransformative ? '剧变类型' : '伤害元素'}">${escapeHtml(elemLabel)}</span>
    <span class="cycle-flow-amplify" title="增幅反应">${escapeHtml(ampLabel)}</span>
    <span class="cycle-flow-rates">${escapeHtml(isTransformative ? '—' : formatRatesDisplay(row))}</span>
    <span class="cycle-flow-buffs">
      <button type="button" class="cycle-flow-buffs-btn">受到加成${buffCount ? ` (${buffCount})` : ''}</button>
    </span>
    <span class="cycle-flow-template">
      <select class="cycle-flow-template-select">
        <option value="">模板: 无</option>
        ${(appData.cycleBuffTemplates || []).map(t => `<option value="${t.id}">${escapeHtml(t.name || '')}</option>`).join('')}
      </select>
    </span>
  `;
  div.querySelector('.cycle-flow-buffs-btn').onclick = () => {
    const content = row.buffRefs?.length ? row.buffRefs.join('\n') : '（无）';
    document.getElementById('cycle-buffs-display-content').textContent = content;
    document.getElementById('cycle-buffs-display-modal').classList.add('visible');
  };
  const noteBtn = document.createElement('button');
  noteBtn.type = 'button';
  noteBtn.className = 'buff-item-note-btn';
  noteBtn.textContent = '备注';
  noteBtn.onclick = () => {
    document.getElementById('buff-note-content').textContent = row.note || '（无）';
    document.getElementById('buff-note-modal').classList.add('visible');
  };
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'buff-item-edit-btn';
  editBtn.textContent = '修改';
  editBtn.onclick = () => openCycleModal(0, row);
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'buff-item-copy-btn';
  copyBtn.textContent = '复制';
  copyBtn.onclick = () => {
    const idx = appData.cycleFlow.findIndex(r => r.id === row.id);
    const copy = { ...row, id: ++cycleFlowIdCounter };
    appData.cycleFlow.splice(idx + 1, 0, copy);
    renderCycleFlow();
  };
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'buff-item-del-btn';
  delBtn.textContent = '删除';
  delBtn.onclick = () => {
    appData.cycleFlow = appData.cycleFlow.filter(r => r.id !== row.id);
    renderCycleFlow();
  };
  const damageSpan = document.createElement('span');
  damageSpan.className = 'cycle-flow-damage';
  const rowDmg = window.lastCalcResult?.rowDamages?.find(d => String(d.rowId) === String(row.id));
  damageSpan.textContent = rowDmg != null && typeof rowDmg.damage === 'number'
    ? String(rowDmg.damage) : '—';
  const statsBtn = document.createElement('button');
  statsBtn.type = 'button';
  statsBtn.className = 'cycle-flow-stats-btn';
  statsBtn.title = '查看此时角色面板';
  statsBtn.textContent = '面板';
  statsBtn.onclick = () => {
    const data = typeof getRowCalculationData === 'function' ? getRowCalculationData(row) : null;
    const stats = data && typeof window.getRowStats === 'function' ? window.getRowStats(data) : null;
    const el = document.getElementById('cycle-stats-panel-content');
    if (!el) return;
    if (!stats) {
      el.innerHTML = '<p class="cycle-stats-panel-empty">无法获取面板数据</p>';
    } else {
      const fmt = (v, pct) => (typeof v === 'number' ? (pct ? (v * 100).toFixed(1) + '%' : Math.round(v)) : '—');
      const parseNumLocal = (x) => {
        if (x === '' || x == null) return 0;
        const n = parseFloat(x);
        return Number.isNaN(n) ? 0 : n;
      };
      const rawHp = stats.rawBaseHp ?? stats.baseHp ?? 0, rawAtk = stats.rawBaseAtk ?? stats.baseAtk ?? 0, rawDef = stats.rawBaseDef ?? stats.baseDef ?? 0, rawEm = stats.rawBaseEm ?? stats.baseEm ?? 0;
      const artFlatHp = stats.artifactFlatHp ?? 0, artFlatAtk = stats.artifactFlatAtk ?? 0, artFlatDef = stats.artifactFlatDef ?? 0, artFlatEm = stats.artifactFlatEm ?? 0;
      const hpFlat = stats.hpFlatBuff ?? 0, atkFlat = stats.atkFlatBuff ?? 0, defFlat = stats.defFlatBuff ?? 0, emFlat = stats.emFlatBuff ?? 0;
      const equivHpPct = rawHp ? (stats.hpPct || 0) + (artFlatHp + hpFlat) / rawHp : (stats.hpPct || 0);
      const equivAtkPct = rawAtk ? (stats.atkPct || 0) + (artFlatAtk + atkFlat) / rawAtk : (stats.atkPct || 0);
      const equivDefPct = rawDef ? (stats.defPct || 0) + (artFlatDef + defFlat) / rawDef : (stats.defPct || 0);
      const equivEmPct = rawEm ? (artFlatEm + emFlat) / rawEm : 0;
      const zonesDisplay = typeof BUFF_PANELS !== 'undefined' ? BUFF_PANELS : [];
      const element = (row.element || 'phys').toLowerCase();
      const amplify = (row.amplify || '').toLowerCase();
      let baseReactionCoeff = 1;
      if (amplify === 'vaporize') {
        if (element === 'pyro') baseReactionCoeff = 1.5;
        else if (element === 'hydro') baseReactionCoeff = 2;
      } else if (amplify === 'melt') {
        if (element === 'pyro') baseReactionCoeff = 2;
        else if (element === 'cryo') baseReactionCoeff = 1.5;
      }
      const emForReaction = stats.em ?? 0;
      const emReactionBonus = emForReaction > 0 ? 2.78 * emForReaction / (1400 + emForReaction) : 0;
      const otherReactionBonus = stats.reactionBonus || 0;
      const totalReactionBonus = otherReactionBonus + emReactionBonus;
      const totalReactionMult = baseReactionCoeff * (1 + totalReactionBonus);
      const rateHpBase = parseNumLocal(row.rateHp) / 100;
      const rateAtkBase = parseNumLocal(row.rateAtk) / 100;
      const rateDefBase = parseNumLocal(row.rateDef) / 100;
      const rateEmBase = parseNumLocal(row.rateEm) / 100;
      const totalHpMult = (stats.hpMult || 0) + rateHpBase;
      const totalAtkMult = (stats.atkMult || 0) + rateAtkBase;
      const totalDefMult = (stats.defMult || 0) + rateDefBase;
      const totalEmMult = (stats.emMult || 0) + rateEmBase;
      const effectiveDmgBonus = ((stats.dmgBonusByElement && stats.dmgBonusByElement[element]) || 0) + (stats.dmgBonus || 0);
      const ELEMENT_DMG_LABELS = { phys: '物理', pyro: '火', hydro: '水', electro: '雷', cryo: '冰', anemo: '风', dendro: '草', geo: '岩' };
      const zoneDims = {
        '属性区': [
          { key: 'equivHpPct', label: '生命等效总加成', pct: true },
          { key: 'equivAtkPct', label: '攻击等效总加成', pct: true },
          { key: 'equivDefPct', label: '防御等效总加成', pct: true },
          { key: 'equivEmPct', label: '精通等效总加成', pct: true }
        ],
        '倍率区': [
          { key: 'totalHpMult', label: '生命倍率', pct: true },
          { key: 'totalAtkMult', label: '攻击倍率', pct: true },
          { key: 'totalDefMult', label: '防御倍率', pct: true },
          { key: 'totalEmMult', label: '精通倍率', pct: true },
          { key: 'flatDmg', label: '固定伤害', pct: false }
        ],
        '增伤区': [{ key: 'effectiveDmgBonus', label: '增伤总加成（当前属性）', pct: true }],
        '双暴区': [
          { key: 'critRate', label: '暴击率', pct: true },
          { key: 'critDmg', label: '暴击伤害', pct: true }
        ],
        '反应区': [{ key: 'reactionBonus', label: '反应系数加成', pct: true }],
        '防御区': [{ key: 'defReduct', label: '减防', pct: true }],
        '抗性区': [{ key: 'resistReduct', label: '减抗', pct: true }],
        '擢升区': [{ key: 'ascendBonus', label: '擢升等效总加成', pct: true }],
        '特殊独立乘区': [{ key: 'specialBonus', label: '特殊乘区等效总加成', pct: true }]
      };
      const zoneArtifactDims = {
        '属性区': [
          { key: 'hp', label: '生命', pct: false },
          { key: 'atk', label: '攻击', pct: false },
          { key: 'def', label: '防御', pct: false },
          { key: 'em', label: '精通', pct: false },
          { key: 'hpPct', label: '生命%', pct: true },
          { key: 'atkPct', label: '攻击%', pct: true },
          { key: 'defPct', label: '防御%', pct: true }
        ],
        '增伤区': [],
        '双暴区': [
          { key: 'critRate', label: '暴击率', pct: true },
          { key: 'critDmg', label: '暴击伤害', pct: true }
        ]
      };
      let html = '<div class="cycle-stats-panel-base">';
      html += '<div class="cycle-stats-panel-section-title">基础面板</div>';
      html += '<div class="cycle-stats-panel-note" style="margin-bottom:0.35rem">仅角色+武器，不含圣遗物</div>';
      html += '<div class="cycle-stats-panel-grid">';
      html += `<span class="cycle-stats-panel-label">生命</span><span>${fmt(stats.rawBaseHp ?? stats.baseHp)}</span>`;
      html += `<span class="cycle-stats-panel-label">攻击</span><span>${fmt(stats.rawBaseAtk ?? stats.baseAtk)}</span>`;
      html += `<span class="cycle-stats-panel-label">防御</span><span>${fmt(stats.rawBaseDef ?? stats.baseDef)}</span>`;
      html += `<span class="cycle-stats-panel-label">精通</span><span>${fmt(stats.rawBaseEm ?? stats.baseEm)}</span>`;
      html += '</div></div>';
      const artMain = stats.artifactMain || {};
      const artSub = stats.artifactSub || {};
      const artDimKeys = [
        { key: 'hp', label: '生命', pct: false },
        { key: 'atk', label: '攻击', pct: false },
        { key: 'def', label: '防御', pct: false },
        { key: 'em', label: '精通', pct: false },
        { key: 'hpPct', label: '生命%', pct: true },
        { key: 'atkPct', label: '攻击%', pct: true },
        { key: 'defPct', label: '防御%', pct: true },
        { key: 'critRate', label: '暴击率', pct: true },
        { key: 'critDmg', label: '暴击伤害', pct: true }
      ];
      const artMainDmgByEl = artMain.dmgBonusByElement || {};
      const hasArtMainDmg = Object.keys(artMainDmgByEl).some(k => (artMainDmgByEl[k] || 0) !== 0);
      const hasArtMain = artDimKeys.some(d => (artMain[d.key] || 0) !== 0) || hasArtMainDmg;
      const hasArtSub = artDimKeys.some(d => (artSub[d.key] || 0) !== 0);
      if (hasArtMain || hasArtSub) {
        html += '<div class="cycle-stats-panel-section cycle-stats-panel-artifact">';
        html += '<div class="cycle-stats-panel-section-title">圣遗物</div>';
        if (hasArtMain) {
          html += '<div class="cycle-stats-panel-subtitle">主词条总和</div><div class="cycle-stats-panel-grid">';
          artDimKeys.forEach(d => {
            const v = artMain[d.key];
            if (v !== undefined && v !== 0) html += `<span class="cycle-stats-panel-label">${escapeHtml(d.label)}</span><span>${fmt(v, d.pct)}</span>`;
          });
          if (hasArtMainDmg) {
            Object.keys(artMainDmgByEl).forEach(el => {
              const v = artMainDmgByEl[el];
              if (v && v !== 0) html += `<span class="cycle-stats-panel-label">${escapeHtml(ELEMENT_DMG_LABELS[el] || el) + '伤'}</span><span>${fmt(v, true)}</span>`;
            });
          }
          html += '</div>';
        }
        if (hasArtSub) {
          html += '<div class="cycle-stats-panel-subtitle">副词条总和</div><div class="cycle-stats-panel-grid">';
          artDimKeys.forEach(d => {
            const v = artSub[d.key];
            if (v !== undefined && v !== 0) html += `<span class="cycle-stats-panel-label">${escapeHtml(d.label)}</span><span>${fmt(v, d.pct)}</span>`;
          });
          html += '</div>';
        }
        html += '</div>';
      }
      if (row.damageType === 'transformative' && typeof window.getTransformativeBreakdown === 'function') {
        const tb = window.getTransformativeBreakdown(data);
        html += '<div class="cycle-stats-panel-section">';
        html += '<div class="cycle-stats-panel-section-title">剧变反应</div>';
        html += '<div class="cycle-stats-panel-note" style="margin-bottom:0.35rem">等级系数 × 反应倍率 × (1 + 精通收益 + 其他反应加成) × 抗性乘区；剧变不暴击</div>';
        html += '<div class="cycle-stats-panel-grid">';
        html += `<span class="cycle-stats-panel-label">类型</span><span>${escapeHtml(tb.rateLabel)}</span>`;
        html += `<span class="cycle-stats-panel-label">等级系数</span><span>${fmt(tb.levelBase)}</span>`;
        html += `<span class="cycle-stats-panel-label">反应倍率</span><span>${tb.rate}</span>`;
        html += `<span class="cycle-stats-panel-label">元素精通</span><span>${fmt(tb.em)}</span>`;
        html += `<span class="cycle-stats-panel-label">精通收益</span><span>${(tb.emBonus * 100).toFixed(1)}%</span>`;
        html += `<span class="cycle-stats-panel-label">其他反应加成</span><span>${(tb.reactionBonus * 100).toFixed(1)}%</span>`;
        html += `<span class="cycle-stats-panel-label">抗性乘区</span><span>${tb.resMult.toFixed(3)}</span>`;
        html += `<span class="cycle-stats-panel-label">单次伤害</span><span>${Math.round(tb.damage)}</span>`;
        html += '</div>';
        html += '<div class="cycle-stats-panel-note">' + Math.round(tb.levelBase) + ' × ' + tb.rate + ' × (1 + ' + (tb.emBonus * 100).toFixed(1) + '% + ' + (tb.reactionBonus * 100).toFixed(1) + '%) × ' + tb.resMult.toFixed(3) + ' = ' + Math.round(tb.damage) + '</div>';
        html += '</div>';
      }
      zonesDisplay.forEach(panel => {
        const title = panel.title;
        const dims = zoneDims[title];
        const buffs = (stats.zoneBuffs && stats.zoneBuffs[title]) || [];
        if (!dims && buffs.length === 0) return;
        html += '<div class="cycle-stats-panel-section">';
        html += '<div class="cycle-stats-panel-section-title">' + escapeHtml(title);
        if (panel.note) html += '<span class="cycle-stats-panel-note"> ' + escapeHtml(panel.note) + '</span>';
        html += '</div>';
        if (dims && dims.length) {
          html += '<div class="cycle-stats-panel-grid">';
          dims.forEach(d => {
            const v = d.key.startsWith('equiv')
              ? { equivHpPct, equivAtkPct, equivDefPct, equivEmPct }[d.key]
              : (d.key === 'effectiveDmgBonus' ? effectiveDmgBonus
                : d.key === 'totalHpMult' ? totalHpMult
                  : d.key === 'totalAtkMult' ? totalAtkMult
                    : d.key === 'totalDefMult' ? totalDefMult
                      : d.key === 'totalEmMult' ? totalEmMult
                        : stats[d.key]);
            if (v !== undefined) html += `<span class="cycle-stats-panel-label">${escapeHtml(d.label)}</span><span>${fmt(v, d.pct)}</span>`;
          });
          html += '</div>';
        }
        if (title === '反应区' && (amplify === 'vaporize' || amplify === 'melt')) {
          html += '<div class="cycle-stats-panel-note">';
          html += '基础系数：' + baseReactionCoeff.toFixed(2) +
            '；元素精通反应加成：' + (emReactionBonus * 100).toFixed(1) + '%；其他反应系数加成：' +
            (otherReactionBonus * 100).toFixed(1) + '%；总反应倍率：' +
            baseReactionCoeff.toFixed(2) + ' × (1 + ' + (totalReactionBonus * 100).toFixed(1) + '%) = ' +
            totalReactionMult.toFixed(3);
          html += '</div>';
        }
        const artDimsForZone = zoneArtifactDims[title];
        if (artDimsForZone && artDimsForZone.length) {
          const mainParts = artDimsForZone.filter(d => (artMain[d.key] || 0) !== 0).map(d => escapeHtml(d.label) + ' ' + fmt(artMain[d.key], d.pct));
          const subParts = artDimsForZone.filter(d => (artSub[d.key] || 0) !== 0).map(d => escapeHtml(d.label) + ' ' + fmt(artSub[d.key], d.pct));
          if (mainParts.length || subParts.length) {
            html += '<div class="cycle-stats-panel-artifact-in-zone">';
            if (mainParts.length) html += '<div class="cycle-stats-panel-buff-item"><span class="cycle-stats-panel-buff-name">圣遗物主词条</span><span>' + mainParts.join('；') + '</span></div>';
            if (subParts.length) html += '<div class="cycle-stats-panel-buff-item"><span class="cycle-stats-panel-buff-name">圣遗物副词条</span><span>' + subParts.join('；') + '</span></div>';
            html += '</div>';
          }
        }
        if (buffs.length) {
          html += '<div class="cycle-stats-panel-buffs">';
          buffs.forEach(b => {
            const valStr = b.isPercent ? (parseFloat(b.value) || 0) + '%' : (b.value ?? '—');
            html += `<div class="cycle-stats-panel-buff-item"><span class="cycle-stats-panel-buff-name">${escapeHtml(b.name || '')}</span><span>${escapeHtml(String(valStr))}</span></div>`;
          });
          html += '</div>';
        }
        html += '</div>';
      });
      html += '<div class="cycle-stats-panel-section"><div class="cycle-stats-panel-section-title">最终面板</div>';
      html += '<div class="cycle-stats-panel-note" style="margin-bottom:0.35rem">基础×(1+等效加成)+固定（含圣遗物与加成）</div>';
      html += '<div class="cycle-stats-panel-grid">';
      html += `<span class="cycle-stats-panel-label">生命</span><span>${fmt(stats.hp)}</span>`;
      html += `<span class="cycle-stats-panel-label">攻击</span><span>${fmt(stats.atk)}</span>`;
      html += `<span class="cycle-stats-panel-label">防御</span><span>${fmt(stats.def)}</span>`;
      html += `<span class="cycle-stats-panel-label">精通</span><span>${fmt(stats.em)}</span>`;
      html += '</div>';
      if (row.damageType !== 'transformative') {
        const parseNumLocal = (x) => {
          if (x === '' || x == null) return 0;
          const n = parseFloat(x);
          return Number.isNaN(n) ? 0 : n;
        };
        const rateHp = parseNumLocal(row.rateHp) / 100;
        const rateAtk = parseNumLocal(row.rateAtk) / 100;
        const rateDef = parseNumLocal(row.rateDef) / 100;
        const rateEm = parseNumLocal(row.rateEm) / 100;
        let baseDmg = stats.hp * (rateHp + (stats.hpMult || 0))
          + stats.atk * (rateAtk + (stats.atkMult || 0))
          + stats.def * (rateDef + (stats.defMult || 0))
          + stats.em * (rateEm + (stats.emMult || 0))
          + (stats.flatDmg || 0);
        if (baseDmg > 0) {
          const dmgBonusMult = 1 + effectiveDmgBonus;
          const cr = Math.min(1, Math.max(0, stats.critRate || 0));
          const cd = stats.critDmg || 0;
          const avgCrit = 1 + cr * cd;
          const bp = (data && data.basePanel) || {};
          const charLvl = Math.max(1, parseFloat(bp.charLevel) || 90);
          const monsterLvl = Math.max(1, parseFloat(bp.monsterLevel) || 90);
          const defReductClamped = Math.min(0.9, Math.max(0, stats.defReduct || 0));
          const c = charLvl + 100;
          const m = (monsterLvl + 100) * (1 - defReductClamped);
          const defMult = c / (c + m);
          const resistKey = element === 'phys' ? 'resistPhys' : 'resist' + element.charAt(0).toUpperCase() + element.slice(1);
          const baseResVal = bp[resistKey] ?? bp.resistPhys;
          const baseRes = parseFloat(baseResVal) / 100 || 0;
          const finalRes = baseRes - (stats.resistReduct || 0);
          const r = finalRes;
          let resMult;
          if (r < 0) resMult = 1 - r / 2;
          else if (r < 0.75) resMult = 1 - r;
          else resMult = 1 / (4 * r + 1);
          const reactionMult = totalReactionMult;
          const ascendMult = 1 + (stats.ascendBonus || 0);
          const specialMult = 1 + (stats.specialBonus || 0);
          const perHit = baseDmg * dmgBonusMult * avgCrit * defMult * resMult * reactionMult * ascendMult * specialMult;
          const count = Math.max(1, parseInt(row.count, 10) || 1);
          const totalDmg = perHit * count;
          html += '<div class="cycle-stats-panel-note">';
          html += '伤害分解：' +
            baseDmg.toFixed(1) + '（基础） × ' +
            dmgBonusMult.toFixed(3) + '（增伤乘区） × ' +
            avgCrit.toFixed(3) + '（暴击期望） × ' +
            defMult.toFixed(3) + '（防御乘区） × ' +
            resMult.toFixed(3) + '（抗性乘区） × ' +
            baseReactionCoeff.toFixed(3) + '（反应基础系数） × ' +
            (1 + totalReactionBonus).toFixed(3) + '（精通/套装反应加成乘区） × ' +
            ascendMult.toFixed(3) + '（擢升乘区） × ' +
            specialMult.toFixed(3) + '（特殊乘区）' +
            ' ≈ ' + perHit.toFixed(1) + '（单次），× ' + count + ' ≈ ' + totalDmg.toFixed(1) + '（总计）';
          html += '</div>';
        }
      }
      html += '</div>';
      el.innerHTML = html;
    }
    document.getElementById('cycle-stats-panel-modal').classList.add('visible');
  };
  div.appendChild(noteBtn);
  div.appendChild(editBtn);
  div.appendChild(copyBtn);
  div.appendChild(delBtn);
  div.appendChild(damageSpan);
  div.appendChild(statsBtn);
  const tplSelect = div.querySelector('.cycle-flow-template-select');
  if (tplSelect) {
    tplSelect.addEventListener('change', () => {
      const val = tplSelect.value;
      if (!val) return;
      const id = parseInt(val, 10);
      const tpl = (appData.cycleBuffTemplates || []).find(t => t.id === id);
      if (!tpl) return;
      row.buffRefs = Array.isArray(tpl.buffRefs) ? tpl.buffRefs.filter(Boolean) : [];
      renderCycleFlow();
    });
  }
  return div;
}

function initCycleFlowDrag() {
  cycleFlowListEl.querySelectorAll('.cycle-flow-row').forEach(rowEl => {
    rowEl.ondragstart = (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', rowEl.dataset.rowId);
      rowEl.classList.add('dragging');
    };
    rowEl.ondragend = () => rowEl.classList.remove('dragging');
    rowEl.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cycleFlowListEl.querySelectorAll('.cycle-flow-row').forEach(r => r.classList.remove('drag-over'));
      rowEl.classList.add('drag-over');
    };
    rowEl.ondragleave = () => rowEl.classList.remove('drag-over');
    rowEl.ondrop = (e) => {
      e.preventDefault();
      rowEl.classList.remove('drag-over');
      const srcId = e.dataTransfer.getData('text/plain');
      const srcIdx = appData.cycleFlow.findIndex(r => String(r.id) === srcId);
      const tgtIdx = appData.cycleFlow.findIndex(r => String(r.id) === rowEl.dataset.rowId);
      if (srcIdx >= 0 && tgtIdx >= 0 && srcIdx !== tgtIdx) {
        const [item] = appData.cycleFlow.splice(srcIdx, 1);
        const newIdx = srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
        appData.cycleFlow.splice(newIdx, 0, item);
        renderCycleFlow();
      }
    };
  });
}

if (cycleDamageTypeSelect) cycleDamageTypeSelect.addEventListener('change', updateCycleFormDamageTypeVisibility);
if (cycleReactionSelect) cycleReactionSelect.addEventListener('change', updateCycleFormDamageTypeVisibility);

cycleFlowForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const buffRefs = getSelectedBuffRefs();
  const damageType = cycleDamageTypeSelect?.value === 'transformative' ? 'transformative' : 'direct';
  const rowData = {
    id: cycleFlowForm.dataset.editingId ? parseInt(cycleFlowForm.dataset.editingId, 10) : ++cycleFlowIdCounter,
    damageType,
    reaction: damageType === 'transformative' ? (cycleReactionSelect?.value || 'swirl') : '',
    swirlElement: damageType === 'transformative' && cycleReactionSelect?.value === 'swirl' ? (cycleSwirlElementSelect?.value || 'pyro') : '',
    damageName: cycleFlowForm.damageName.value.trim(),
    count: parseInt(cycleFlowForm.count.value, 10) || 1,
    rateHp: cycleFlowForm.rateHp.value.trim(),
    rateAtk: cycleFlowForm.rateAtk.value.trim(),
    rateDef: cycleFlowForm.rateDef.value.trim(),
    rateEm: cycleFlowForm.rateEm.value.trim(),
    element: cycleFlowForm.element?.value || '',
    amplify: cycleFlowForm.amplify?.value || '',
    buffRefs,
    note: cycleFlowForm.note.value.trim()
  };
  const insertIndex = parseInt(cycleFlowForm.dataset.insertIndex, 10);
  if (cycleFlowForm.dataset.editingId) {
    const idx = appData.cycleFlow.findIndex(r => r.id === rowData.id);
    if (idx >= 0) appData.cycleFlow[idx] = rowData;
  } else {
    appData.cycleFlow.splice(insertIndex, 0, rowData);
  }
  document.getElementById('cycle-flow-modal').classList.remove('visible');
  renderCycleFlow();
});

document.getElementById('cycle-modal-cancel').addEventListener('click', () => {
  document.getElementById('cycle-flow-modal').classList.remove('visible');
});

document.getElementById('cycle-flow-modal').addEventListener('click', (e) => {
  if (e.target.id === 'cycle-flow-modal') e.target.classList.remove('visible');
});

if (cycleTemplateForm) {
  cycleTemplateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cycleTemplateForm.name.value.trim();
    const buffRefs = [...(cycleTemplateChecks?.querySelectorAll('input[name="templateBuffRef"]:checked') || [])].map(cb => cb.value).filter(Boolean);
    const editId = cycleTemplateForm.dataset.editId ? parseInt(cycleTemplateForm.dataset.editId, 10) : null;
    if (editId) {
      const tpl = (appData.cycleBuffTemplates || []).find(t => t.id === editId);
      if (tpl) {
        tpl.name = name;
        tpl.buffRefs = buffRefs;
      }
    } else {
      const id = ++cycleBuffTemplateIdCounter;
      if (!appData.cycleBuffTemplates) appData.cycleBuffTemplates = [];
      appData.cycleBuffTemplates.push({ id, name, buffRefs });
    }
    document.getElementById('cycle-template-modal').classList.remove('visible');
    renderCycleBuffTemplates();
  });
}

document.getElementById('cycle-template-cancel')?.addEventListener('click', () => {
  document.getElementById('cycle-template-modal').classList.remove('visible');
});

document.getElementById('cycle-template-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'cycle-template-modal') e.target.classList.remove('visible');
});
