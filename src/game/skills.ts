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

export type ActiveSkillEffect =
  | { readonly type: "damage"; readonly amount: number }
  | { readonly type: "hp-recovery"; readonly amount: number };

export interface ActiveSkillDefinition extends SkillIdentity {
  readonly type: "active";
  readonly effect: ActiveSkillEffect;
  readonly mentalFatigueIncrease: number;
  readonly scenes: readonly SkillScene[];
  readonly target: SkillTarget;
}

export interface PassiveSkillDefinition extends SkillIdentity {
  readonly type: "passive";
  /** Add to the owner's basic attack power while learned; no activation. */
  readonly effect: { readonly type: "basic-attack-power-bonus"; readonly amount: number };
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
}
export interface SkillCatalog {
  readonly skills: readonly SkillDefinition[];
  readonly pools: readonly SkillPoolDefinition[];
  readonly characters: readonly CharacterSkillProfile[];
}
/** Initial learning survives return; expedition learning is reset by the return owner. */
export interface LearnedSkill {
  readonly skillId: string;
  readonly origin: "initial" | "expedition";
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

/** Only effect.amount is scaled, never the fatigue increase or other parameters.
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
    requireAmount(skill.effect.amount, "効果量");
    if (skill.type === "active") {
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
    if (profile.initialSkillIds !== null) {
      requireUniqueIds(profile.initialSkillIds, "初期スキル");
      for (const id of profile.initialSkillIds) skillById(catalog, id);
    }
  }
}
