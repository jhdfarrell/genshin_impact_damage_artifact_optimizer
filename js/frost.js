(function () {
  /**
   * 祝圣之霜使用优化：对选定圣遗物使用祝圣之霜后的期望循环总伤害 E[max(原伤害, 修改后伤害)] 与最大值等统计。
   */

  function assertProbSumOne(arr, label) {
    const sum = arr.reduce((s, o) => s + (Number(o.prob) || 0), 0);
    console.assert(Math.abs(sum - 1) <= 1e-6, `${label}: 概率和应为 1，实际为 ${sum}`);
  }

  /**
   * 【主接口】列举对一件圣遗物使用祝圣之霜后的所有可能结果。
   *
   * 约定（结合 UI 与你的说明）：
   * - 起点是「设定的主词条 + 固定副词条」，而不是原始圣遗物实际当前数值；
   * - 霜产出的一定是「4 副词条、5 次强化」的 5★ 圣遗物；
   * - 固定副词条 fixedSubstats（0~2 条）在结果中必须出现，且它们被命中的强化次数总和 ≥ minLockedRolls；
   * - 其余 2 条副词条按照「主词条给定时的首条副词条概率表」抽样，
   *   如果已有部分词条已确定，则从概率中剔除这些词条并重新归一化；
   * - 每一次强化命中 4 条副词条之一，概率均等 1/4，强化档位按 SUBSTAT_ROLL_TIERS 精确枚举。
   *
   * 函数签名：
   *   getFrostOutcomes(artifact: Object, options?: {
   *     mainStat?: string,                 // 目标主词条；如果缺失则使用 artifact.mainStat
   *     fixedSubstats?: { index: number, stat: string }[], // 固定副词条（UI 只传 stat 即可，index 在这里不再使用）
   *     minLockedRolls?: number            // 固定副词条命中次数之和的下限（可选，默认 0）
   *   }) => Outcome[]
   */
  function getFrostOutcomes(artifact, options) {
    if (!artifact) return [];
    if (typeof getDustOutcomes !== 'function') {
      console.warn('getDustOutcomes 未定义：祝圣之霜退回占位实现。');
      return [{ prob: 1.0, artifact }];
    }

    const opts = options || {};
    const slotIdx = typeof artifact.slotIndex === 'number' ? artifact.slotIndex : 0;
    const mainStat = opts.mainStat || artifact.mainStat;
    if (!mainStat) return [];

    const TOTAL_SUBSTAT_SLOTS = 4;

    // 固定副词条（只看 stat，按顺序去重，最多 2 条）
    const fixedStatsRaw = Array.isArray(opts.fixedSubstats) ? opts.fixedSubstats : [];
    const fixedStatKeys = [];
    const seen = new Set();
    for (const fs of fixedStatsRaw) {
      if (!fs || !fs.stat) continue;
      if (seen.has(fs.stat)) continue;
      fixedStatKeys.push(fs.stat);
      seen.add(fs.stat);
      if (fixedStatKeys.length >= 2) break;
    }

    const minLockedRollsRaw = Number(opts.minLockedRolls || 0);
    const minLockedRolls = Math.max(0, minLockedRollsRaw);

    // 1) 只决定「4 副词条种类组合」及其概率
    const substatTypeOutcomes = getFrostSubstatTypeOutcomes(mainStat, slotIdx, fixedStatKeys, TOTAL_SUBSTAT_SLOTS);
    const finalOutcomes = [];

    for (const typeOutcome of substatTypeOutcomes) {
      const subTypes = typeOutcome.substats;

      // 基础圣遗物胚子：固定 20 级、5 次强化
      const baseArtifact = {
        slotIndex: slotIdx,
        name: artifact.name || '祝圣之霜圣遗物',
        setId: artifact.setId != null ? artifact.setId : null,
        mainStat,
        level: 20,
        maxRolls: 5,
        substats: subTypes.map(stat => ({
          stat,
          value: (typeof SUBSTAT_ROLL_AVG !== 'undefined' && SUBSTAT_ROLL_AVG[stat]) || 0
        }))
      };

      // 映射为 dust.js 需要的 lockedSubstats（索引 + stat）
      const lockedSubstats = [];
      for (const stat of fixedStatKeys) {
        const idx = subTypes.indexOf(stat);
        if (idx === -1) continue; // 该组合不含这个固定词条，跳过
        lockedSubstats.push({ index: idx, stat });
      }

      let dustLocked = lockedSubstats;
      let dustMinLockedRolls = minLockedRolls;
      const dustOutcomes = getDustOutcomes(baseArtifact, dustLocked, dustMinLockedRolls) || [];
      if (!Array.isArray(dustOutcomes) || dustOutcomes.length === 0) continue;

      for (const d of dustOutcomes) {
        if (!d || typeof d.prob !== 'number' || !d.artifact) continue;
        const p = typeOutcome.prob * d.prob;
        if (!(p > 0)) continue;
        finalOutcomes.push({ prob: p, artifact: d.artifact });
      }
    }

    assertProbSumOne(finalOutcomes, 'getFrostOutcomes(final)');
    return finalOutcomes;
  }

  /**
   * 祝圣之霜用的「首条副词条概率」基表（不考虑主词条冲突与已确定副词条）
   * - 数值取自常见统计表（近似），单位为「权重」，稍后会按需要归一化为概率。
   */
  const FROST_FIRST_SUBSTAT_BASE_WEIGHTS = {
    hp: 15.79,
    def: 15.79,
    atk: 15.79,
    hp_pct: 10.53,
    def_pct: 10.53,
    atk_pct: 10.53,
    er: 10.53,
    em: 10.53,
    cr: 7.89,
    cd: 7.89
  };

  /**
   * 根据主词条 + 已固定副词条，用递归枚举所有「4 副词条种类组合」及其概率。
   * - 每一步平等对待当前允许的副词条，按权重随机出一个；
   * - 抽出后从概率中剔除该词条，剩余归一化，再递归抽下一个；
   * - 全部抽完后按固定顺序排列 4 个副词条，合并相同组合并概率求和；
   * - 不对手法归一化，仅结尾 assert 概率和为 1。
   */
  function getFrostSubstatTypeOutcomes(mainStat, slotIdx, fixedStatKeys, totalSlots) {
    const allSubKeys = Object.keys(FROST_FIRST_SUBSTAT_BASE_WEIGHTS);

    function isConflictWithMain(statKey) {
      if (mainStat === 'hp') {
        if (slotIdx === 0 && statKey === 'hp') return true;
        if (slotIdx !== 0 && statKey === 'hp_pct') return true;
      }
      if (mainStat === 'flat_atk' && statKey === 'atk') return true;
      if (mainStat === 'atk' && statKey === 'atk_pct') return true;
      if (mainStat === 'def' && statKey === 'def_pct') return true;
      if (mainStat === 'em' && statKey === 'em') return true;
      if (mainStat === 'er' && statKey === 'er') return true;
      if (mainStat === 'cr' && statKey === 'cr') return true;
      if (mainStat === 'cd' && statKey === 'cd') return true;
      return false;
    }

    // 初始权重：不与主词条冲突的副词条（含固定词条），权重来自基表
    const initialWeights = {};
    for (const key of allSubKeys) {
      if (isConflictWithMain(key)) continue;
      const w = FROST_FIRST_SUBSTAT_BASE_WEIGHTS[key] || 0;
      if (w > 0) initialWeights[key] = w;
    }
    const initialSum = Object.values(initialWeights).reduce((a, b) => a + b, 0);
    if (!(initialSum > 0)) return [];

    const rawOutcomes = [];

    function recurse(depth, chosen, prob, remainingWeights) {
      if (depth === totalSlots) {
        const needFixed = fixedStatKeys.filter(f => !chosen.includes(f));
        if (needFixed.length > 0) return; // 未包含全部固定词条，丢弃
        const substats = chosen.slice().sort(); // 按字母序排列，便于合并
        rawOutcomes.push({ prob, substats });
        return;
      }

      const needFixed = fixedStatKeys.filter(f => !chosen.includes(f));
      const remainingPicks = totalSlots - depth;
      if (needFixed.length > remainingPicks) return;

      let allowed;
      if (needFixed.length === remainingPicks && needFixed.length > 0) {
        allowed = needFixed.filter(s => remainingWeights[s] != null && remainingWeights[s] > 0);
      } else {
        allowed = Object.keys(remainingWeights).filter(s => (remainingWeights[s] || 0) > 0);
      }
      if (allowed.length === 0) return;

      const sum = allowed.reduce((s, k) => s + (remainingWeights[k] || 0), 0);
      if (!(sum > 0)) return;

      for (const stat of allowed) {
        const pickProb = (remainingWeights[stat] || 0) / sum;
        const newChosen = chosen.concat(stat);
        const newWeights = { ...remainingWeights };
        delete newWeights[stat];
        recurse(depth + 1, newChosen, prob * pickProb, newWeights);
      }
    }

    recurse(0, [], 1.0, { ...initialWeights });

    // 合并相同 4 副词条组合，概率求和
    const merged = new Map();
    for (const o of rawOutcomes) {
      const key = o.substats.join(',');
      const prev = merged.get(key);
      if (prev) prev.prob += o.prob;
      else merged.set(key, { prob: o.prob, substats: o.substats });
    }
    const result = Array.from(merged.values());
    assertProbSumOne(result, 'getFrostSubstatTypeOutcomes');
    return result;
  }

  /**
   * 枚举 5 次强化的「命中分布」：
   * - 共有 4 条副词条（索引 0~3），每次命中其中之一，概率均等 1/4；
   * - 累计 5 次后，统计每条副词条被命中的次数 rollCounts[4]；
   * - 固定副词条的索引由 fixedStatKeys 在 subTypes 中的位置决定，
   *   且所有固定副词条命中次数之和需 ≥ minLockedRolls。
   * - 为减少结果数，按 rollCounts 进行一次合并。
   */
  function getFrostRollPatternOutcomes(substatSlotCount, maxRolls, fixedStatKeys, minLockedRolls) {
    const outcomes = [];

    function dfs(curRoll, counts, prob, lockedHits) {
      if (curRoll === maxRolls) {
        if (lockedHits >= minLockedRolls) {
          outcomes.push({
            prob,
            rollCounts: counts.slice()
          });
        }
        return;
      }
      for (let i = 0; i < substatSlotCount; i++) {
        counts[i]++;
        const isLocked = i < fixedStatKeys.length; // 固定副词条在 subTypes 前 fixedStatKeys.length 个位置
        dfs(curRoll + 1, counts, prob * 0.25, lockedHits + (isLocked ? 1 : 0));
        counts[i]--;
      }
    }

    dfs(0, [0, 0, 0, 0], 1.0, 0);

    // 合并相同 rollCounts
    const merged = new Map();
    for (const o of outcomes) {
      const key = o.rollCounts.join(',');
      const prev = merged.get(key);
      if (prev) {
        prev.prob += o.prob;
      } else {
        merged.set(key, { prob: o.prob, rollCounts: o.rollCounts.slice() });
      }
    }
    const mergedList = Array.from(merged.values());
    const rollTotal = mergedList.reduce((s, o) => s + o.prob, 0);
    if (rollTotal > 0) {
      for (const o of mergedList) o.prob /= rollTotal;
    }
    assertProbSumOne(mergedList, 'rollPatternOutcomes(merged)');
    return mergedList;
  }

  /**
   * 在给定「4 副词条种类 + 每条命中次数」的前提下，精确枚举 5 次强化的档位。
   * - 逻辑与 dust.js 中的 buildOutcomeFromRollVals / 全部 v0~v4 嵌套循环类似；
   * - 这里将 5 次强化的“档位选择序列”表示为 tiers[5]，其中每个元素是 0~3 的整数，
   *   表示落在哪一档；
   * - 为简化实现，这里枚举所有 4^maxRolls 种 tiers 组合，再通过 rollCounts 约束过滤。
   */
  function enumerateFrostTierOutcomes(subTypes, rollCounts, maxRolls) {
    const results = [];
    const totalComb = Math.pow(4, maxRolls);
    const baseProbPerTierSeq = 1 / totalComb;

    // 使用整数从 0 到 4^5-1 的进制表示 tiers 组合，避免 5 重嵌套 for。
    for (let mask = 0; mask < totalComb; mask++) {
      const tiers = [];
      let tmp = mask;
      for (let r = 0; r < maxRolls; r++) {
        tiers.push(tmp & 3); // 0~3
        tmp >>= 2;
      }
      // 验证该 tiers 是否能产生给定 rollCounts（即每条副词条命中次数匹配）
      const curCounts = [0, 0, 0, 0];
      let curSub = 0;
      for (let r = 0; r < maxRolls; r++) {
        while (curSub < 4 && curCounts[curSub] === rollCounts[curSub]) {
          curSub++;
        }
        if (curSub >= 4) {
          curSub = 3;
        }
        curCounts[curSub]++;
      }
      if (!curCounts.every((c, i) => c === rollCounts[i])) continue;

      results.push({
        prob: baseProbPerTierSeq,
        tiers
      });
    }
    assertProbSumOne(results, 'tierOutcomes');
    return results;
  }

  /**
   * 根据「主词条、4 副词条种类、5 次强化档位选择」构造最终圣遗物对象。
   * - 初始值使用 SUBSTAT_ROLL_AVG[subType]；
   * - 对于每一次强化，给当前被命中的副词条累加 SUBSTAT_ROLL_TIERS[subType][tier]。
   */
  function buildFrostArtifactFromPattern(ctx) {
    const { slotIdx, mainStat, subTypes, tierChoices, baseArtifact } = ctx;
    const subs = subTypes.map(stat => ({
      stat,
      value: (typeof SUBSTAT_ROLL_AVG !== 'undefined' && SUBSTAT_ROLL_AVG[stat]) || 0
    }));

    const maxRolls = tierChoices.length;
    const rollCounts = [0, 0, 0, 0];
    let curSub = 0;
    const TIERS = typeof SUBSTAT_ROLL_TIERS !== 'undefined' ? SUBSTAT_ROLL_TIERS : {};
    for (let r = 0; r < maxRolls; r++) {
      while (curSub < 4 && rollCounts[curSub] >= 5) {
        curSub++;
      }
      if (curSub >= 4) curSub = 3;
      const statKey = subTypes[curSub];
      const tiers = TIERS[statKey] || [0, 0, 0, 0];
      const tierIdx = Math.max(0, Math.min(3, tierChoices[r] | 0));
      subs[curSub].value += tiers[tierIdx];
      rollCounts[curSub]++;
    }

    const name = (baseArtifact && baseArtifact.name) ? baseArtifact.name : '祝圣之霜圣遗物';
    const setId = (baseArtifact && baseArtifact.setId != null) ? baseArtifact.setId : null;
    return {
      slotIndex: slotIdx,
      name,
      setId,
      mainStat,
      level: 20,
      maxRolls: 5,
      substats: subs
    };
  }

  /**
   * 从数组中选择 k 个元素的所有组合（不考虑顺序）。
   */
  function combinations(arr, k) {
    const res = [];
    if (k <= 0) return [[]];
    if (k > arr.length) return [];
    function backtrack(start, path) {
      if (path.length === k) {
        res.push(path.slice());
        return;
      }
      for (let i = start; i < arr.length; i++) {
        path.push(arr[i]);
        backtrack(i + 1, path);
        path.pop();
      }
    }
    backtrack(0, []);
    return res;
  }

  /**
   * 根据给定的副词条数组生成「修改后」圣遗物对象。
   * 与 dust.js 中的 buildModifiedArtifact 语义一致，方便你在 getFrostOutcomes 中复用。
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
   * 计算对指定部位当前装备圣遗物使用祝圣之霜后的期望与最大值等统计。
   *
   * 返回结构：
   * {
   *   originalTotal: number,    // 使用前的循环总伤害
   *   expectedTotal: number,    // E[max(原伤, 改后)]
   *   maxTotal: number,         // 所有结果中的最大循环总伤害
   *   probImprove: number,      // 提升概率（0~1）
   *   outcomeCount: number      // 枚举到的结果数量
   * }
   */
  function computeFrostExpectation(slotIdx, options) {
    const equipped = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
    const artifact = equipped[slotIdx];
    const baseTotal = typeof getCycleTotalDamage === 'function' ? getCycleTotalDamage(equipped) : 0;
    const ctx = {
      slotIdx,
      artifact,
      equipped,
      baseTotal,
      getCycleTotalDamage: (typeof getCycleTotalDamage === 'function' ? getCycleTotalDamage : null),
      getFrostOutcomes,
      buildModifiedArtifact,
      options: options || {}
    };
    return computeFrostExpectationImpl(ctx);
  }

  /**
   * 真正的期望/最大值计算逻辑。
   *
   * @param {Object} ctx
   * @param {number} ctx.slotIdx
   * @param {Object|null} ctx.artifact
   * @param {Object[]} ctx.equipped
   * @param {number} ctx.baseTotal
   * @param {Function|null} ctx.getCycleTotalDamage
   * @param {Function} ctx.getFrostOutcomes
   * @param {Function} ctx.buildModifiedArtifact
   */
  function computeFrostExpectationImpl(ctx) {
    if (!ctx || !ctx.artifact || typeof ctx.getCycleTotalDamage !== 'function') {
      return {
        originalTotal: 0,
        expectedTotal: 0,
        maxTotal: 0,
        probImprove: 0,
        outcomeCount: 0
      };
    }

    const orig_dmg = ctx.getCycleTotalDamage(ctx.equipped);
    const outcomes = ctx.getFrostOutcomes(ctx.artifact, ctx.options) || [];
    if (!Array.isArray(outcomes) || outcomes.length === 0) {
      return {
        originalTotal: orig_dmg,
        expectedTotal: orig_dmg,
        maxTotal: orig_dmg,
        probImprove: 0,
        outcomeCount: 0
      };
    }

    let prob_improve = 0.0;
    let exp_dmg = 0.0;
    let max_dmg = orig_dmg;
    const improvedOutcomes = [];

    for (const outcome of outcomes) {
      if (!outcome || typeof outcome.prob !== 'number' || !outcome.artifact) continue;
      const prob = outcome.prob;
      if (!(prob > 0)) continue;
      // 用新的圣遗物替换对应槽位后，重新计算整套循环伤害
      const newArtifacts = ctx.equipped.slice();
      newArtifacts[ctx.slotIdx] = outcome.artifact;
      const cur_dmg = ctx.getCycleTotalDamage(newArtifacts);
      exp_dmg += prob * Math.max(cur_dmg, orig_dmg);
      if (cur_dmg > orig_dmg) {
        prob_improve += prob;
        improvedOutcomes.push({ prob, dmg: cur_dmg });
      }
    }

    // 使用与启圣之尘相同的「最大提升判定阈值」逻辑
    const opts = ctx.options || {};
    const tailThresholdRaw = Math.max(0, Math.min(1, Number(opts.maxTailProbThreshold) || 0));
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
      expectedTotal: exp_dmg,
      maxTotal: max_dmg,
      probImprove: prob_improve,
      outcomeCount: outcomes.length
    };
  }

  function formatNumber(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return Math.round(n).toLocaleString();
  }

  function resetFrostResult() {
    const ids = [
      'frost-original-total',
      'frost-expected-total',
      'frost-max-total',
      'frost-delta',
      'frost-max-delta',
      'frost-prob-improve'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }

  /** 刷新两个固定副词条下拉的选项（与主词条冲突、副与副重复的均禁用；若当前选中冲突则清空） */
  function refreshFrostFixedSubstatOptions() {
    const subs = (typeof ARTIFACT_SUBSTATS !== 'undefined') ? ARTIFACT_SUBSTATS : [];
    const sel0 = document.getElementById('frost-fixed-substat-0');
    const sel1 = document.getElementById('frost-fixed-substat-1');
    const slotSel = document.getElementById('frost-artifact-select');
    const mainSel = document.getElementById('frost-main-stat-select');
    if (!sel0 || !sel1) return;
    const slotIdx = slotSel && slotSel.value !== '' ? parseInt(slotSel.value, 10) : 0;
    const mainStat = mainSel && mainSel.value ? mainSel.value : '';
    const forbiddenByMain = (typeof getForbiddenSubstatByMain === 'function')
      ? getForbiddenSubstatByMain(mainStat, slotIdx)
      : null;
    const v0 = sel0.value || '';
    const v1 = sel1.value || '';
    const disabledIn0 = new Set([forbiddenByMain, v1].filter(Boolean));
    const disabledIn1 = new Set([forbiddenByMain, v0].filter(Boolean));
    const opts0 = '<option value="">— 请选择 —</option>' + subs.map(s =>
      disabledIn0.has(s.value)
        ? `<option value="${escapeHtml(s.value)}" disabled>${escapeHtml(s.label)}</option>`
        : `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`
    ).join('');
    const opts1 = '<option value="">— 请选择 —</option>' + subs.map(s =>
      disabledIn1.has(s.value)
        ? `<option value="${escapeHtml(s.value)}" disabled>${escapeHtml(s.label)}</option>`
        : `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`
    ).join('');
    sel0.innerHTML = opts0;
    sel1.innerHTML = opts1;
    if (v0 && !disabledIn0.has(v0)) sel0.value = v0;
    else sel0.value = '';
    if (v1 && v1 !== v0 && !disabledIn1.has(v1)) sel1.value = v1;
    else sel1.value = '';
  }

  function initFrostFixedSubstatSelects() {
    const subs = (typeof ARTIFACT_SUBSTATS !== 'undefined') ? ARTIFACT_SUBSTATS : [];
    const opts = '<option value="">— 请选择 —</option>' + subs.map(s =>
      `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`
    ).join('');
    const sel0 = document.getElementById('frost-fixed-substat-0');
    const sel1 = document.getElementById('frost-fixed-substat-1');
    if (sel0) sel0.innerHTML = opts;
    if (sel1) sel1.innerHTML = opts;
    refreshFrostFixedSubstatOptions();
  }

  function renderFrostMainStatOptions(slotIdx) {
    const sel = document.getElementById('frost-main-stat-select');
    if (!sel) return;
    const mainOpts = (typeof ARTIFACT_MAIN_STATS !== 'undefined' && ARTIFACT_MAIN_STATS[slotIdx])
      ? ARTIFACT_MAIN_STATS[slotIdx]
      : [];
    const equipped = typeof getEquippedArtifacts === 'function' ? getEquippedArtifacts() : [];
    const currentMain = equipped[slotIdx] && equipped[slotIdx].mainStat ? equipped[slotIdx].mainStat : '';
    const prev = sel.value || '';
    sel.innerHTML = '<option value="">— 请选择 —</option>' + mainOpts.map(o =>
      `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
    ).join('');
    if (prev && mainOpts.some(o => o.value === prev)) {
      sel.value = prev;
    } else if (currentMain && mainOpts.some(o => o.value === currentMain)) {
      sel.value = currentMain;
    } else if (mainOpts.length > 0) {
      sel.value = mainOpts[0].value;
    } else {
      sel.value = '';
    }
  }

  function renderFrostArtifactOptions() {
    const sel = document.getElementById('frost-artifact-select');
    if (!sel) return;
    const slotNames = typeof ARTIFACT_SLOTS !== 'undefined'
      ? ARTIFACT_SLOTS
      : ['生之花', '死之羽', '时之沙', '空之杯', '理之冠'];
    const prev = sel.value === '' ? '' : sel.value;
    // 改为按「圣遗物槽位」选择，而不是按具体圣遗物
    sel.innerHTML = '<option value="">— 请选择槽位 —</option>' + slotNames.map((slotName, i) => {
      const label = slotName || `部位${i}`;
      return `<option value="${i}">${label}</option>`;
    }).join('');
    if (prev !== '' && sel.querySelector(`option[value="${prev}"]`)) {
      sel.value = prev;
    } else {
      sel.value = '';
    }
    resetFrostResult();
    if (sel.value !== '') {
      const idx = parseInt(sel.value, 10);
      if (Number.isInteger(idx) && idx >= 0 && idx < 5) {
        renderFrostMainStatOptions(idx);
      }
    }
  }

  function runFrostCalc() {
    const sel = document.getElementById('frost-artifact-select');
    const slotIdx = sel && sel.value !== '' ? parseInt(sel.value, 10) : -1;
    if (slotIdx < 0 || slotIdx > 4) {
      resetFrostResult();
      return;
    }
    const options = {};
    const fixedSel0 = document.getElementById('frost-fixed-substat-0');
    const fixedSel1 = document.getElementById('frost-fixed-substat-1');
    const s0 = fixedSel0 && fixedSel0.value ? fixedSel0.value : '';
    const s1 = fixedSel1 && fixedSel1.value ? fixedSel1.value : '';
    const fixedSubstats = [];
    if (s0) fixedSubstats.push({ index: 0, stat: s0 });
    if (s1) fixedSubstats.push({ index: 1, stat: s1 });
    if (fixedSubstats.length > 0) {
      options.fixedSubstats = fixedSubstats;
    }
    const minLockSel = document.getElementById('frost-min-lock-rolls');
    const minLockedRolls = minLockSel ? Math.max(2, Math.min(4, parseInt(minLockSel.value, 10) || 2)) : 2;
    options.minLockedRolls = minLockedRolls;
    const mainStatSel = document.getElementById('frost-main-stat-select');
    const mainStat = mainStatSel && mainStatSel.value ? mainStatSel.value : '';
    if (mainStat) {
      options.mainStat = mainStat;
    }
    const maxThrInput = document.getElementById('frost-max-threshold');
    options.maxTailProbThreshold = maxThrInput ? (Number(maxThrInput.value) || 0) / 100 : 0;
    const result = computeFrostExpectation(slotIdx, options);
    const isPlaceholder = !result
      || (result.originalTotal === 0 && result.expectedTotal === 0 && result.maxTotal === 0 && result.outcomeCount === 0);
    if (isPlaceholder) {
      resetFrostResult();
      return;
    }

    const origEl = document.getElementById('frost-original-total');
    const expEl = document.getElementById('frost-expected-total');
    const maxEl = document.getElementById('frost-max-total');
    const deltaEl = document.getElementById('frost-delta');
    const maxDeltaEl = document.getElementById('frost-max-delta');
    const probEl = document.getElementById('frost-prob-improve');

    const orig = result.originalTotal;
    const exp = result.expectedTotal;
    const max = result.maxTotal;

    if (origEl) origEl.textContent = formatNumber(orig);
    if (expEl) {
      const delta = exp - orig;
      const pct = orig > 0 ? (delta / orig) * 100 : 0;
      expEl.textContent = `${formatNumber(exp)}（${delta >= 0 ? '+' : ''}${formatNumber(delta)}，${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`;
    }
    if (maxEl) maxEl.textContent = formatNumber(max);
    if (deltaEl) {
      const delta = exp - orig;
      const pct = orig > 0 ? (delta / orig) * 100 : 0;
      deltaEl.textContent = `${delta >= 0 ? '+' : ''}${formatNumber(delta)}（${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）`;
    }
    if (maxDeltaEl) {
      const maxDelta = max - orig;
      const maxPct = orig > 0 ? (maxDelta / orig) * 100 : 0;
      maxDeltaEl.textContent = `${maxDelta >= 0 ? '+' : ''}${formatNumber(maxDelta)}（${maxPct >= 0 ? '+' : ''}${maxPct.toFixed(2)}%）`;
    }
    if (probEl) probEl.textContent = (result.probImprove * 100).toFixed(2) + '%';
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 只有当祝圣之霜页面存在时才初始化
    if (document.getElementById('frost')) {
      renderFrostArtifactOptions();
      const sel = document.getElementById('frost-artifact-select');
      if (sel) {
        sel.addEventListener('change', () => {
          resetFrostResult();
          const idx = sel.value !== '' ? parseInt(sel.value, 10) : -1;
          if (Number.isInteger(idx) && idx >= 0 && idx < 5) {
            renderFrostMainStatOptions(idx);
          } else {
            const mainSel = document.getElementById('frost-main-stat-select');
            if (mainSel) {
              mainSel.innerHTML = '<option value="">— 请先选择槽位 —</option>';
              mainSel.value = '';
            }
          }
          refreshFrostFixedSubstatOptions();
        });
      }
      initFrostFixedSubstatSelects();
      document.getElementById('frost-main-stat-select')?.addEventListener('change', () => {
        refreshFrostFixedSubstatOptions();
        resetFrostResult();
      });
      document.getElementById('frost-fixed-substat-0')?.addEventListener('change', () => {
        refreshFrostFixedSubstatOptions();
        resetFrostResult();
      });
      document.getElementById('frost-fixed-substat-1')?.addEventListener('change', () => {
        refreshFrostFixedSubstatOptions();
        resetFrostResult();
      });
      const frostMaxThrHelpTrigger = document.getElementById('frost-max-threshold-help-trigger');
      const maxThrHelpModal = document.getElementById('dust-max-threshold-help-modal');
      const maxThrHelpClose = document.getElementById('dust-max-threshold-help-close');
      if (frostMaxThrHelpTrigger && maxThrHelpModal) {
        frostMaxThrHelpTrigger.addEventListener('click', () => {
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
      document.getElementById('frost-calc-btn')?.addEventListener('click', () => {
        runFrostCalc();
      });
    }
  });

  // 暴露给外部使用（如调试或自定义逻辑）
  window.getFrostOutcomes = getFrostOutcomes;
  window.computeFrostExpectation = computeFrostExpectation;
})();

