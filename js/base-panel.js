function syncBasePanelToData() {
  appData.basePanel = {
    charLevel: document.getElementById('base-charLevel').value,
    monsterLevel: document.getElementById('base-monsterLevel').value,
    hp: document.getElementById('base-hp').value,
    atk: document.getElementById('base-atk').value,
    def: document.getElementById('base-def').value,
    em: document.getElementById('base-em').value,
    er: document.getElementById('base-er').value,
    critRate: document.getElementById('base-critRate')?.value ?? '',
    critDmg: document.getElementById('base-critDmg')?.value ?? '',
    ...Object.fromEntries(BASE_RESIST_IDS.map(id => [id, document.getElementById('base-' + id)?.value ?? '']))
  };
  refreshDamageIfOnCyclePage();
}

function syncDataToBasePanel() {
  const d = appData.basePanel;
  document.getElementById('base-charLevel').value = d.charLevel ?? '';
  document.getElementById('base-monsterLevel').value = d.monsterLevel ?? '';
  document.getElementById('base-hp').value = d.hp;
  document.getElementById('base-atk').value = d.atk;
  document.getElementById('base-def').value = d.def;
  document.getElementById('base-em').value = d.em ?? '';
  document.getElementById('base-er').value = d.er ?? '';
  const critRateEl = document.getElementById('base-critRate');
  const critDmgEl = document.getElementById('base-critDmg');
  if (critRateEl) critRateEl.value = d.critRate ?? '';
  if (critDmgEl) critDmgEl.value = d.critDmg ?? '';
  BASE_RESIST_IDS.forEach(id => {
    const el = document.getElementById('base-' + id);
    if (el) el.value = d[id] ?? '';
  });
}

['base-charLevel', 'base-monsterLevel', 'base-hp', 'base-atk', 'base-def', 'base-em', 'base-er', 'base-critRate', 'base-critDmg', ...BASE_RESIST_IDS.map(id => 'base-' + id)].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', syncBasePanelToData);
    el.addEventListener('change', syncBasePanelToData);
  }
});
