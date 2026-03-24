/**
 * 启圣之尘使用优化：对选定圣遗物使用启圣之尘后的期望循环总伤害 E[max(原伤害, 修改后伤害)] 与提升概率。
 * 保底机制：重随时不会随机到与被替换词条相同的词条（新词条从其余 9 种中均匀随机）。
 */
function getDustOutcomes(artifact, lockedSubstats, minLockedRolls = 2) {
  if (!artifact || !Array.isArray(artifact.substats) || artifact.substats.length !== 4) return [];
  if (!artifact.maxRolls || artifact.maxRolls < 4 || artifact.maxRolls > 5) {
    console.warn('强制设定圣遗物最大强化次数改为5。')
    artifact.maxRolls = 5
  }
  if (!Array.isArray(lockedSubstats) || lockedSubstats.length !== 2) return [];
  if (minLockedRolls < 2 || minLockedRolls > 4) return [];

  // These globals or configs may come from the window scope
  const SUBSTAT_KEYS = typeof ARTIFACT_SUBSTATS !== 'undefined'
    ? ARTIFACT_SUBSTATS.map(s => s.value)
    : ['hp', 'atk', 'def', 'hp_pct', 'atk_pct', 'def_pct', 'em', 'er', 'cr', 'cd'];
  const TIERS = typeof SUBSTAT_ROLL_TIERS !== 'undefined' ? SUBSTAT_ROLL_TIERS : {};
  const LOCAL_SUBSTAT_ROLL_AVG = typeof SUBSTAT_ROLL_AVG !== 'undefined'
    ? SUBSTAT_ROLL_AVG
    : (() => {
      let avg = {};
      for (let key of SUBSTAT_KEYS) {
        avg[key] = Array.isArray(TIERS[key])
          ? TIERS[key].reduce((a, b) => a + b, 0) / TIERS[key].length
          : 0;
      }
      return avg;
    })();

  const maxRolls = artifact.maxRolls;
  const substat_types = [artifact.substats[0].stat, artifact.substats[1].stat, artifact.substats[2].stat, artifact.substats[3].stat];
  let locked_bool = [0, 0, 0, 0];
  for (const locked_stat of lockedSubstats) {
    locked_bool[locked_stat.index] = 1;
  }

  let roll_outcomes = []

  function contribute(prob, rolls) {
    const roll_counts = [0, 0, 0, 0]
    for (const roll of rolls)
      ++roll_counts[roll]
    const outcome = {
      'prob': prob,
      'roll_counts': roll_counts
    }
    roll_outcomes.push(outcome)
  }

  function LockRolls(curRoll = 0, rolls = [], prob = 1, hit = 0) {
    if (curRoll == maxRolls) {
      console.assert(hit == minLockedRolls, 'LockRolls中锁定数和实际不匹配。')
      contribute(prob, rolls)
    } else {
      for (let s = 0; s < 2; ++s) {
        const r = lockedSubstats[s].index
        rolls.push(r)
        LockRolls(curRoll + 1, rolls, prob * 0.5, hit + 1)
        rolls.pop()
      }
    }
  }

  function RandRolls(curRoll = 0, rolls = [], prob = 1, hit = 0) {
    if (curRoll == maxRolls) {
      console.assert(hit >= minLockedRolls, 'RandRolls的保底机制触发失败。')
      contribute(prob, rolls)
    } else if (maxRolls - curRoll == minLockedRolls - hit) {
      LockRolls(curRoll, rolls, prob, hit)
    } else {
      for (let r = 0; r < 4; ++r) {
        rolls.push(r)
        RandRolls(curRoll + 1, rolls, prob * 0.25, hit + locked_bool[r])
        rolls.pop()
      }
    }
  }

  RandRolls()

  let merged_outcomes_map = new Map();
  for (const outcome of roll_outcomes) {
    const key = outcome.roll_counts.join(',');
    if (merged_outcomes_map.has(key)) {
      merged_outcomes_map.get(key).prob += outcome.prob;
    } else {
      merged_outcomes_map.set(key, { ...outcome, roll_counts: outcome.roll_counts.slice() });
    }
  }
  roll_outcomes = Array.from(merged_outcomes_map.values());

  let tot_prob = 0.0
  for (const outcome of roll_outcomes)
    tot_prob += outcome.prob;
  console.assert(Math.abs(tot_prob - 1.0) <= 1e-6, '所有可能组合概率之和不为1。');

  const final_outcomes = []

  tot_prob = 0.0
  function buildOutcomeFromRollVals(roll_outcome, roll_val_list) {
    let outcome = {
      'prob': (0.25 ** maxRolls) * roll_outcome.prob,
      'artifact': buildModifiedArtifact(artifact, [
        { stat: substat_types[0], value: SUBSTAT_ROLL_AVG[substat_types[0]] },
        { stat: substat_types[1], value: SUBSTAT_ROLL_AVG[substat_types[1]] },
        { stat: substat_types[2], value: SUBSTAT_ROLL_AVG[substat_types[2]] },
        { stat: substat_types[3], value: SUBSTAT_ROLL_AVG[substat_types[3]] },
      ])
    };

    let cur_substat = 0
    let cur_roll_counts = [0, 0, 0, 0]
    for (let cur_roll = 0; cur_roll < maxRolls; ++cur_roll) {
      while (cur_substat < 4 && cur_roll_counts[cur_substat] == roll_outcome.roll_counts[cur_substat])
        ++cur_substat
      console.assert(cur_substat < 4, '强化次数超出范围。')
      outcome.artifact.substats[cur_substat].value += TIERS[substat_types[cur_substat]][roll_val_list[cur_roll]]
      ++cur_roll_counts[cur_substat]
    }
    return outcome;
  }

  for (const roll_outcome of roll_outcomes)
    for (let v0 = 0; v0 <= 3; ++v0)
      for (let v1 = 0; v1 <= 3; ++v1)
        for (let v2 = 0; v2 <= 3; ++v2)
          for (let v3 = 0; v3 <= 3; ++v3) {
            if (maxRolls == 5) {
              for (let v4 = 0; v4 <= 3; ++v4) {
                const roll_val_list = [v0, v1, v2, v3, v4]
                let outcome = buildOutcomeFromRollVals(roll_outcome, roll_val_list)
                tot_prob += outcome.prob
                final_outcomes.push(outcome)
              }
            } else {
              const roll_val_list = [v0, v1, v2, v3]
              let outcome = buildOutcomeFromRollVals(roll_outcome, roll_val_list)
              tot_prob += outcome.prob
              final_outcomes.push(outcome)
            }
          }
  console.assert(Math.abs(tot_prob - 1.0) <= 1e-6, '枚举强化词条大小后，概率之和不为1。')

  return final_outcomes;
}

/**
 * 根据给定的副词条数组生成「修改后」圣遗物对象。
 */
function buildModifiedArtifact(artifact, modifiedSubstats) {
  if (!artifact) return null;
  const baseSubs = Array.isArray(artifact.substats) ? artifact.substats : [];
  const mergedSubstats = (modifiedSubstats || []).map((mod, i) => {
    const base = baseSubs[i] || {};
    return { ...base, ...mod };
  });
  return {
    ...artifact,
    substats: mergedSubstats
  };
}

/**
 * 计算对指定部位圣遗物使用启圣之尘后的期望与提升概率。
 * @param {number} slotIdx - 部位索引 0..4
 * @param {Array} lockedSubstats - 锁定的副词条
 * @param {number} [minLockedRolls=2] - 最低锁定词条强化次数
 * @param {number} [maxTailProbThreshold=0] - 最大提升判定阈值
 * @param {object|null} [artifactOverride] - 若传入则对该圣遗物计算（否则使用该部位当前装备）
 */
function computeDustExpectation(slotIdx, lockedSubstats, minLockedRolls = 2, maxTailProbThreshold = 0, artifactOverride = null) {
  const equipped = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
  const artifact = (artifactOverride != null) ? artifactOverride : (equipped[slotIdx] || null);
  const baseTotal = typeof getCycleTotalDamage === 'function' ? getCycleTotalDamage(equipped) : 0;
  const ctx = {
    slotIdx,
    artifact,
    equipped,
    baseTotal,
    getCycleTotalDamage: (typeof getCycleTotalDamage === 'function' ? getCycleTotalDamage : null),
    getDustOutcomes,
    buildModifiedArtifact,
    lockedSubstats: Array.isArray(lockedSubstats) ? lockedSubstats : [],
    minLockedRolls: Math.max(2, Math.min(4, Number(minLockedRolls) || 2)),
    maxTailProbThreshold: Math.max(0, Number(maxTailProbThreshold) || 0)
  };
  return computeDustExpectationImpl(ctx);
}

/**
 * 启圣之尘期望提升的实现：枚举所有可能结果并计算期望与提升概率。
 * @param {Object} ctx - 上下文，含 artifact、equipped、getDustOutcomes 等
 */
function computeDustExpectationImpl(ctx) {
  if (!ctx.getDustOutcomes || !ctx.buildModifiedArtifact || !ctx.getCycleTotalDamage) {
    return {
      originalTotal: 0,
      expectedMaxTotal: 0,
      maxTotal: 0,
      probImprove: 0,
      outcomeCount: 0
    };
  }
  const outcomes = ctx.getDustOutcomes(ctx.artifact, ctx.lockedSubstats, ctx.minLockedRolls);
  const equipped = ctx.equipped ? ctx.equipped.slice() : [];
  let orig_dmg = ctx.baseTotal;
  if (typeof ctx.slotIdx === 'number' && equipped[ctx.slotIdx])
    equipped[ctx.slotIdx] = ctx.artifact;
  if (ctx.getCycleTotalDamage) {
    orig_dmg = ctx.getCycleTotalDamage(equipped);
  }

  let prob_improve = 0.0, exp_dmg = 0.0, max_dmg = orig_dmg;
  let improvedOutcomes = [];
  for (const outcome of outcomes) {
    // Replace this slot with the outcome
    let artifacts2 = equipped.slice();
    if (typeof ctx.slotIdx === 'number' && ctx.slotIdx >= 0 && ctx.slotIdx < artifacts2.length)
      artifacts2[ctx.slotIdx] = outcome.artifact;
    let cur_dmg = ctx.getCycleTotalDamage ? ctx.getCycleTotalDamage(artifacts2) : 0;
    exp_dmg += outcome.prob * Math.max(cur_dmg, orig_dmg);
    if (cur_dmg > orig_dmg) {
      prob_improve += outcome.prob;
      improvedOutcomes.push({ prob: outcome.prob, dmg: cur_dmg });
    }
  }
  // 最大提升阈值
  const tailThresholdRaw = Math.max(0, Math.min(1, Number(ctx.maxTailProbThreshold) || 0));
  const totalImproveProb = improvedOutcomes.reduce((s, o) => s + o.prob, 0);
  if (totalImproveProb <= 0) {
    max_dmg = orig_dmg;
  } else {
    const effThreshold = Math.min(tailThresholdRaw, totalImproveProb);
    const sorted = improvedOutcomes.slice().sort((a, b) => b.dmg - a.dmg);
    let cumProb = 0.0;
    max_dmg = orig_dmg;
    for (const item of sorted) {
      cumProb += item.prob;
      if (cumProb + 1e-12 >= effThreshold) {
        max_dmg = item.dmg;
        break;
      }
    }
  }

  return {
    originalTotal: orig_dmg,
    expectedMaxTotal: exp_dmg,
    maxTotal: max_dmg,
    probImprove: prob_improve,
    outcomeCount: outcomes.length
  };
}

function renderDustArtifactOptions() {
  const sel = document.getElementById('dust-artifact-select');
  if (!sel) return;
  const eq = (typeof appData !== 'undefined' && appData.equippedArtifacts) ? appData.equippedArtifacts : { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  const slotNames = typeof ARTIFACT_SLOTS !== 'undefined' ? ARTIFACT_SLOTS : ['生之花', '死之羽', '时之沙', '空之杯', '理之冠'];
  const prev = sel.value === '' ? '' : sel.value;
  const options = ['<option value="">— 请选择 —</option>'];
  for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
    const list = (typeof appData !== 'undefined' && appData.artifacts && appData.artifacts[slotIdx]) ? appData.artifacts[slotIdx] : [];
    const equippedCell = eq[slotIdx] ?? 0;
    const slotName = slotNames[slotIdx] || `部位${slotIdx}`;
    list.forEach((art, cellIdx) => {
      if (!art) return;
      const name = (art.name || '').trim() || '（未命名）';
      const suffix = (cellIdx === equippedCell) ? '（已装备）' : '';
      const value = `${slotIdx}-${cellIdx}`;
      options.push(`<option value="${escapeHtml(value)}">${escapeHtml(slotName + '：' + name + suffix)}</option>`);
    });
  }
  sel.innerHTML = options.join('');
  if (prev !== '' && sel.querySelector(`option[value="${prev}"]`)) {
    sel.value = prev;
  } else {
    sel.value = '';
  }
  const listEl = document.getElementById('dust-substats-list');
  if (listEl) listEl.innerHTML = '';
  if (sel.value !== '') {
    sel.dispatchEvent(new Event('change'));
  }
}

function runDustCalc() {
  const sel = document.getElementById('dust-artifact-select');
  const raw = sel && sel.value ? sel.value : '';
  const parts = raw.indexOf('-') >= 0 ? raw.split('-') : [];
  const slotIdx = parts.length === 2 ? parseInt(parts[0], 10) : -1;
  const cellIdx = parts.length === 2 ? parseInt(parts[1], 10) : -1;
  const list = (typeof appData !== 'undefined' && appData.artifacts && appData.artifacts[slotIdx]) ? appData.artifacts[slotIdx] : [];
  const art = (slotIdx >= 0 && slotIdx <= 4 && cellIdx >= 0 && list[cellIdx]) ? list[cellIdx] : null;
  const originalEl = document.getElementById('dust-original-total');
  const expectedEl = document.getElementById('dust-expected-max');
  const probEl = document.getElementById('dust-prob-improve');
  const maxDeltaEl = document.getElementById('dust-max-delta');
  if (!art || slotIdx < 0 || slotIdx > 4) {
    if (originalEl) originalEl.textContent = '—';
    if (expectedEl) expectedEl.textContent = '—';
    if (probEl) probEl.textContent = '—';
    if (maxDeltaEl) maxDeltaEl.textContent = '—';
    return;
  }
  const locksContainer = document.getElementById('dust-substats-list');
  const lockCbs = locksContainer ? locksContainer.querySelectorAll('.dust-lock-cb:checked') : [];
  const locked = Array.from(lockCbs || []);
  if (locked.length !== 2) {
    if (originalEl) originalEl.textContent = '—';
    if (expectedEl) expectedEl.textContent = '—';
    if (probEl) probEl.textContent = '—';
    if (maxDeltaEl) maxDeltaEl.textContent = '—';
    return;
  }
  const lockedSubstats = locked.map(cb => ({
    index: parseInt(cb.value, 10),
    stat: cb.dataset.stat
  }));
  const minRollSel = document.getElementById('dust-min-lock-rolls');
  const minLockedRolls = minRollSel ? (parseInt(minRollSel.value, 10) || 2) : 2;
  const maxThrInput = document.getElementById('dust-max-threshold');
  const maxTailProbThreshold = maxThrInput ? (Number(maxThrInput.value) || 0) / 100 : 0;
  const result = computeDustExpectation(slotIdx, lockedSubstats, minLockedRolls, maxTailProbThreshold, art);
  const isPlaceholder = !result
    || (result.originalTotal === 0 && result.expectedMaxTotal === 0 && result.probImprove === 0 && result.outcomeCount === 0);
  if (isPlaceholder) {
    if (originalEl) originalEl.textContent = '—';
    if (expectedEl) expectedEl.textContent = '—';
    if (probEl) probEl.textContent = '—';
    if (maxDeltaEl) maxDeltaEl.textContent = '—';
    return;
  }
  if (originalEl) originalEl.textContent = formatNumber(result.originalTotal);
  if (expectedEl) {
    const totalStr = formatNumber(result.expectedMaxTotal);
    const delta = result.expectedMaxTotal - result.originalTotal;
    const pct = result.originalTotal > 0 ? (delta / result.originalTotal) * 100 : 0;
    expectedEl.textContent = `${totalStr}（${delta >= 0 ? '+' : ''}${formatNumber(delta)}，${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`;
  }
  if (probEl) probEl.textContent = (result.probImprove * 100).toFixed(2) + '%';
  if (maxDeltaEl) {
    const maxTotal = typeof result.maxTotal === 'number' ? result.maxTotal : result.expectedMaxTotal;
    const maxDelta = maxTotal - result.originalTotal;
    const maxPct = result.originalTotal > 0 ? (maxDelta / result.originalTotal) * 100 : 0;
    maxDeltaEl.textContent = `${maxDelta >= 0 ? '+' : ''}${formatNumber(maxDelta)}（${maxPct >= 0 ? '+' : ''}${maxPct.toFixed(2)}%）`;
  }
}

function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString();
}

function resetDustResult() {
  const originalEl = document.getElementById('dust-original-total');
  const expectedEl = document.getElementById('dust-expected-max');
  const probEl = document.getElementById('dust-prob-improve');
  const maxDeltaEl = document.getElementById('dust-max-delta');
  if (originalEl) originalEl.textContent = '—';
  if (expectedEl) expectedEl.textContent = '—';
  if (probEl) probEl.textContent = '—';
  if (maxDeltaEl) maxDeltaEl.textContent = '—';
}

document.addEventListener('DOMContentLoaded', () => {
  renderDustArtifactOptions();
  const sel = document.getElementById('dust-artifact-select');
  if (sel) {
    sel.addEventListener('change', () => {
      const listEl = document.getElementById('dust-substats-list');
      if (!listEl) return;
      listEl.innerHTML = '';
      resetDustResult();
      const raw = sel.value !== '' ? sel.value : '';
      const parts = raw.indexOf('-') >= 0 ? raw.split('-') : [];
      const slotIdx = parts.length === 2 ? parseInt(parts[0], 10) : -1;
      const cellIdx = parts.length === 2 ? parseInt(parts[1], 10) : -1;
      const list = (typeof appData !== 'undefined' && appData.artifacts && appData.artifacts[slotIdx]) ? appData.artifacts[slotIdx] : [];
      const art = (slotIdx >= 0 && slotIdx <= 4 && cellIdx >= 0 && list[cellIdx]) ? list[cellIdx] : null;
      if (!art || !Array.isArray(art.substats)) return;
      const subRows = (art.substats || []).map((s, i) => {
        if (!s || !s.stat) return '';
        const labelMap = (typeof STAT_LABEL_MAP !== 'undefined') ? STAT_LABEL_MAP : null;
        const label = labelMap && labelMap[s.stat] ? labelMap[s.stat] : s.stat;
        const valStr = s.value != null ? String(s.value) : '';
        return `<div class="artifact-cell-sub-row">
      <input type="checkbox" class="dust-lock-cb" value="${i}" data-stat="${escapeHtml(s.stat)}">
      <span>${escapeHtml(label)}: ${escapeHtml(valStr)}</span>
    </div>`;
      }).join('');
      const mainLabel = (typeof STAT_LABEL_MAP !== 'undefined' && STAT_LABEL_MAP[art.mainStat]) || art.mainStat;
      const mainVal = typeof formatMainStatDisplay === 'function'
        ? formatMainStatDisplay(art.mainStat, art.level ?? 20, slotIdx)
        : '';
      listEl.innerHTML = `
      <div class="artifact-cell">
        <div class="artifact-cell-content">
          <div class="artifact-cell-name-wrap">
            <span class="artifact-cell-name">${escapeHtml(art.name || '（未命名）')}</span>
          </div>
          <div class="artifact-cell-level">强化 +${parseInt(art.level, 10) || 0}</div>
          <div class="artifact-cell-main">${escapeHtml(mainLabel)} ${escapeHtml(mainVal)}</div>
          <div class="artifact-cell-subs">
            ${subRows || '<span>（无副词条）</span>'}
          </div>
        </div>
      </div>`;
      const cbs = listEl.querySelectorAll('.dust-lock-cb');
      cbs.forEach(cb => {
        cb.addEventListener('change', function () {
          const checked = listEl.querySelectorAll('.dust-lock-cb:checked');
          if (checked.length > 2) {
            this.checked = false;
          }
          // 锁定词条变化后，清空当前显示的启圣提升结果，避免显示过期数据
          resetDustResult();
        });
      });
    });
  }
  document.getElementById('dust-calc-btn')?.addEventListener('click', () => {
    runDustCalc();
  });

  const dustAutoBtn = document.getElementById('dust-auto-btn');
  const dustAutoModal = document.getElementById('dust-auto-modal');
  const dustAutoLoadingModal = document.getElementById('dust-auto-loading-modal');
  const dustAutoResult = document.getElementById('dust-auto-result');
  const dustAutoClose = document.getElementById('dust-auto-close');

  if (dustAutoBtn && dustAutoModal && dustAutoResult && dustAutoLoadingModal && dustAutoClose) {
    dustAutoBtn.addEventListener('click', () => {
      // 显示“计算中...”窗口，并在下一帧开始同步计算
      dustAutoLoadingModal.classList.add('visible');
      dustAutoResult.textContent = '';
      setTimeout(() => {
        const minSel = document.getElementById('dust-min-lock-rolls');
        const minLockedRolls = minSel ? Math.max(2, Math.min(4, parseInt(minSel.value, 10) || 2)) : 2;
        const summary = runDustAutoOptimize(minLockedRolls);
        dustAutoLoadingModal.classList.remove('visible');
        dustAutoResult.textContent = summary;
        dustAutoModal.classList.add('visible');
      }, 0);
    });

    dustAutoClose.addEventListener('click', () => {
      dustAutoModal.classList.remove('visible');
    });

    dustAutoModal.addEventListener('click', (e) => {
      if (e.target.id === 'dust-auto-modal') dustAutoModal.classList.remove('visible');
    });
  }

  const maxThrHelpTrigger = document.getElementById('dust-max-threshold-help-trigger');
  const maxThrHelpModal = document.getElementById('dust-max-threshold-help-modal');
  const maxThrHelpClose = document.getElementById('dust-max-threshold-help-close');
  if (maxThrHelpTrigger && maxThrHelpModal) {
    maxThrHelpTrigger.addEventListener('click', () => {
      maxThrHelpModal.classList.add('visible');
    });
    maxThrHelpClose?.addEventListener('click', () => {
      maxThrHelpModal.classList.remove('visible');
    });
    maxThrHelpModal.addEventListener('click', (e) => {
      if (e.target.id === 'dust-max-threshold-help-modal') {
        maxThrHelpModal.classList.remove('visible');
      }
    });
  }
});

window.renderDustArtifactOptions = renderDustArtifactOptions;
/**
 * 对一件圣遗物使用启圣之尘的所有可能结果生成器（不含任何伤害计算）。
 */
window.getDustOutcomes = getDustOutcomes;
/**
 * 当前内置的期望计算实现（见上方 JSDoc），你可以忽略不用，只当作一个参考实现。
 */
window.computeDustExpectation = computeDustExpectation;

function runDustAutoOptimize(minLockedRolls) {
  if (typeof getEquippedArtifacts !== 'function' || typeof computeDustExpectation !== 'function') {
    return '当前环境不支持启圣之尘自动锁定。';
  }
  const equipped = getEquippedArtifacts() || [];
  const slotNames = typeof ARTIFACT_SLOTS !== 'undefined'
    ? ARTIFACT_SLOTS
    : ['生之花', '死之羽', '时之沙', '空之杯', '理之冠'];

  let globalBestExpected = null;
  let globalBestMax = null;

  for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
    const art = equipped[slotIdx];
    if (!art || !Array.isArray(art.substats) || art.substats.length !== 4) continue;
    if (!(art.maxRolls === 4 || art.maxRolls === 5)) continue;

    const subs = art.substats.map((s, i) => ({ index: i, stat: s?.stat })).filter(s => s.stat);
    if (subs.length < 2) continue;

    let bestForSlotExpected = null;
    let bestForSlotMax = null;
    for (let i = 0; i < subs.length; i++) {
      for (let j = i + 1; j < subs.length; j++) {
        const locked = [subs[i], subs[j]];
        const maxThrInput = document.getElementById('dust-max-threshold');
        const maxTailProbThreshold = maxThrInput ? (Number(maxThrInput.value) || 0) / 100 : 0;
        const res = computeDustExpectation(slotIdx, locked, minLockedRolls, maxTailProbThreshold);
        if (!res || !Number.isFinite(res.originalTotal) || !Number.isFinite(res.expectedMaxTotal)) continue;
        const deltaExpected = res.expectedMaxTotal - res.originalTotal;
        const maxTotal = typeof res.maxTotal === 'number' ? res.maxTotal : res.expectedMaxTotal;
        const deltaMax = maxTotal - res.originalTotal;
        const baseEntry = {
          slotIdx,
          locked,
          res,
          deltaExpected,
          deltaMax
        };
        if (!bestForSlotExpected || deltaExpected > bestForSlotExpected.deltaExpected) {
          bestForSlotExpected = baseEntry;
        }
        if (!bestForSlotMax || deltaMax > bestForSlotMax.deltaMax) {
          bestForSlotMax = baseEntry;
        }
      }
    }

    if (bestForSlotExpected) {
      if (!globalBestExpected || bestForSlotExpected.deltaExpected > globalBestExpected.deltaExpected) {
        globalBestExpected = bestForSlotExpected;
      }
    }
    if (bestForSlotMax) {
      if (!globalBestMax || bestForSlotMax.deltaMax > globalBestMax.deltaMax) {
        globalBestMax = bestForSlotMax;
      }
    }
  }

  if (!globalBestExpected && !globalBestMax) {
    return '当前装备的圣遗物无法进行有效的启圣之尘优化（可能缺少 4 副词条或最大强化次数信息）。';
  }

  const lines = [];
  lines.push(`最低锁定词条强化次数：${minLockedRolls} 次`);
  lines.push('');

  if (globalBestExpected) {
    const { slotIdx, locked, res, deltaExpected } = globalBestExpected;
    const pct = res.originalTotal > 0 ? (deltaExpected / res.originalTotal) * 100 : 0;
    const slotName = slotNames[slotIdx] || `部位${slotIdx}`;
    lines.push(`【期望提升最高的配置】出现在【${slotName}】`);
    lines.push(`锁定副词条：${locked.map(s => {
      const labelMap = (typeof STAT_LABEL_MAP !== 'undefined') ? STAT_LABEL_MAP : null;
      const label = labelMap && labelMap[s.stat] ? labelMap[s.stat] : s.stat;
      return label;
    }).join(' + ')}`);
    lines.push(`原循环总伤害：${res.originalTotal.toFixed(0)}`);
    lines.push(`期望循环总伤害：${res.expectedMaxTotal.toFixed(0)}`);
    lines.push(`期望提升：${deltaExpected >= 0 ? '+' : ''}${deltaExpected.toFixed(0)}（${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`);
    lines.push(`提升概率：${(res.probImprove * 100).toFixed(2)}%`);
    lines.push('');

    // 将「期望最高」这组配置同步回主启圣界面
    const sel = document.getElementById('dust-artifact-select');
    const eq = (typeof appData !== 'undefined' && appData.equippedArtifacts) ? appData.equippedArtifacts : {};
    const cellIdx = eq[slotIdx] ?? 0;
    if (sel) {
      sel.value = `${slotIdx}-${cellIdx}`;
      sel.dispatchEvent(new Event('change'));
    }
    const mainMinSel = document.getElementById('dust-min-lock-rolls');
    if (mainMinSel) {
      mainMinSel.value = String(minLockedRolls);
    }
    setTimeout(() => {
      const listEl = document.getElementById('dust-substats-list');
      if (!listEl) return;
      const cbs = listEl.querySelectorAll('.dust-lock-cb');
      const targetIdxSet = new Set(locked.map(s => String(s.index)));
      cbs.forEach(cb => {
        cb.checked = targetIdxSet.has(cb.value);
      });
      resetDustResult();
    }, 0);
  }

  if (globalBestMax) {
    const { slotIdx, locked, res, deltaMax } = globalBestMax;
    const maxTotal = typeof res.maxTotal === 'number' ? res.maxTotal : res.expectedMaxTotal;
    const pct = res.originalTotal > 0 ? (deltaMax / res.originalTotal) * 100 : 0;
    const slotName = slotNames[slotIdx] || `部位${slotIdx}`;
    lines.push(`【最大提升最高的配置】出现在【${slotName}】`);
    lines.push(`锁定副词条：${locked.map(s => {
      const labelMap = (typeof STAT_LABEL_MAP !== 'undefined') ? STAT_LABEL_MAP : null;
      const label = labelMap && labelMap[s.stat] ? labelMap[s.stat] : s.stat;
      return label;
    }).join(' + ')}`);
    lines.push(`原循环总伤害：${res.originalTotal.toFixed(0)}`);
    lines.push(`最大循环总伤害：${maxTotal.toFixed(0)}`);
    lines.push(`最大提升：${deltaMax >= 0 ? '+' : ''}${deltaMax.toFixed(0)}（${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`);
  }

  return lines.join('\n');
}
