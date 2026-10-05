import { describe, expect, it } from "vitest";
import { initialBattleCombatants } from "../content/initialBattle";
import { projectSequencePositions, projectTetraFaces } from "./battleGeometry";
import {
  projectEnemyOverlay,
  projectMobileLabelSeparation,
  projectPartyOverflow,
  projectTargetMarker,
} from "./battlePlacement";
import { createDebugBattleModel, projectDebugBattle, reduceDebugBattle } from "./debugBattleModel";

const input = { combatants: initialBattleCombatants, enemyDepths: [{ id: "slime-2", depth: 5 }], editor: false };
const sprite = { left: 100, top: 110, width: 80, height: 90, markerX: 140, markerY: 117, spriteTop: 117 };

describe("実寸からの戦闘札と演出位置の投影", () => {
  it("SVGマーカーを奥から4面で描き、頂点と彫刻を回転しても保持する", () => {
    const faces = projectTetraFaces(0);
    expect(faces.map(({ index }) => index)).toEqual([2, 0, 1, 3]);
    expect(faces.find(({ index }) => index === 0)).toMatchObject({
      points: "32.000,19.365 51.053,12.920 12.947,12.920",
      color: "var(--face-top)",
      engraving: [],
    });
    expect(faces.filter(({ index }) => index !== 0).map(({ engraving }) => engraving.length)).toEqual([2, 2, 2]);
    expect(
      projectTetraFaces(Math.PI / 2)
        .map(({ index }) => index)
        .sort(),
    ).toEqual([0, 1, 2, 3]);
  });

  it("現在の選択に札とmarkerを結び、狭幅でも札の上へmarkerを配置する", () => {
    const state = reduceDebugBattle(createDebugBattleModel(input), input, { type: "scene-ready", owner: 0 }).state;
    const frame = projectDebugBattle(state, input).view;
    expect(frame?.markerId).toBe("slime-2");
    const desktop = projectEnemyOverlay(sprite, true, 0, 1440);
    expect(desktop).toEqual({ box: sprite, x: 140, y: 109 });
    const mobile = projectEnemyOverlay(sprite, true, 0, 390);
    expect(mobile).toEqual({ box: sprite, x: 140, y: 79 });
    expect(projectTargetMarker(sprite, { visible: true, top: 79, height: 30 }, 40)).toEqual({ x: 140, y: 45 });
    expect(
      projectMobileLabelSeparation(
        390,
        { left: 110, right: 170, top: 15, bottom: 55 },
        { left: 90, right: 190, top: 30, bottom: 70 },
        70,
        40,
      ),
    ).toBe(44);
    expect(
      projectMobileLabelSeparation(
        1440,
        { left: 110, right: 170, top: 15, bottom: 55 },
        { left: 90, right: 190, top: 30, bottom: 70 },
        70,
        40,
      ),
    ).toBe(70);
    expect(
      projectMobileLabelSeparation(
        390,
        { left: 110, right: 170, top: 15, bottom: 55 },
        { left: 200, right: 300, top: 30, bottom: 70 },
        70,
        40,
      ),
    ).toBe(70);
    expect(projectEnemyOverlay(undefined, true, 0, 390)).toBeNull();
    expect(projectTargetMarker(undefined, { visible: false, top: 0, height: 0 }, 40)).toBeNull();
  });

  it("実コアで撃破した後の不可視札を消し、flowの味方札ではboardのoverflowを解放しない", () => {
    let state = reduceDebugBattle(createDebugBattleModel(input), input, { type: "scene-ready", owner: 0 }).state;
    for (let turn = 0; turn < 2; turn++) {
      state = reduceDebugBattle(state, input, { type: "attack" }).state;
      state = reduceDebugBattle(state, input, { type: "playback", event: { type: "advance", elapsedMs: 3000 } }).state;
    }
    const enemy = projectDebugBattle(state, input).view?.enemies.find(({ id }) => id === "slime-2");
    expect(enemy?.visible).toBe(false);
    expect(projectEnemyOverlay(sprite, enemy?.visible ?? false, 1, 390)).toBeNull();
    expect(projectTargetMarker(sprite, { visible: false, top: 79, height: 30 }, 40)).toBeNull();
    expect(projectPartyOverflow(true, 600, [540, 630])).toBe(true);
    expect(projectPartyOverflow(true, 600, [540, 580])).toBe(false);
    expect(projectPartyOverflow(false, 600, [540, 630])).toBe(false);
  });

  it("確定攻撃のactorと着弾cueを実寸へ合わせ、画面外のspriteにはステージ内の位置を与える", () => {
    let state = reduceDebugBattle(createDebugBattleModel(input), input, { type: "scene-ready", owner: 0 }).state;
    state = reduceDebugBattle(state, input, { type: "attack" }).state;
    const frame = projectDebugBattle(state, input).view;
    expect(frame?.sequence).toMatchObject({
      actorId: "player",
      targetId: "slime-2",
      label: "通常攻撃",
      phase: "actor",
    });
    const measure = {
      stage: { width: 390, height: 219 },
      actor: { width: 120, height: 30 },
      impact: { width: 96, height: 96 },
      number: { width: 48, height: 50 },
    };
    expect(projectSequencePositions({ ...measure, actorRect: sprite, targetRect: sprite })).toEqual({
      actor: { x: 140, y: 194 },
      impact: { x: 140, y: 146 },
      number: { x: 140, y: 146 },
    });
    // A projected sprite can be outside the viewport even at a valid forward depth.
    expect(projectSequencePositions(measure)).toEqual({
      actor: { x: 280.8, y: 179.4 },
      impact: { x: 280.8, y: 131.4 },
      number: { x: 280.8, y: 131.4 },
    });
  });
});
