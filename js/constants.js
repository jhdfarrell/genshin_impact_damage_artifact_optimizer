const ARTIFACT_SLOTS = ['生之花', '死之羽', '时之沙', '空之杯', '理之冠'];
const ARTIFACT_MAIN_STATS = {
  0: [{ value: 'hp', label: '生命值' }],
  1: [{ value: 'flat_atk', label: '固定攻击力' }],
  2: [
    { value: 'hp', label: '生命值' },
    { value: 'atk', label: '攻击力' },
    { value: 'def', label: '防御力' },
    { value: 'em', label: '元素精通' },
    { value: 'er', label: '充能效率' }
  ],
  3: [
    { value: 'hp', label: '生命值' },
    { value: 'atk', label: '攻击力' },
    { value: 'def', label: '防御力' },
    { value: 'em', label: '元素精通' },
    { value: 'phys', label: '物理伤害加成' },
    { value: 'pyro', label: '火元素伤害加成' },
    { value: 'hydro', label: '水元素伤害加成' },
    { value: 'electro', label: '雷元素伤害加成' },
    { value: 'cryo', label: '冰元素伤害加成' },
    { value: 'anemo', label: '风元素伤害加成' },
    { value: 'dendro', label: '草元素伤害加成' },
    { value: 'geo', label: '岩元素伤害加成' }
  ],
  4: [
    { value: 'hp', label: '生命值' },
    { value: 'atk', label: '攻击力' },
    { value: 'def', label: '防御力' },
    { value: 'em', label: '元素精通' },
    { value: 'cr', label: '暴击率' },
    { value: 'cd', label: '暴击伤害' }
  ]
};
const ARTIFACT_SUBSTATS = [
  { value: 'hp', label: '生命值' },
  { value: 'atk', label: '攻击力' },
  { value: 'def', label: '防御力' },
  { value: 'hp_pct', label: '生命值百分比' },
  { value: 'atk_pct', label: '攻击力百分比' },
  { value: 'def_pct', label: '防御力百分比' },
  { value: 'em', label: '元素精通' },
  { value: 'er', label: '充能效率' },
  { value: 'cr', label: '暴击率' },
  { value: 'cd', label: '暴击伤害' }
];
// 5* 圣遗物副词条单次强化四档数值（与游戏一致），期望 = 四档平均，价格 = 1/期望
const SUBSTAT_ROLL_AVG = {
  hp: (239 + 269 + 299 + 329) / 4,
  atk: (16 + 18 + 20 + 22) / 4,
  def: (20 + 23 + 26 + 29) / 4,
  hp_pct: (4.08 + 4.66 + 5.25 + 5.83) / 4,
  atk_pct: (4.08 + 4.66 + 5.25 + 5.83) / 4,
  def_pct: (5.10 + 5.83 + 6.56 + 7.29) / 4,
  em: (19 + 21 + 23 + 25) / 4,
  er: (4.08 + 4.66 + 5.25 + 5.83) / 4,
  cr: (2.72 + 3.11 + 3.50 + 3.89) / 4,
  cd: (5.44 + 6.22 + 7.00 + 7.77) / 4
};
const SUBSTAT_PRICE = Object.fromEntries(
  Object.entries(SUBSTAT_ROLL_AVG).map(([k, avg]) => [k, 1 / avg])
);
/** 5* 圣遗物副词条四档数值（启圣之尘重随用），与 SUBSTAT_ROLL_AVG 对应 */
const SUBSTAT_ROLL_TIERS = {
  hp: [239, 269, 299, 329],
  atk: [16, 18, 20, 22],
  def: [20, 23, 26, 29],
  hp_pct: [4.08, 4.66, 5.25, 5.83],
  atk_pct: [4.08, 4.66, 5.25, 5.83],
  def_pct: [5.10, 5.83, 6.56, 7.29],
  em: [19, 21, 23, 25],
  er: [4.08, 4.66, 5.25, 5.83],
  cr: [2.72, 3.11, 3.50, 3.89],
  cd: [5.44, 6.22, 7.00, 7.77]
};
const MAIN_STAT_RANGES = {
  hp: [717, 4780],
  flat_atk: [47, 311],
  atk: [7.0, 46.6],
  def: [8.7, 58.3],
  hp_pct: [7.0, 46.6],
  atk_pct: [7.0, 46.6],
  def_pct: [8.7, 58.3],
  em: [28, 186.5],
  er: [7.8, 51.8],
  phys: [8.7, 58.3],
  pyro: [7.0, 46.6],
  hydro: [7.0, 46.6],
  electro: [7.0, 46.6],
  cryo: [7.0, 46.6],
  anemo: [7.0, 46.6],
  dendro: [7.0, 46.6],
  geo: [7.0, 46.6],
  cr: [4.7, 31.1],
  cd: [9.3, 62.2]
};
const BUFF_CONTENT_OPTIONS = {
  0: [
    { value: 'hp', label: '生命值', step: 'any' },
    { value: 'atk', label: '攻击力', step: 'any' },
    { value: 'def', label: '防御力', step: 'any' },
    { value: 'em', label: '元素精通', step: '1', lockPercent: true },
    { value: 'er', label: '充能效率', step: 'any', lockPercentChecked: true }
  ],
  1: [
    { value: 'hpMult', label: '生命值倍率加成', step: 'any', lockPercentChecked: true },
    { value: 'atkMult', label: '攻击力倍率加成', step: 'any', lockPercentChecked: true },
    { value: 'defMult', label: '防御力倍率加成', step: 'any', lockPercentChecked: true },
    { value: 'emMult', label: '元素精通倍率加成', step: 'any', lockPercentChecked: true },
    { value: 'flatDmg', label: '固定伤害加成', step: 'any', lockPercent: true }
  ],
  2: [{ value: 'dmgBonus', label: '百分比增伤', step: 'any', lockPercentChecked: true }],
  3: [
    { value: 'critRate', label: '暴击加成', step: 'any', lockPercentChecked: true },
    { value: 'critDmg', label: '暴击伤害加成', step: 'any', lockPercentChecked: true }
  ],
  4: [{ value: 'reaction', label: '反应系数加成', step: 'any', lockPercentChecked: true }],
  5: [{ value: 'defReduct', label: '降低敌人防御力', step: 'any', lockPercentChecked: true }],
  6: [{ value: 'resistReduct', label: '降低敌人抗性', step: 'any', lockPercentChecked: true }],
  7: [{ value: 'ascend', label: '百分比擢升', step: 'any', lockPercentChecked: true }],
  8: [{ value: 'special', label: '百分比增伤', step: 'any', lockPercentChecked: true }]
};
const BUFF_PANELS = [
  { title: '属性区' },
  { title: '倍率区' },
  { title: '增伤区' },
  { title: '双暴区' },
  { title: '反应区' },
  { title: '防御区' },
  { title: '抗性区' },
  { title: '擢升区', note: '独立乘区：每个不同 buff 单独乘算' },
  { title: '特殊独立乘区', note: '独立乘区：每个不同 buff 单独乘算，e.g. 丝柯克锁配队天赋' }
];
/** buff 加成内容 → 乘区标题（用于循环面板按乘区分类） */
const BUFF_CONTENT_TO_ZONE = {
  hp: '属性区', atk: '属性区', def: '属性区', em: '属性区', er: '属性区',
  hpMult: '倍率区', atkMult: '倍率区', defMult: '倍率区', emMult: '倍率区', flatDmg: '倍率区',
  dmgBonus: '增伤区',
  critRate: '双暴区', critDmg: '双暴区',
  reaction: '反应区',
  defReduct: '防御区',
  resistReduct: '抗性区',
  ascend: '擢升区',
  special: '特殊独立乘区'
};
const BUFF_COLUMNS = ['加成名', '加成内容', '数值', '触发条件', '持续时间'];
const BASE_RESIST_IDS = ['resistPhys', 'resistPyro', 'resistHydro', 'resistElectro', 'resistCryo', 'resistAnemo', 'resistDendro', 'resistGeo'];
const CYCLE_AMPLIFY_OPTIONS = [
  { value: '', label: '无' },
  { value: 'vaporize', label: '蒸发' },
  { value: 'melt', label: '融化' }
];
const CYCLE_ELEMENT_OPTIONS = [
  { value: 'phys', label: '物理' },
  { value: 'pyro', label: '火' },
  { value: 'hydro', label: '水' },
  { value: 'electro', label: '雷' },
  { value: 'cryo', label: '冰' },
  { value: 'anemo', label: '风' },
  { value: 'dendro', label: '草' },
  { value: 'geo', label: '岩' }
];
