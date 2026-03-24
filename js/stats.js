/**
 * 词条理论最优分配：在总词条价值不变下，将有效词条抽象为连续变量，求使循环总伤害最大的分配。
 * 仅考虑用户选择的有效词条；暴击伤害由剩余价值推导，不参与枚举。
 */

(function () {
  const MAX_GRID_PRODUCT = 1e5; /** grid_points^(有效数-1) 不超过此值 */
  const NUM_ITERATIONS = 2;

  /** 各词条类型的取值范围（纯圣遗物数值）：百分比 0~400%，精通 0~3000，暴击率 0~100% */
  function getStatRange(stat) {
    if (stat === 'hp_pct' || stat === 'atk_pct' || stat === 'def_pct') return [0, 400];
    if (stat === 'em') return [0, 3000];
    if (stat === 'cr') return [0, 100];
    if (stat === 'cd') return null;
    return [0, 400];
  }

  /** 当前有效词条列表（与圣遗物页一致，排除固定生攻防与充能）；cd 单独推导 */
  function getEffectiveSubstatList() {
    const allowed = typeof EFFECTIVE_SUBSTATS_ALLOWED !== 'undefined' ? EFFECTIVE_SUBSTATS_ALLOWED : [];
    const list = Array.isArray(appData.effectiveSubstats) && appData.effectiveSubstats.length > 0
      ? appData.effectiveSubstats.filter(v => allowed.some(a => a.value === v))
      : allowed.map(a => a.value);
    return list;
  }

  /** 参与枚举的词条（有效词条中去掉 cd） */
  function getEnumeratedStats() {
    return getEffectiveSubstatList().filter(s => s !== 'cd');
  }

  /** 用当前装备的主词条等构造 5 件圣遗物，第一件的副词条设为 allocation（{ stat: value }），其余副词条为空 */
  function buildArtifactsWithSubstats(allocation) {
    const equipped = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
    const base = (equipped || []).map(a => a ? JSON.parse(JSON.stringify(a)) : null);
    if (!base.length) return [];
    const subs = Object.entries(allocation || {}).filter(([, v]) => v != null && Number.isFinite(v) && v > 0).map(([stat, value]) => ({ stat, value }));
    base[0] = base[0] || {};
    base[0].substats = subs;
    for (let i = 1; i < base.length; i++) {
      if (base[i]) base[i].substats = [];
    }
    return base;
  }

  /** 分配对象的价值和 */
  function allocationValue(allocation) {
    let sum = 0;
    const price = typeof SUBSTAT_PRICE !== 'undefined' ? SUBSTAT_PRICE : {};
    for (const [stat, val] of Object.entries(allocation)) {
      if (price[stat] != null && Number.isFinite(val)) sum += val * price[stat];
    }
    return sum;
  }

  /** 由除 cd 外的分配与副词条总价值，反推 cd 数值；若非法返回 null */
  function deriveCd(allocNoCd, substatTotalValue) {
    const price = typeof SUBSTAT_PRICE !== 'undefined' ? SUBSTAT_PRICE : {};
    if (price.cd == null || price.cd <= 0) return null;
    const used = allocationValue(allocNoCd);
    const cdValue = substatTotalValue - used;
    if (cdValue < 0) return null;
    const cd = cdValue / price.cd;
    return cd;
  }

  /** 递归枚举：对 enumeratedStats 的每一维在 range 内等距取 grid 个点，最后一维循环内算 cd 并调用伤害 */
  function runGridSearch(substatTotalValue, ranges, gridPoints, enumeratedStats, bestRef) {
    const n = enumeratedStats.length;
    const price = typeof SUBSTAT_PRICE !== 'undefined' ? SUBSTAT_PRICE : {};
    if (price.cd == null) return;

    function recurse(dimIndex, alloc, pointsPerDim) {
      if (dimIndex === n) {
        const cd = deriveCd(alloc, substatTotalValue);
        if (cd == null || cd < 0) return;
        const full = { ...alloc, cd };
        const artifacts = buildArtifactsWithSubstats(full);
        const dmg = typeof getCycleTotalDamage === 'function' ? getCycleTotalDamage(artifacts) : 0;
        if (typeof dmg === 'number' && Number.isFinite(dmg) && (bestRef.bestDmg == null || dmg > bestRef.bestDmg)) {
          bestRef.bestDmg = dmg;
          bestRef.bestAlloc = { ...full };
        }
        return;
      }
      const stat = enumeratedStats[dimIndex];
      const [lo, hi] = ranges[stat] || [0, 400];
      const step = (hi - lo) / (pointsPerDim[dimIndex] - 1) || (hi - lo);
      for (let i = 0; i < pointsPerDim[dimIndex]; i++) {
        const v = pointsPerDim[dimIndex] === 1 ? lo : lo + (hi - lo) * i / (pointsPerDim[dimIndex] - 1);
        alloc[stat] = v;
        recurse(dimIndex + 1, alloc, pointsPerDim);
      }
    }

    const pointsPerDim = enumeratedStats.map(() => Math.max(2, gridPoints));
    recurse(0, {}, pointsPerDim);
  }

  /** 一次迭代：在给定 ranges 下做网格搜索，返回 { bestDmg, bestAlloc }，并更新 ranges 为以 best 为中心、宽度为两倍步长 */
  function oneIteration(substatTotalValue, ranges, gridPoints, enumeratedStats) {
    const bestRef = { bestDmg: null, bestAlloc: null };
    runGridSearch(substatTotalValue, ranges, gridPoints, enumeratedStats, bestRef);
    const nextRanges = {};
    if (bestRef.bestAlloc) {
      for (const stat of enumeratedStats) {
        const [lo, hi] = ranges[stat] || [0, 400];
        const numPoints = Math.max(2, gridPoints);
        const step = (hi - lo) / (numPoints - 1);
        const center = bestRef.bestAlloc[stat];
        const half = step;
        const rng = getStatRange(stat);
        const rLo = rng ? rng[0] : 0;
        const rHi = rng ? rng[1] : 400;
        nextRanges[stat] = [Math.max(rLo, center - half), Math.min(rHi, center + half)];
      }
    } else {
      for (const stat of enumeratedStats) nextRanges[stat] = ranges[stat] || [0, 400];
    }
    return { bestDmg: bestRef.bestDmg, bestAlloc: bestRef.bestAlloc, nextRanges };
  }

  function runOptimization() {
    const mainTotal = typeof getEquippedMainStatTotal === 'function' ? getEquippedMainStatTotal() : 0;
    const substatTotal = typeof getEquippedSubstatTotal === 'function' ? getEquippedSubstatTotal() : 0;
    const totalValue = (Number.isFinite(mainTotal) ? mainTotal : 0) + (Number.isFinite(substatTotal) ? substatTotal : 0);
    const enumerated = getEnumeratedStats();
    if (enumerated.length === 0) {
      return { totalValue, mainTotal, substatTotal, bestDmg: null, bestAlloc: null, message: '请先在圣遗物页选择有效词条（至少一个非暴击伤害词条）' };
    }
    if (!Number.isFinite(totalValue) || totalValue < 0) {
      return { totalValue, mainTotal, substatTotal, bestDmg: null, bestAlloc: null, message: '无法获取总词条价值，请确保已装备圣遗物' };
    }
    const baseArtifacts = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
    const baseDmg = typeof getCycleTotalDamage === 'function' ? getCycleTotalDamage(baseArtifacts) : null;
    const fixMain = isFixMainStats();
    const limit = getStatsLimitValue();
    const budget = fixMain ? Math.max(0, limit - mainTotal) : limit;
    let ranges = {};
    for (const stat of enumerated) {
      const r = getStatRange(stat);
      ranges[stat] = r ? [r[0], r[1]] : [0, 400];
    }
    let bestDmg = null;
    let bestAlloc = null;
    const nDim = enumerated.length;
    const grid = nDim <= 1 ? 2 : Math.max(2, Math.floor(Math.pow(MAX_GRID_PRODUCT, 1 / nDim)));
    for (let iter = 0; iter < NUM_ITERATIONS; iter++) {
      const result = oneIteration(budget, ranges, grid, enumerated);
      bestDmg = result.bestDmg;
      bestAlloc = result.bestAlloc;
      if (result.nextRanges && Object.keys(result.nextRanges).length) ranges = result.nextRanges;
    }
    return { totalValue, mainTotal, substatTotal, baseDmg, bestDmg, bestAlloc, message: null };
  }

  function formatAllocValue(stat, value) {
    if (value == null || !Number.isFinite(value)) return '—';
    const pct = ['hp_pct', 'atk_pct', 'def_pct', 'er', 'cr', 'cd'].indexOf(stat) >= 0;
    return pct ? (value.toFixed(2) + '%') : String(Math.round(value));
  }

  /** 是否「固定主词条」：true 表示主词条不参与价值优化，只优化副词条（但展示时总是加回主词条数值） */
  function isFixMainStats() {
    const cb = document.getElementById('stats-fix-main');
    return !cb || cb.checked;
  }

  /** 当前装备 5 件圣遗物在各有效词条上的数值之和（可选是否计入主词条） */
  function getCurrentStatTotals(includeMain) {
    const equipped = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
    const totals = {};
    const list = getEffectiveSubstatList();
    list.forEach(s => { totals[s] = 0; });
    (equipped || []).forEach((art, slotIdx) => {
      if (!art) return;
      // 副词条贡献
      if (Array.isArray(art.substats)) {
        art.substats.forEach(s => {
          if (s && s.stat && totals[s.stat] != null) {
            const v = parseFloat(s.value);
            totals[s.stat] += Number.isFinite(v) ? v : 0;
          }
        });
      }
      // 主词条贡献（按 effective stat 聚合）
      if (includeMain && art.mainStat) {
        const idx = (art.slotIndex != null) ? art.slotIndex : slotIdx;
        if (typeof getMainStatRangeKey === 'function' && typeof getMainStatValue === 'function') {
          let key = getMainStatRangeKey(art.mainStat, idx);
          if (key === 'flat_atk') key = 'atk';
          if (totals[key] != null) {
            const mainVal = getMainStatValue(art.mainStat, art.level ?? 20, idx);
            if (Number.isFinite(mainVal)) totals[key] += mainVal;
          }
        }
      }
    });
    return totals;
  }

  /** 优化时总词条价值限制：当前滑块值（用于优化预算） */
  let currentStatsLimitValue = null;

  /** 获取限制条范围与默认值：{ min, max, defaultVal }，max = 主词条总价值 + 45 */
  function getStatsLimitBounds() {
    const mainT = typeof getEquippedMainStatTotal === 'function' ? getEquippedMainStatTotal() : 0;
    const subT = typeof getEquippedSubstatTotal === 'function' ? getEquippedSubstatTotal() : 0;
    const total = (Number.isFinite(mainT) ? mainT : 0) + (Number.isFinite(subT) ? subT : 0);
    const min = 0;
    const max = (Number.isFinite(mainT) ? mainT : 0) + 45;
    return { min, max, defaultVal: total };
  }

  /** 获取当前优化时使用的总词条价值限制（滑块值，未设置时为默认） */
  function getStatsLimitValue() {
    const track = document.getElementById('stats-limit-track');
    if (track && Number.isFinite(track._statsLimitValue)) return track._statsLimitValue;
    const b = getStatsLimitBounds();
    return b.defaultVal;
  }

  /** 更新限制条 UI：范围、拇指位置、数值显示；可选 setValue 强制设为某值（如默认） */
  function updateStatsLimitUI(setValue) {
    const track = document.getElementById('stats-limit-track');
    const thumb = document.getElementById('stats-limit-thumb');
    const valueEl = document.getElementById('stats-limit-value');
    const maxLabel = document.getElementById('stats-limit-max-label');
    if (!track || !thumb || !valueEl) return;
    const b = getStatsLimitBounds();
    const max = b.max;
    if (setValue !== undefined) {
      currentStatsLimitValue = Math.max(b.min, Math.min(max, setValue));
    }
    if (currentStatsLimitValue == null || !Number.isFinite(currentStatsLimitValue)) {
      currentStatsLimitValue = Math.max(b.min, Math.min(max, b.defaultVal));
    }
    const val = Math.max(b.min, Math.min(max, currentStatsLimitValue));
    track._statsLimitValue = val;
    track._statsLimitMin = b.min;
    track._statsLimitMax = max;
    track._statsLimitDefault = b.defaultVal;
    track.setAttribute('aria-valuemin', b.min);
    track.setAttribute('aria-valuemax', max);
    track.setAttribute('aria-valuenow', val);
    const ratio = max > b.min ? (val - b.min) / (max - b.min) : 0;
    thumb.style.left = (ratio * 100).toFixed(2) + '%';
    valueEl.textContent = val.toFixed(2);
    if (maxLabel) maxLabel.textContent = max.toFixed(2);
  }

  function renderStatsTotalValue() {
    const el = document.getElementById('stats-total-value');
    if (!el) return;
    const mainT = typeof getEquippedMainStatTotal === 'function' ? getEquippedMainStatTotal() : 0;
    const subT = typeof getEquippedSubstatTotal === 'function' ? getEquippedSubstatTotal() : 0;
    const total = (Number.isFinite(mainT) ? mainT : 0) + (Number.isFinite(subT) ? subT : 0);
    el.textContent = Number.isFinite(total) ? total.toFixed(2) : '—';
    const subEl = document.getElementById('stats-substat-value');
    if (subEl) subEl.textContent = Number.isFinite(subT) ? subT.toFixed(2) : '—';
    const mainEl = document.getElementById('stats-main-value');
    if (mainEl) mainEl.textContent = Number.isFinite(mainT) ? mainT.toFixed(2) : '—';
    const b = getStatsLimitBounds();
    if (currentStatsLimitValue == null || currentStatsLimitValue > b.max || currentStatsLimitValue < b.min) {
      currentStatsLimitValue = Math.max(b.min, Math.min(b.max, b.defaultVal));
    }
    updateStatsLimitUI();
  }

  function renderResult(result) {
    const el = document.getElementById('stats-opt-result');
    if (!el) return;
    if (result.message) {
      const msg = (result.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      el.innerHTML = '<p class="stats-opt-status">' + msg + '</p>';
      return;
    }
    if (result.bestAlloc == null) {
      el.innerHTML = '<p>未得到有效分配（可能循环流程为空或总价值为 0）</p>';
      return;
    }
    const labelMap = typeof STAT_LABEL_MAP !== 'undefined' ? STAT_LABEL_MAP : {};
    const fixMain = isFixMainStats();
    const beforeAll = getCurrentStatTotals(true);
    const beforeSub = getCurrentStatTotals(false);
    const effectiveList = getEffectiveSubstatList();
    const esc = (s) => (s == null ? '' : String(s)).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = [];
    // 总伤害与提升
    const baseDmg = result.baseDmg;
    const bestDmg = result.bestDmg;
    lines.push('<p><strong>最大循环总伤害</strong>: ' + (Number.isFinite(bestDmg) ? Math.round(bestDmg).toLocaleString() : '—') + '</p>');
    if (Number.isFinite(baseDmg) && Number.isFinite(bestDmg)) {
      const delta = bestDmg - baseDmg;
      const pct = baseDmg > 0 ? (delta / baseDmg) * 100 : 0;
      const cls = delta >= 0 ? 'stats-opt-after-up' : 'stats-opt-after-down';
      const deltaStr = (delta >= 0 ? '+' : '') + Math.round(delta).toLocaleString();
      const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      lines.push(
        '<p class="stats-opt-dmg-line">原循环总伤害: ' +
        Math.round(baseDmg).toLocaleString() +
        '，<span class="' + cls + '">优化后: ' +
        Math.round(bestDmg).toLocaleString() +
        '（' + deltaStr + '，' + pctStr + '）</span></p>'
      );
    }
    lines.push('<table class="stats-opt-table"><thead><tr><th>圣遗物总词条</th><th>优化前</th><th>优化后</th></tr></thead><tbody>');
    for (const stat of effectiveList) {
      const all = beforeAll[stat] != null ? beforeAll[stat] : 0;
      const subOnly = beforeSub[stat] != null ? beforeSub[stat] : 0;
      const mainPart = all - subOnly;
      const beforeVal = all; // 优化前显示实际面板（主+副）
      const subAfter = result.bestAlloc[stat] != null ? result.bestAlloc[stat] : 0;
      // 固定主词条：主词条不参与优化，结果 = 主(固定) + 副(优化后)
      // 不固定主词条：主词条价值已经被合并进可变变量里，结果直接用优化后的变量值
      const afterVal = fixMain ? (mainPart + subAfter) : subAfter;
      const label = esc(labelMap[stat] || stat);
      const beforeStr = esc(formatAllocValue(stat, beforeVal));
      const afterStr = esc(formatAllocValue(stat, afterVal));
      const improved = afterVal != null && Number.isFinite(afterVal) && afterVal > beforeVal;
      const afterClass = improved ? 'stats-opt-after-up' : 'stats-opt-after-down';
      lines.push('<tr><td>' + label + '</td><td>' + beforeStr + '</td><td class="' + afterClass + '">' + afterStr + '</td></tr>');
    }
    lines.push('</tbody></table>');
    el.innerHTML = lines.join('');
  }

  function valueFromEvent(track, ev) {
    const rect = track.getBoundingClientRect();
    const clientX = ev.clientX != null ? ev.clientX : (ev.touches && ev.touches[0] ? ev.touches[0].clientX : 0);
    const x = clientX - rect.left;
    let ratio = rect.width > 0 ? x / rect.width : 0;
    ratio = Math.max(0, Math.min(1, ratio));
    const min = track._statsLimitMin != null ? track._statsLimitMin : 0;
    const max = track._statsLimitMax != null ? track._statsLimitMax : 45;
    return min + ratio * (max - min);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('stats-opt-calc-btn');
    const statusEl = document.getElementById('stats-opt-status');
    if (btn) {
      btn.addEventListener('click', function () {
        if (statusEl) statusEl.textContent = '计算中…';
        btn.disabled = true;
        setTimeout(function () {
          try {
            const result = runOptimization();
            renderResult(result);
            if (statusEl) statusEl.textContent = '完成';
          } catch (e) {
            if (statusEl) statusEl.textContent = '计算出错';
            document.getElementById('stats-opt-result').innerHTML = '<p>错误: ' + (e && e.message ? e.message : String(e)) + '</p>';
          }
          btn.disabled = false;
        }, 0);
      });
    }
    const track = document.getElementById('stats-limit-track');
    const resetBtn = document.getElementById('stats-limit-reset-btn');
    if (track) {
      function setValueFromEvent(ev) {
        const v = valueFromEvent(track, ev);
        currentStatsLimitValue = v;
        updateStatsLimitUI();
      }
      track.addEventListener('mousedown', function (ev) {
        if (ev.button !== 0) return;
        setValueFromEvent(ev);
        function onMove(e) {
          setValueFromEvent(e);
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      track.addEventListener('touchstart', function (ev) {
        if (ev.cancelable) ev.preventDefault();
        setValueFromEvent(ev);
        function onMove(e) {
          if (e.cancelable) e.preventDefault();
          setValueFromEvent(e);
        }
        function onEnd() {
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
        }
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
      }, { passive: false });
      track.addEventListener('keydown', function (ev) {
        const min = track._statsLimitMin != null ? track._statsLimitMin : 0;
        const max = track._statsLimitMax != null ? track._statsLimitMax : 45;
        const step = (max - min) * 0.05;
        let v = currentStatsLimitValue != null ? currentStatsLimitValue : track._statsLimitDefault;
        if (ev.key === 'ArrowLeft' || ev.key === 'Home') {
          ev.preventDefault();
          v = ev.key === 'Home' ? min : Math.max(min, v - step);
        } else if (ev.key === 'ArrowRight' || ev.key === 'End') {
          ev.preventDefault();
          v = ev.key === 'End' ? max : Math.min(max, v + step);
        } else return;
        currentStatsLimitValue = v;
        updateStatsLimitUI();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        const b = getStatsLimitBounds();
        currentStatsLimitValue = b.defaultVal;
        updateStatsLimitUI(b.defaultVal);
      });
    }
    const statsPage = document.getElementById('stats');
    if (statsPage) {
      const observer = new MutationObserver(function () {
        if (statsPage.classList.contains('active')) renderStatsTotalValue();
      });
      observer.observe(statsPage, { attributes: true, attributeFilter: ['class'] });
    }
    renderStatsTotalValue();
  });
})();
