(function () {
    const MAIN_RANGES = (typeof MAIN_STAT_RANGES !== 'undefined' ? MAIN_STAT_RANGES : null) || {
        hp: [717, 4780], flat_atk: [47, 311], hp_pct: [7.0, 46.6], atk_pct: [7.0, 46.6], def_pct: [8.7, 58.3],
        em: [28, 186.5], er: [7.8, 51.8], phys: [8.7, 58.3], pyro: [7.0, 46.6], hydro: [7.0, 46.6],
        electro: [7.0, 46.6], cryo: [7.0, 46.6], anemo: [7.0, 46.6], dendro: [7.0, 46.6], geo: [7.0, 46.6],
        cr: [4.7, 31.1], cd: [9.3, 62.2], atk: [7.0, 46.6], def: [8.7, 58.3]
    };
    const MAIN_STAT_PERCENT = new Set(['hp_pct', 'atk_pct', 'def_pct', 'er', 'phys', 'pyro', 'hydro', 'electro', 'cryo', 'anemo', 'dendro', 'geo', 'cr', 'cd', 'atk', 'def']);

    function getMainStatRangeKey(mainStat, slotIdx) {
        if (slotIdx === 0 && mainStat === 'hp') return 'hp';
        if (slotIdx === 1 && mainStat === 'flat_atk') return 'flat_atk';
        if (slotIdx >= 2 && ['hp', 'atk', 'def'].includes(mainStat)) return mainStat + '_pct';
        return mainStat in MAIN_RANGES ? mainStat : mainStat;
    }

    function getArtifactMainStatValue(mainStat, level, slotIdx) {
        const key = getMainStatRangeKey(mainStat, slotIdx);
        const range = MAIN_RANGES[key] || MAIN_RANGES.hp || [717, 4780];
        const lvl = Math.max(0, Math.min(20, parseInt(level, 10) || 0));
        const v = range[0] + (range[1] - range[0]) * lvl / 20;
        return MAIN_STAT_PERCENT.has(key) ? Math.round(v * 10) / 10 : Math.round(v);
    }

    function parseNum(x) {
        if (x === '' || x == null) return 0;
        const n = parseFloat(x);
        return isNaN(n) ? 0 : n;
    }

    function collectStats(data) {
        const bp = data.basePanel || {};
        let hp = parseNum(bp.hp);
        let atk = parseNum(bp.atk);
        let def = parseNum(bp.def);
        let em = parseNum(bp.em);
        const rawBaseHp = hp, rawBaseAtk = atk, rawBaseDef = def, rawBaseEm = em;
        let hpPct = 0, atkPct = 0, defPct = 0;
        const DMG_ELEMENTS = ['phys', 'pyro', 'hydro', 'electro', 'cryo', 'anemo', 'dendro', 'geo'];
        const dmgBonusByElement = DMG_ELEMENTS.reduce((o, e) => { o[e] = 0; return o; }, {});
        let dmgBonusFromBuffs = 0;
        let critRate = (bp.critRate !== '' && bp.critRate != null) ? parseNum(bp.critRate) / 100 : 0.05;
        let critDmg = (bp.critDmg !== '' && bp.critDmg != null) ? parseNum(bp.critDmg) / 100 : 0.5;
        let hpMult = 0, atkMult = 0, defMult = 0, emMult = 0, flatDmg = 0;
        let defReduct = 0, resistReduct = 0;
        let reactionBonus = 0;
        const ascendBonuses = [];
        const specialBonuses = [];
        const zoneNames = typeof BUFF_CONTENT_TO_ZONE !== 'undefined' ? [...new Set(Object.values(BUFF_CONTENT_TO_ZONE))] : [];
        const zoneBuffs = zoneNames.reduce((acc, z) => { acc[z] = []; return acc; }, {});

        const row = data.cycleFlowRow || {};

        const setPieceCount = {};
        (data.artifacts || []).forEach(art => {
            if (art && art.setId != null) {
                const sid = typeof art.setId === 'number' ? art.setId : parseInt(art.setId, 10);
                if (!isNaN(sid)) setPieceCount[sid] = (setPieceCount[sid] || 0) + 1;
            }
        });
        const toArr = val => (Array.isArray(val) ? val : val ? [val] : []).filter(Boolean);
        const activeBuffNames = new Set((row.buffRefs || []).filter(Boolean));
        let buffs = (data.buffs || []).filter(b => activeBuffNames.has(b.name));
        buffs = buffs.filter(b => {
            if (!b.isArtifactBuff) return true;
            const need = b.artifactPieces === 4 ? 4 : 2;
            const setEffects = data.setEffects || [];
            return setEffects.some(se => {
                if ((setPieceCount[se.id] || 0) < need) return false;
                const names = need === 4 ? toArr(se.fourPiece) : toArr(se.twoPiece);
                return names.includes(b.name);
            });
        });

        const artifactMain = { hp: 0, atk: 0, def: 0, em: 0, hpPct: 0, atkPct: 0, defPct: 0, dmgBonusByElement: DMG_ELEMENTS.reduce((o, e) => { o[e] = 0; return o; }, {}), critRate: 0, critDmg: 0 };
        const artifactSub = { hp: 0, atk: 0, def: 0, em: 0, hpPct: 0, atkPct: 0, defPct: 0, dmgBonus: 0, critRate: 0, critDmg: 0 };

        (data.artifacts || []).forEach((art, slotIdx) => {
            if (!art) return;
            const lvl = parseInt(art.level, 10) || 20;
            const mainVal = getArtifactMainStatValue(art.mainStat, lvl, slotIdx);
            switch (art.mainStat) {
                case 'hp':
                    if (slotIdx === 0) { hp += mainVal; artifactMain.hp += mainVal; }
                    else { hpPct += mainVal / 100; artifactMain.hpPct += mainVal / 100; }
                    break;
                case 'flat_atk': atk += mainVal; artifactMain.atk += mainVal; break;
                case 'atk': atkPct += mainVal / 100; artifactMain.atkPct += mainVal / 100; break;
                case 'def': defPct += mainVal / 100; artifactMain.defPct += mainVal / 100; break;
                case 'em': em += mainVal; artifactMain.em += mainVal; break;
                case 'er': break;
                case 'phys': case 'pyro': case 'hydro': case 'electro': case 'cryo': case 'anemo': case 'dendro': case 'geo':
                    dmgBonusByElement[art.mainStat] = (dmgBonusByElement[art.mainStat] || 0) + mainVal / 100;
                    artifactMain.dmgBonusByElement[art.mainStat] = (artifactMain.dmgBonusByElement[art.mainStat] || 0) + mainVal / 100;
                    break;
                case 'cr': critRate += mainVal / 100; artifactMain.critRate += mainVal / 100; break;
                case 'cd': critDmg += mainVal / 100; artifactMain.critDmg += mainVal / 100; break;
                default: break;
            }
            (art.substats || []).forEach(s => {
                const v = parseNum(s.value);
                switch (s.stat) {
                    case 'hp': hp += v; artifactSub.hp += v; break;
                    case 'atk': atk += v; artifactSub.atk += v; break;
                    case 'def': def += v; artifactSub.def += v; break;
                    case 'hp_pct': hpPct += v / 100; artifactSub.hpPct += v / 100; break;
                    case 'atk_pct': atkPct += v / 100; artifactSub.atkPct += v / 100; break;
                    case 'def_pct': defPct += v / 100; artifactSub.defPct += v / 100; break;
                    case 'em': em += v; artifactSub.em += v; break;
                    case 'er': break;
                    case 'cr': critRate += v / 100; artifactSub.critRate += v / 100; break;
                    case 'cd': critDmg += v / 100; artifactSub.critDmg += v / 100; break;
                    default: break;
                }
            });
        });

        const baseHpBeforeBuff = hp;
        const baseAtkBeforeBuff = atk;
        const baseDefBeforeBuff = def;
        const baseEmBeforeBuff = em;
        let hpFlatBuff = 0, atkFlatBuff = 0, defFlatBuff = 0, emFlatBuff = 0;

        buffs.forEach(b => {
            const v = parseNum(b.value);
            const pct = b.isPercent ? v / 100 : 0;
            const flat = b.isPercent ? 0 : v;
            const zone = typeof BUFF_CONTENT_TO_ZONE !== 'undefined' ? BUFF_CONTENT_TO_ZONE[b.content] : null;
            if (zone && zoneBuffs[zone]) zoneBuffs[zone].push({ name: b.name, content: b.content, value: b.value, isPercent: b.isPercent });
            switch (b.content) {
                case 'hp': hpFlatBuff += flat; hpPct += pct; break;
                case 'atk': atkFlatBuff += flat; atkPct += pct; break;
                case 'def': defFlatBuff += flat; defPct += pct; break;
                case 'em': emFlatBuff += flat; break;
                case 'er': break;
                case 'hpMult': hpMult += pct; break;
                case 'atkMult': atkMult += pct; break;
                case 'defMult': defMult += pct; break;
                case 'emMult': emMult += pct; break;
                case 'flatDmg': flatDmg += flat; break;
                case 'dmgBonus': dmgBonusFromBuffs += pct; break;
                case 'critRate': critRate += pct; break;
                case 'critDmg': critDmg += pct; break;
                case 'reaction': reactionBonus += pct; break;
                case 'defReduct': defReduct += pct; break;
                case 'resistReduct': resistReduct += pct; break;
                case 'ascend': ascendBonuses.push(pct); break;
                case 'special': specialBonuses.push(pct); break;
                default: break;
            }
        });

        const artifactFlatHp = (artifactMain.hp || 0) + (artifactSub.hp || 0);
        const artifactFlatAtk = (artifactMain.atk || 0) + (artifactSub.atk || 0);
        const artifactFlatDef = (artifactMain.def || 0) + (artifactSub.def || 0);
        const finalHp = rawBaseHp * (1 + hpPct) + artifactFlatHp + hpFlatBuff;
        const finalAtk = rawBaseAtk * (1 + atkPct) + artifactFlatAtk + atkFlatBuff;
        const finalDef = rawBaseDef * (1 + defPct) + artifactFlatDef + defFlatBuff;
        const finalEm = rawBaseEm + (artifactMain.em || 0) + (artifactSub.em || 0) + emFlatBuff;
        const ascendMult = ascendBonuses.length ? ascendBonuses.reduce((m, v) => m * (1 + v), 1) : 1;
        const specialMult = specialBonuses.length ? specialBonuses.reduce((m, v) => m * (1 + v), 1) : 1;

        return {
            hp: finalHp, atk: finalAtk, def: finalDef, em: finalEm,
            baseHp: baseHpBeforeBuff, baseAtk: baseAtkBeforeBuff, baseDef: baseDefBeforeBuff, baseEm: baseEmBeforeBuff,
            rawBaseHp: rawBaseHp, rawBaseAtk: rawBaseAtk, rawBaseDef: rawBaseDef, rawBaseEm: rawBaseEm,
            hpFlatBuff, atkFlatBuff, defFlatBuff, emFlatBuff,
            hpPct, atkPct, defPct,
            hpMult, atkMult, defMult, emMult, flatDmg,
            dmgBonusByElement,
            dmgBonus: dmgBonusFromBuffs,
            critRate, critDmg, defReduct, resistReduct,
            reactionBonus,
            ascendBonuses, specialBonuses,
            ascendBonus: ascendMult - 1,
            specialBonus: specialMult - 1,
            zoneBuffs,
            artifactMain,
            artifactSub,
            artifactFlatHp, artifactFlatAtk, artifactFlatDef,
            artifactFlatEm: (artifactMain.em || 0) + (artifactSub.em || 0)
        };
    }

    function calcResistMult(resist) {
        const r = parseFloat(resist) / 100;
        if (r < 0) return 1 - r / 2;
        if (r < 0.75) return 1 - r;
        return 1 / (4 * r + 1);
    }

    function calcDefMult(charLvl, monsterLvl, defReduct) {
        charLvl = Math.max(1, parseNum(charLvl) || 90);
        monsterLvl = Math.max(1, parseNum(monsterLvl) || 90);
        defReduct = Math.min(0.9, Math.max(0, defReduct));
        const c = charLvl + 100;
        const m = (monsterLvl + 100) * (1 - defReduct);
        return c / (c + m);
    }

    /** 剧变反应等级系数（1.6+，角色触发）。来源：wiki/KQM 等级系数表，70→383,80→539,90→723 等，中间线性插值 */
    const TRANSFORMATIVE_LEVEL_BASE = (function () {
        const key = { 1: 17.17, 10: 34.14, 20: 80.58, 30: 136.29, 40: 207.38, 50: 323.6, 70: 383, 75: 457, 80: 539, 85: 627, 90: 723 };
        const arr = [];
        for (let L = 1; L <= 90; L++) {
            if (key[L] != null) arr[L] = key[L];
            else {
                let lo = 1, hi = 90;
                for (const k of Object.keys(key).map(Number).sort((a, b) => a - b)) {
                    if (k <= L) lo = k;
                    if (k >= L && hi > k) hi = k;
                }
                if (lo === hi) arr[L] = key[lo];
                else arr[L] = key[lo] + (key[hi] - key[lo]) * (L - lo) / (hi - lo);
            }
        }
        return arr;
    })();

    /** 剧变反应基础倍率（1.6+）：扩散 1.2，超载 2.75，碎冰 3。KQM/官方一致 */
    const TRANSFORMATIVE_RATE = { swirl: 1.2, overload: 2.75, shatter: 3 };

    function calcTransformativeDamage(data) {
        const row = data.cycleFlowRow || {};
        const bp = data.basePanel || {};
        const stats = collectStats(data);
        const charLvl = Math.max(1, Math.min(90, parseInt(bp.charLevel, 10) || 90));
        const levelBase = TRANSFORMATIVE_LEVEL_BASE[charLvl] ?? TRANSFORMATIVE_LEVEL_BASE[90];
        const reaction = (row.reaction || 'swirl').toLowerCase();
        const rate = TRANSFORMATIVE_RATE[reaction] ?? 1.2;
        const em = stats.em ?? 0;
        const emBonus = (16 * em) / (em + 2000);
        const reactionBonus = stats.reactionBonus || 0;
        const resistKey = reaction === 'swirl'
            ? ('resist' + (row.swirlElement || 'pyro').charAt(0).toUpperCase() + (row.swirlElement || 'pyro').slice(1))
            : reaction === 'overload'
                ? 'resistPyro'
                : 'resistPhys';
        const baseRes = parseNum(bp[resistKey] ?? bp.resistPhys) / 100;
        const finalRes = baseRes - (stats.resistReduct || 0);
        const resMult = calcResistMult(finalRes * 100);
        const dmg = levelBase * rate * (1 + emBonus + reactionBonus) * resMult;
        return Math.max(0, dmg);
    }

    /** 返回剧变反应 breakdown 供面板显示用 */
    window.getTransformativeBreakdown = function (data) {
        const row = data.cycleFlowRow || {};
        const bp = data.basePanel || {};
        const stats = collectStats(data);
        const charLvl = Math.max(1, Math.min(90, parseInt(bp.charLevel, 10) || 90));
        const levelBase = TRANSFORMATIVE_LEVEL_BASE[charLvl] ?? TRANSFORMATIVE_LEVEL_BASE[90];
        const reaction = (row.reaction || 'swirl').toLowerCase();
        const rate = TRANSFORMATIVE_RATE[reaction] ?? 1.2;
        const em = stats.em ?? 0;
        const emBonus = (16 * em) / (em + 2000);
        const reactionBonus = stats.reactionBonus || 0;
        const resistKey = reaction === 'swirl'
            ? ('resist' + (row.swirlElement || 'pyro').charAt(0).toUpperCase() + (row.swirlElement || 'pyro').slice(1))
            : reaction === 'overload'
                ? 'resistPyro'
                : 'resistPhys';
        const baseRes = parseNum(bp[resistKey] ?? bp.resistPhys) / 100;
        const finalRes = baseRes - (stats.resistReduct || 0);
        const resMult = calcResistMult(finalRes * 100);
        const damage = levelBase * rate * (1 + emBonus + reactionBonus) * resMult;
        const rateLabels = { swirl: '扩散', overload: '超载', shatter: '碎冰' };
        return {
            levelBase,
            rate,
            rateLabel: rateLabels[reaction] || reaction,
            em,
            emBonus,
            reactionBonus,
            resMult,
            damage: Math.max(0, damage)
        };
    };

    window.calcRowDamage = function (data) {
        if (!data || !data.cycleFlowRow) return 0;
        const row = data.cycleFlowRow;
        if (row.damageType === 'transformative') {
            const count = Math.max(1, parseInt(row.count, 10) || 1);
            return Math.round(calcTransformativeDamage(data) * count);
        }
        const bp = data.basePanel || {};
        const stats = collectStats(data);

        const rateHp = parseNum(row.rateHp) / 100;
        const rateAtk = parseNum(row.rateAtk) / 100;
        const rateDef = parseNum(row.rateDef) / 100;
        const rateEm = parseNum(row.rateEm) / 100;

        let baseDmg = stats.hp * (rateHp + stats.hpMult)
            + stats.atk * (rateAtk + stats.atkMult)
            + stats.def * (rateDef + stats.defMult)
            + stats.em * (rateEm + stats.emMult)
            + stats.flatDmg;

        if (baseDmg <= 0) return 0;

        const element = (row.element || 'phys').toLowerCase();
        const dmgBonusForElement = (stats.dmgBonusByElement && stats.dmgBonusByElement[element]) || 0;
        const dmgBonus = 1 + dmgBonusForElement + (stats.dmgBonus || 0);
        const cr = Math.min(1, Math.max(0, stats.critRate));
        const cd = stats.critDmg;
        const avgCrit = 1 + cr * cd;

        const charLvl = parseNum(bp.charLevel) || 90;
        const monsterLvl = parseNum(bp.monsterLevel) || 90;
        const defMult = calcDefMult(charLvl, monsterLvl, stats.defReduct);

        const resistKey = element === 'phys' ? 'resistPhys' : 'resist' + element.charAt(0).toUpperCase() + element.slice(1);
        const baseRes = parseNum(bp[resistKey] ?? bp.resistPhys) / 100;
        const finalRes = baseRes - stats.resistReduct;
        const resMult = calcResistMult(finalRes * 100);

        const amplify = (row.amplify || '').toLowerCase();
        let baseAmplifyMult = 1;
        let emReactionMult = 1;
        if (amplify === 'vaporize') {
            if (element === 'pyro') baseAmplifyMult = 1.5;
            else if (element === 'hydro') baseAmplifyMult = 2;
            emReactionMult = 1 + 2.78 * stats.em / (1400 + stats.em) + stats.reactionBonus;
        } else if (amplify === 'melt') {
            if (element === 'pyro') baseAmplifyMult = 2;
            else if (element === 'cryo') baseAmplifyMult = 1.5;
            emReactionMult = 1 + 2.78 * stats.em / (1400 + stats.em) + stats.reactionBonus;
        }
        const reactionMult = baseAmplifyMult * emReactionMult;

        let dmg = baseDmg * dmgBonus * avgCrit * defMult * resMult * reactionMult;

        (stats.ascendBonuses || []).forEach(function (v) { dmg *= (1 + v); });
        (stats.specialBonuses || []).forEach(function (v) { dmg *= (1 + v); });

        const count = Math.max(1, parseInt(row.count, 10) || 1);
        return Math.round(dmg * count);
    };

    window.getRowStats = function (data) {
        if (!data || typeof data !== 'object') return null;
        return collectStats(data);
    };
})();
