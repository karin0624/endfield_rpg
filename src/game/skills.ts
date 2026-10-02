export type SkillTier = "normal" | "advanced" | "ultimate";
export type SkillScene = "battle" | "branch";
/** Both require a living target; single-ally includes the user. */
export type SkillTarget = "single-enemy" | "single-ally";

interface SkillIdentity {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: SkillTier;
}

export interface SkillPower {
  readonly amount: number;
  readonly scaling: { readonly stat: "attackPower" | "maxHp"; readonly coefficient: number };
}
export type ActiveSkillEffect = SkillPower & { readonly type: "damage" | "hp-recovery" };

export interface ActiveSkillDefinition extends SkillIdentity {
  readonly type: "active";
  readonly effect: ActiveSkillEffect;
  readonly mentalFatigueIncrease: number;
  readonly scenes: readonly SkillScene[];
  readonly target: SkillTarget;
}

export interface PassiveSkillDefinition extends SkillIdentity {
  readonly type: "passive";
  /** Add to basic attack power without activation. Each entry is the total
   * effect at that rank; length is the individual cap. */
  readonly effect: { readonly type: "basic-attack-power-bonus"; readonly rankAmounts: readonly number[] };
  readonly mentalFatigueIncrease?: never;
  readonly scenes?: never;
  readonly target?: never;
}
export type SkillDefinition = ActiveSkillDefinition | PassiveSkillDefinition;

export interface SkillPoolDefinition {
  readonly id: string;
  readonly candidates: Readonly<Record<SkillTier, readonly string[]>>;
}
export interface CharacterSkillProfile {
  readonly characterId: string;
  readonly poolId: string;
  /** null means undecided, distinct from an agreed empty initial set. */
  readonly initialSkillIds: readonly string[] | null;
  /** Optional until a character's unlock table is authored. Never random candidates. */
  readonly guaranteedUnlocks?: readonly { readonly skillId: string; readonly level: number }[];
}
export interface SkillCatalog {
  readonly skills: readonly SkillDefinition[];
  readonly pools: readonly SkillPoolDefinition[];
  readonly characters: readonly CharacterSkillProfile[];
}
/** Acquisition route and lifetime are independent. Active records have no rank. */
export type LearnedSkill = {
  readonly skillId: string;
  readonly origin: "initial" | "expedition";
  readonly acquisition: "initial" | "guaranteed" | "choice";
} & ({ readonly type: "active"; readonly rank?: never } | { readonly type: "passive"; readonly rank: number });

/** Unrounded base amount. Fatigue and other modifiers belong to the use owner. */
export function activeSkillBaseAmount(
  skill: ActiveSkillDefinition,
  stats: { readonly attackPower: number; readonly maxHp: number },
): number {
  const value = stats[skill.effect.scaling.stat];
  requireAmount(value, "参照能力値");
  const amount = skill.effect.amount + value * skill.effect.scaling.coefficient;
  requireAmount(amount, "効果量");
  return amount;
}
export function passiveSkillAmount(skill: PassiveSkillDefinition, rank: number): number {
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > skill.effect.rankAmounts.length)
    throw new RangeError("パッシブランクが上限外です");
  return skill.effect.rankAmounts[rank - 1];
}

/** Classification only: candidate drawing and learning belong to separate operations. */
export function skillTierForLevel(level: number): SkillTier {
  if (!Number.isSafeInteger(level) || level < 2) throw new RangeError("到達レベルは2以上の安全な整数です");
  if (level % 10 === 0) return "ultimate";
  return level % 5 === 0 ? "advanced" : "normal";
}

export function skillById(catalog: SkillCatalog, id: string): SkillDefinition {
  const skill = catalog.skills.find((candidate) => candidate.id === id);
  if (!skill) throw new Error(`スキル定義がありません: ${id}`);
  return skill;
}

/** Only the evaluated base effect is scaled, never the fatigue increase or other parameters.
 * The caller applies B*m(f) with pre-use numeric fatigue f, then adds fatigue,
 * then calculates symptoms. This module supplies no curve or use operation.
 */
export function mentalFatigueAffectedQuantity(
  skill: SkillDefinition | { readonly type: "basic-attack" },
): ActiveSkillEffect["type"] | null {
  return skill.type === "active" && skill.mentalFatigueIncrease > 0 ? skill.effect.type : null;
}

function requireUniqueIds(ids: readonly string[], label: string): void {
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length)
    throw new Error(`${label}IDが空または重複しています`);
}
function requireAmount(amount: number, label: string): void {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label}は有限の非負数です`);
}

/** Validates authored typed data and its references; not a saved-data parser. */
export function validateSkillCatalog(catalog: SkillCatalog, characters: readonly { readonly id: string }[]): void {
  requireUniqueIds(
    catalog.skills.map(({ id }) => id),
    "スキル",
  );
  requireUniqueIds(
    catalog.pools.map(({ id }) => id),
    "候補群",
  );
  requireUniqueIds(
    catalog.characters.map(({ characterId }) => characterId),
    "キャラクター対応",
  );
  const tiers: readonly SkillTier[] = ["normal", "advanced", "ultimate"];
  for (const skill of catalog.skills) {
    if (!skill.name.trim() || !skill.description.trim() || !tiers.includes(skill.tier))
      throw new Error(`スキルの名称・説明・分類が不正です: ${skill.id}`);
    if (skill.type === "active") {
      requireAmount(skill.effect.amount, "効果量");
      if (!["attackPower", "maxHp"].includes(skill.effect.scaling.stat)) throw new Error("参照能力値が不正です");
      if (!Number.isFinite(skill.effect.scaling.coefficient) || skill.effect.scaling.coefficient <= 0)
        throw new Error("能力値係数は有限の正数です");
      requireAmount(skill.mentalFatigueIncrease, "精神疲労増加量");
      if (
        skill.scenes.length === 0 ||
        new Set(skill.scenes).size !== skill.scenes.length ||
        skill.scenes.some((scene) => scene !== "battle" && scene !== "branch")
      )
        throw new Error(`使用場面が不正です: ${skill.id}`);
      if (
        (skill.effect.type === "damage" && (skill.target !== "single-enemy" || skill.scenes.includes("branch"))) ||
        (skill.effect.type === "hp-recovery" && skill.target !== "single-ally") ||
        (skill.effect.type !== "damage" && skill.effect.type !== "hp-recovery")
      )
        throw new Error(`効果・対象条件が不正です: ${skill.id}`);
    } else if (
      skill.type !== "passive" ||
      skill.effect.type !== "basic-attack-power-bonus" ||
      skill.mentalFatigueIncrease !== undefined ||
      skill.scenes !== undefined ||
      skill.target !== undefined
    )
      throw new Error(`パッシブ定義が不正です: ${skill.id}`);
    else {
      if (!skill.effect.rankAmounts.length) throw new Error("パッシブ上限がありません");
      for (const amount of skill.effect.rankAmounts) requireAmount(amount, "効果量");
    }
  }
  for (const pool of catalog.pools) {
    for (const tier of tiers) {
      const ids = pool.candidates[tier];
      requireUniqueIds(ids, "候補スキル");
      if (ids.length < 3) throw new Error(`3択に必要な候補がありません: ${pool.id}/${tier}`);
      for (const id of ids) {
        if (skillById(catalog, id).tier !== tier) throw new Error(`候補の分類が不正です: ${pool.id}/${id}`);
      }
    }
  }
  for (const profile of catalog.characters) {
    if (!characters.some(({ id }) => id === profile.characterId))
      throw new Error(`キャラクター参照がありません: ${profile.characterId}`);
    if (!catalog.pools.some(({ id }) => id === profile.poolId))
      throw new Error(`候補群参照がありません: ${profile.poolId}`);
    const unlocks = profile.guaranteedUnlocks ?? [];
    requireUniqueIds(
      unlocks.map(({ skillId }) => skillId),
      "保証スキル",
    );
    for (const unlock of unlocks) {
      if (
        !Number.isSafeInteger(unlock.level) ||
        unlock.level < 2 ||
        skillById(catalog, unlock.skillId).type !== "active"
      )
        throw new Error("保証解禁はLv2以上のアクティブです");
      if (profile.initialSkillIds?.includes(unlock.skillId)) throw new Error("初期と保証解禁が重複しています");
    }
    if (profile.initialSkillIds !== null) {
      requireUniqueIds(profile.initialSkillIds, "初期スキル");
      for (const id of profile.initialSkillIds) skillById(catalog, id);
    }
  }
}
