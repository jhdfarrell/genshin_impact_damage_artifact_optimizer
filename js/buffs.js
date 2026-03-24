const buffPanelsEl = document.getElementById('buff-panels');
buffPanelsEl.innerHTML = BUFF_PANELS.map(({ title, note }, i) => `
  <div class="buff-panel" data-panel-index="${i}">
    <div class="buff-panel-header">
      <div class="buff-panel-title">${title}</div>
      ${note ? `<span class="buff-panel-note">${note}</span>` : ''}
    </div>
    <div class="buff-panel-body">
      ${BUFF_COLUMNS.map(c => `<span class="buff-panel-col-header">${c}</span>`).join('')}
      <span class="buff-panel-col-header buff-panel-col-actions"></span>
      <span class="buff-panel-col-header buff-panel-col-actions"></span>
      <span class="buff-panel-col-header buff-panel-col-actions"></span>
    </div>
    <div class="buff-panel-footer">
      <button type="button" class="buff-panel-btn buff-new-btn" data-panel-index="${i}">新建</button>
    </div>
  </div>
`).join('');

const buffModal = document.getElementById('buff-new-modal');
const buffForm = document.getElementById('buff-new-form');
const contentSelect = document.getElementById('buff-content-select');
const valueInput = document.getElementById('buff-value');
const isPercentCheck = document.getElementById('buff-is-percent');
const isArtifactCheck = document.getElementById('buff-is-artifact');
const artifactPiecesSelect = document.getElementById('buff-artifact-pieces');
const artifactPiecesRowEl = document.getElementById('buff-artifact-pieces-row');

function toggleArtifactOptions() {
  artifactPiecesRowEl.style.display = isArtifactCheck.checked ? '' : 'none';
}

function populateBuffContent(panelIndex) {
  const opts = BUFF_CONTENT_OPTIONS[panelIndex] ?? [];
  contentSelect.innerHTML = '<option value="">-- 请选择 --</option>' +
    opts.map(o => {
      let attrs = `data-step="${o.step}"`;
      if (o.lockPercent) attrs += ' data-lock-percent="1"';
      if (o.lockPercentChecked) attrs += ' data-lock-percent-checked="1"';
      return `<option value="${o.value}" ${attrs}>${o.label}</option>`;
    }).join('');
}

function updateBuffFormState() {
  const opt = contentSelect.selectedOptions[0];
  valueInput.step = opt?.dataset.step ?? 'any';
  const lockPercent = opt?.dataset.lockPercent === '1';
  const lockPercentChecked = opt?.dataset.lockPercentChecked === '1';
  isPercentCheck.disabled = lockPercent || lockPercentChecked;
  if (lockPercent) isPercentCheck.checked = false;
  if (lockPercentChecked) isPercentCheck.checked = true;
}

function getBuffDataFromForm(keepId) {
  const opt = contentSelect.selectedOptions[0];
  const isArtifact = isArtifactCheck.checked;
  const artifactPiecesVal = artifactPiecesSelect.value;
  return {
    id: keepId ?? ++buffIdCounter,
    panelIndex: parseInt(buffForm.dataset.panelIndex, 10),
    name: buffForm.name.value.trim(),
    content: buffForm.content.value,
    contentLabel: opt?.text ?? '',
    isPercent: buffForm.isPercent.checked,
    value: buffForm.value.value,
    condition: buffForm.condition.value.trim(),
    duration: buffForm.duration.value,
    note: buffForm.note.value.trim(),
    isArtifactBuff: isArtifact,
    artifactPieces: isArtifact && artifactPiecesVal !== '' ? parseInt(artifactPiecesVal, 10) : 2
  };
}

function openBuffModalForEdit(buff) {
  buffForm.dataset.panelIndex = buff.panelIndex;
  buffForm.dataset.editingBuffId = buff.id;
  populateBuffContent(buff.panelIndex);
  buffForm.name.value = buff.name;
  buffForm.content.value = buff.content;
  buffForm.isPercent.checked = buff.isPercent;
  buffForm.value.value = buff.value;
  buffForm.condition.value = buff.condition;
  buffForm.duration.value = buff.duration;
  buffForm.note.value = buff.note;
  isArtifactCheck.checked = !!buff.isArtifactBuff;
  artifactPiecesSelect.value = buff.artifactPieces === 4 ? '4' : '2';
  toggleArtifactOptions();
  setTimeout(() => {
    contentSelect.value = buff.content;
    updateBuffFormState();
  }, 0);
  document.getElementById('buff-modal-title').textContent = '修改加成';
  buffModal.classList.add('visible');
}

function removeBuff(buffId) {
  const idx = appData.buffs.findIndex(b => b.id === buffId);
  if (idx >= 0) appData.buffs.splice(idx, 1);
  refreshDamageIfOnCyclePage();
  const row = buffPanelsEl.querySelector(`.buff-item[data-buff-id="${buffId}"]`);
  if (row) row.remove();
}

function renderBuffRow(buff) {
  const val = buff.value ? (buff.isPercent ? buff.value + '%' : buff.value) : '-';
  const cond = buff.condition || '-';
  const dur = buff.duration ? buff.duration + 's' : '-';
  const item = document.createElement('div');
  item.className = 'buff-item';
  item.dataset.buffId = buff.id;
  const noteBtn = document.createElement('button');
  noteBtn.type = 'button';
  noteBtn.className = 'buff-item-note-btn';
  noteBtn.textContent = '备注';
  noteBtn.addEventListener('click', () => {
    document.getElementById('buff-note-content').textContent = buff.note || '（无）';
    document.getElementById('buff-note-modal').classList.add('visible');
  });
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'buff-item-edit-btn';
  editBtn.textContent = '修改';
  editBtn.addEventListener('click', () => openBuffModalForEdit(buff));
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'buff-item-del-btn';
  delBtn.textContent = '删除';
  delBtn.addEventListener('click', () => removeBuff(buff.id));
  item.innerHTML = `
    <span>${escapeHtml(buff.name)}${buff.isArtifactBuff ? ' <span class="buff-tag-artifact">圣遗物</span>' : ''}</span>
    <span>${escapeHtml(buff.contentLabel || '-')}</span>
    <span>${escapeHtml(val)}</span>
    <span>${escapeHtml(cond)}</span>
    <span>${escapeHtml(dur)}</span>
  `;
  item.appendChild(noteBtn);
  item.appendChild(editBtn);
  item.appendChild(delBtn);
  return item;
}

function addBuffToPanel(buff) {
  appData.buffs.push(buff);
  refreshDamageIfOnCyclePage();
  const panel = buffPanelsEl.querySelector(`[data-panel-index="${buff.panelIndex}"] .buff-panel-body`);
  panel.appendChild(renderBuffRow(buff));
}

function renderAllBuffs() {
  buffPanelsEl.querySelectorAll('.buff-item').forEach(el => el.remove());
  (appData.buffs || []).forEach(buff => {
    const panel = buffPanelsEl.querySelector(`[data-panel-index="${buff.panelIndex}"] .buff-panel-body`);
    if (panel) panel.appendChild(renderBuffRow(buff));
  });
}
window.renderAllBuffs = renderAllBuffs;

contentSelect.addEventListener('change', updateBuffFormState);

isArtifactCheck.addEventListener('change', toggleArtifactOptions);

document.querySelectorAll('.buff-new-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = btn.dataset.panelIndex;
    buffForm.dataset.panelIndex = idx;
    delete buffForm.dataset.editingBuffId;
    buffForm.reset();
    populateBuffContent(idx);
    toggleArtifactOptions();
    updateBuffFormState();
    document.getElementById('buff-modal-title').textContent = '新建加成';
    buffModal.classList.add('visible');
  });
});

document.getElementById('buff-modal-cancel').addEventListener('click', () => {
  buffModal.classList.remove('visible');
});

buffModal.addEventListener('click', (e) => {
  if (e.target === buffModal) buffModal.classList.remove('visible');
});

document.getElementById('buff-note-close').addEventListener('click', () => {
  document.getElementById('buff-note-modal').classList.remove('visible');
});

document.getElementById('buff-note-modal').addEventListener('click', (e) => {
  if (e.target.id === 'buff-note-modal') e.target.classList.remove('visible');
});

buffForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!buffForm.name.value.trim()) return;
  const editingId = buffForm.dataset.editingBuffId;
  if (editingId) {
    const buff = getBuffDataFromForm(parseInt(editingId, 10));
    const idx = appData.buffs.findIndex(b => b.id === buff.id);
    if (idx >= 0) appData.buffs[idx] = buff;
    const oldRow = buffPanelsEl.querySelector(`.buff-item[data-buff-id="${editingId}"]`);
    if (oldRow) oldRow.replaceWith(renderBuffRow(buff));
    refreshDamageIfOnCyclePage();
  } else {
    addBuffToPanel(getBuffDataFromForm());
  }
  buffModal.classList.remove('visible');
});
