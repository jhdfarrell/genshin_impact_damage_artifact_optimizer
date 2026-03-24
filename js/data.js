const appData = {
  basePanel: {
    charLevel: 90,
    monsterLevel: 90,
    hp: 0, atk: 0, def: 0, em: 0, er: 0,
    critRate: 5, critDmg: 50,
    resistPhys: 10, resistPyro: 10, resistHydro: 10, resistElectro: 10,
    resistCryo: 10, resistAnemo: 10, resistDendro: 10, resistGeo: 10
  },
  buffs: [],
  cycleFlow: [],
  artifacts: {},
  setEffects: [],
  equippedArtifacts: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  /** 视为有效的副词条类型（仅这些参与词条价值统计）。空数组表示全部有效 */
  effectiveSubstats: [],
  /** 循环流程加成模板：[{ id, name, buffRefs: string[] }] */
  cycleBuffTemplates: []
};
let setEffectIdCounter = 0;
let buffIdCounter = 0;
let cycleFlowIdCounter = 0;
let cycleBuffTemplateIdCounter = 0;
