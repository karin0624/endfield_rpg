import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Material } from "@babylonjs/core/Materials/material";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Ray } from "@babylonjs/core/Culling/ray";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { battleLayout, getFormationPositions, type BattleActorLayout } from "./battleLayout";
import type { BattleSettings } from "./battleSettings";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
const CONTACT_OFFSET = 0.01;
const SHADOW_OFFSET = 0.005;
const GROUND_RAY_ORIGIN_Y = 100;
const GROUND_RAY_LENGTH = 300;

interface PreviewCounts {
  ally: number;
  enemy: number;
}

interface SceneActor {
  readonly layout: BattleActorLayout;
  readonly order: number;
  readonly anchor: TransformNode;
  readonly shadow: Mesh;
  groundY: number | undefined;
}

export function createBattleScene(canvas: HTMLCanvasElement, initialSettings: BattleSettings) {
  const engine = new Engine(canvas, true);
  // 高DPIの端末でも地面の描画負荷を際限なく増やさない。
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 1.5));
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0.19, 0.29, 0.38, 1);
  const camera = new FreeCamera("battle-camera", Vector3.Zero(), scene);
  camera.minZ = 0.1;
  camera.maxZ = 200;
  let needsRender = true;
  let settings = initialSettings;
  const groundRoot = new TransformNode("ground", scene);
  const groundMeshes: AbstractMesh[] = [];
  const groundHeightCache = new Map<string, number | undefined>();
  let backdrop: Mesh | undefined;
  const actors: SceneActor[] = [];
  const actorCounts = battleLayout.actors.reduce<PreviewCounts>(
    (counts, actor) => ({ ...counts, [actor.team]: counts[actor.team] + 1 }),
    { ally: 0, enemy: 0 },
  );
  let previewCounts: PreviewCounts = { ...actorCounts };
  let placementWarnings: string[] = [];
  let groundedPlacement = "";

  const placementKey = (value: BattleSettings) => [
    value.groundScale,
    value.allyCenterX,
    value.allyCenterZ,
    value.allyStepX,
    value.allyStepZ,
    value.enemyCenterX,
    value.enemyCenterZ,
    value.enemyStepX,
    value.enemyStepZ,
  ].join(":");

  const applyCameraAndBackdrop = (next: BattleSettings) => {
    camera.position.set(next.cameraX, next.cameraY, next.cameraZ);
    camera.setTarget(new Vector3(next.targetX, next.targetY, next.targetZ));
    camera.fov = next.fovDegrees * Math.PI / 180;
    groundRoot.scaling.setAll(battleLayout.ground.scale * next.groundScale);
    if (backdrop) {
      backdrop.position.set(next.backdropX, next.backdropY, next.backdropZ);
      backdrop.scaling.setAll(next.backdropScale);
    }
  };

  const getGroundHeight = (x: number, z: number): number | undefined => {
    if (groundMeshes.length === 0) return undefined;
    const cacheKey = `${settings.groundScale}:${x}:${z}`;
    if (groundHeightCache.has(cacheKey)) return groundHeightCache.get(cacheKey);
    const ray = new Ray(
      new Vector3(x, GROUND_RAY_ORIGIN_Y, z),
      Vector3.Down(),
      GROUND_RAY_LENGTH,
    );
    // 複数メッシュを横切る地面でも、レイに最も近い交点を選ぶ。
    const picked = scene.pickWithRay(ray, mesh => groundMeshes.includes(mesh));
    const height = picked?.hit === true && picked.pickedPoint !== null
      ? picked.pickedPoint.y
      : undefined;
    groundHeightCache.set(cacheKey, height);
    return height;
  };

  const updateActorVisibility = () => {
    for (const actor of actors) {
      const visible = actor.order < previewCounts[actor.layout.team];
      actor.anchor.setEnabled(visible);
      actor.shadow.setEnabled(visible);
    }
  };

  const updateActorPositions = (updateGroundHeight: boolean) => {
    if (updateGroundHeight) placementWarnings = [];
    if (actors.length === 0) return;
    if (updateGroundHeight) {
      groundRoot.computeWorldMatrix(true);
      for (const mesh of groundMeshes) mesh.computeWorldMatrix(true);
    }
    const validationPositions = {
      ally: getFormationPositions(settings, "ally", actorCounts.ally),
      enemy: getFormationPositions(settings, "enemy", actorCounts.enemy),
    };
    const previewPositions = {
      ally: getFormationPositions(settings, "ally", previewCounts.ally),
      enemy: getFormationPositions(settings, "enemy", previewCounts.enemy),
    };

    // 保存可否は固定編成の全配置枠で検査する。確認人数1のときの表示だけは
    // 同じルールを1人へ再適用し、可視キャラが隊列の中心へ移るようにする。
    for (const actor of actors) {
      const position = validationPositions[actor.layout.team][actor.order];
      if (position === undefined) {
        throw new Error(`隊列の配置枠が不足しています: ${actor.layout.id}`);
      }
      const validationX = position.x * settings.groundScale;
      const validationZ = position.z * settings.groundScale;
      const validationY = updateGroundHeight
        ? getGroundHeight(validationX, validationZ)
        : undefined;
      if (updateGroundHeight && validationY === undefined) {
        placementWarnings.push(`${actor.layout.id}の足元が地面の範囲外です。配置を調整してください。`);
      }

      const displayPosition = actor.order < previewCounts[actor.layout.team]
        ? previewPositions[actor.layout.team][actor.order]
        : position;
      if (displayPosition === undefined) {
        throw new Error(`確認人数の配置枠が不足しています: ${actor.layout.id}`);
      }
      const worldX = displayPosition.x * settings.groundScale;
      const worldZ = displayPosition.z * settings.groundScale;
      const groundY = updateGroundHeight
        ? displayPosition === position
          ? validationY
          : getGroundHeight(worldX, worldZ)
        : actor.groundY;
      actor.anchor.position.x = worldX;
      actor.anchor.position.z = worldZ;
      if (groundY === undefined) {
        // 地面のない位置ではY=0へ補完せず、直前の有効な高さを保持する。
      } else {
        actor.groundY = groundY;
        actor.anchor.position.y = groundY + CONTACT_OFFSET;
      }
      actor.shadow.position.x = worldX;
      actor.shadow.position.z = worldZ;
      if (actor.groundY !== undefined) actor.shadow.position.y = actor.groundY + SHADOW_OFFSET;
    }
    updateActorVisibility();
  };

  // 通常画面には操作を接続せず、保存済みの初期構図をそのまま使う。
  const applySettings = (next: BattleSettings, updateGroundHeight = true) => {
    const nextPlacement = placementKey(next);
    const displayPlacementChanged = nextPlacement !== placementKey(settings);
    const groundingRequired = nextPlacement !== groundedPlacement;
    settings = next;
    applyCameraAndBackdrop(next);
    if (updateGroundHeight && groundingRequired) {
      // GLB上で配置ごとに実測した接地点へ足元を置く。立ち絵の大きさは変えない。
      updateActorPositions(true);
      groundedPlacement = nextPlacement;
    } else if (displayPlacementChanged) {
      // 連続入力中は重い地形判定をせず、XZだけを即時反映する。
      updateActorPositions(false);
    }
    needsRender = true;
  };

  applyCameraAndBackdrop(settings);

  const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  sky.intensity = 1.1;
  sky.groundColor = new Color3(0.3, 0.33, 0.3);
  const sun = new DirectionalLight("sun", new Vector3(-0.6, -1, -0.4), scene);
  sun.intensity = 1.7;

  const loadTexture = (path: string) => new Promise<Texture>((resolve, reject) => {
    const texture = new Texture(assetUrl(path), scene, false, true,
      Texture.TRILINEAR_SAMPLINGMODE,
      () => resolve(texture),
      (_message, error) => reject(new Error(`画像を読み込めません: ${path}`, { cause: error })),
    );
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  });

  const imageMaterial = (name: string, texture: Texture, transparent: boolean) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseTexture = texture;
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.backFaceCulling = false;
    if (transparent) {
      texture.hasAlpha = true;
      material.useAlphaFromDiffuseTexture = true;
      material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
      material.alphaCutOff = 0.4;
    }
    return material;
  };

  let disposed = false;
  const ready = (async () => {
    const [ground, background, ...portraits] = await Promise.all([
      ImportMeshAsync(assetUrl("ground/ground1.glb"), scene),
      loadTexture("backgrounds/landscape1.png"),
      ...battleLayout.actors.map(actor => loadTexture(actor.image)),
    ]);
    if (disposed) return;
    for (const mesh of ground.meshes) {
      if (!mesh.parent) mesh.parent = groundRoot;
      mesh.isPickable = true;
      groundMeshes.push(mesh);
    }
    backdrop = CreatePlane("backdrop", {
      width: battleLayout.backdrop.width, height: battleLayout.backdrop.height,
    }, scene);
    backdrop.material = imageMaterial("landscape", background, false);

    battleLayout.actors.forEach((actor, index) => {
      const order = actors.filter(candidate => candidate.layout.team === actor.team).length;
      const anchor = new TransformNode(`${actor.id}-feet`, scene);
      const height = actor.height;
      const width = height * actor.pixels[0] / actor.pixels[1];
      const plane = CreatePlane(actor.id, { width, height }, scene);
      plane.parent = anchor;
      // 画像の下端ではなく、実際の靴底・接地位置を原点にする。
      plane.position.x = width * (0.5 - actor.foot[0] / actor.pixels[0]);
      plane.position.y = height * (actor.foot[1] / actor.pixels[1] - 0.5);
      plane.billboardMode = Mesh.BILLBOARDMODE_Y;
      if (actor.flipX) {
        portraits[index].uScale = -1;
        portraits[index].uOffset = 1;
      }
      plane.material = imageMaterial(`${actor.id}-portrait`, portraits[index], true);

      const shadow = CreateDisc(`${actor.id}-shadow`, { radius: 1, tessellation: 48 }, scene);
      shadow.rotation.x = Math.PI / 2;
      shadow.scaling.set(actor.shadow[0], actor.shadow[1], 1);
      const shadowMaterial = new StandardMaterial(`${actor.id}-shadow`, scene);
      shadowMaterial.disableLighting = true;
      shadowMaterial.emissiveColor = new Color3(0.04, 0.05, 0.04);
      shadowMaterial.alpha = 0.25;
      shadowMaterial.backFaceCulling = false;
      shadow.material = shadowMaterial;
      actors.push({ layout: actor, order, anchor, shadow, groundY: undefined });
    });
    applySettings(settings);
    await scene.whenReadyAsync();
    if (disposed) return;
    engine.resize();
    scene.render();
    // この画面は静止画。重い地面を操作のないフレームでも描き続けない。
    engine.runRenderLoop(() => {
      if (!needsRender) return;
      scene.render();
      needsRender = false;
    });
  })();

  const resizeObserver = new ResizeObserver(() => {
    engine.resize();
    needsRender = true;
  });
  resizeObserver.observe(canvas);
  return {
    ready,
    applySettings,
    previewSettings(next: BattleSettings) {
      const groundingRequired = placementKey(next) !== groundedPlacement;
      applySettings(next, false);
      return groundingRequired;
    },
    setPreviewCounts(next: PreviewCounts) {
      if (!Number.isInteger(next.ally) || next.ally < 1 || next.ally > actorCounts.ally ||
          !Number.isInteger(next.enemy) || next.enemy < 1 || next.enemy > actorCounts.enemy) {
        throw new RangeError("確認人数は1人以上で固定編成の人数以下にしてください");
      }
      previewCounts = { ...next };
      updateActorPositions(true);
      needsRender = true;
    },
    getPlacementWarnings() {
      return [...placementWarnings];
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
