import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { initialBattleCombatants } from "../content/initialBattle";
import type { BattleCombatantDefinition } from "../game/battle";
import {
  type BattleActorLayout,
  type BattleActorPlacement,
  type BattleEnvironment,
  createBattleLayout,
  type GroundingSample,
  projectActorPlacements,
} from "../presentation/battleLayout";
import { type BattleActorFrame, projectInitialBattleActors } from "../presentation/battleProjection";

export type { BattleEnvironment } from "../presentation/battleLayout";

import type { BattleSettings } from "../presentation/battleSettings";
import { canCullGround, hasGroundCullingProfile } from "../presentation/groundCulling";
import { assetFingerprint } from "./assetFingerprint";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
const CONTACT_OFFSET = 0.01;
const SHADOW_OFFSET = 0.005;
const GROUND_RAY_ORIGIN_Y = 100;
const GROUND_RAY_LENGTH = 300;

interface SceneActor {
  readonly layout: BattleActorLayout;
  readonly anchor: TransformNode;
  readonly plane: Mesh;
  readonly shadow: Mesh;
  readonly material: StandardMaterial;
  readonly texture: Texture;
  readonly shadowMaterial: StandardMaterial;
  paintedFrame?: BattleActorFrame;
  screenRect?: ScreenRect;
  groundY: number | undefined;
}

export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly markerX: number;
  readonly markerY: number;
  readonly spriteTop: number;
}

export interface BattleScene {
  readonly ready: Promise<void>;
  applySettings(next: BattleSettings, placements?: readonly BattleActorPlacement[]): void;
  previewSettings(next: BattleSettings, placements?: readonly BattleActorPlacement[]): boolean;
  getCombatantScreenRect(id: string): ScreenRect | undefined;
  getCombatantDepths(): readonly { readonly id: string; readonly depth: number }[];
  refreshCombatantScreenPositions(): void;
  /** Apply a confirmed display sample and paint it; no rules or effect clocks are run here. */
  paintBattleFrame(frame: readonly BattleActorFrame[]): void;
  getGroundingMeasurements(): readonly GroundingSample[];
  dispose(): void;
}

/** Asset paths select an environment; node/floor selection belongs to the caller. */
export const initialBattleEnvironment: BattleEnvironment = {
  ground: "ground/ground1.glb",
  background: "backgrounds/landscape1.png",
};

/** One canvas/engine/scene, owned by the current expedition. */
export function createBattleRenderer(canvas: HTMLCanvasElement, initialSettings: BattleSettings) {
  const engine = new Engine(canvas, true);
  // 高DPIの端末でも地面の描画負荷を際限なく増やさない。
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 1.5));
  const scene = new Scene(engine);
  // glTF PBR materials share a scene-owned BRDF texture whose RGBD decode is asynchronous.
  scene.addIsReadyCheck({ isReady: () => !scene.environmentBRDFTexture || scene.environmentBRDFTexture.isReady() });
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0.19, 0.29, 0.38, 1);
  const camera = new FreeCamera("battle-camera", Vector3.Zero(), scene);
  camera.minZ = 0.1;
  camera.maxZ = 200;
  const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  sky.intensity = 1.1;
  sky.groundColor = new Color3(0.3, 0.33, 0.3);
  const sun = new DirectionalLight("sun", new Vector3(-0.6, -1, -0.4), scene);
  sun.intensity = 1.7;

  let disposed = false;
  const settings = { current: initialSettings };
  let environment: { definition: BattleEnvironment; resources: ReturnType<typeof createEnvironment> } | undefined;
  return {
    beginBattle(
      combatants: readonly BattleCombatantDefinition[],
      definition = initialBattleEnvironment,
      initialFrame = projectInitialBattleActors(combatants),
    ): BattleScene {
      if (disposed) throw new Error("破棄済みの戦闘描画は再利用できません");
      if (
        environment?.definition.ground !== definition.ground ||
        environment.definition.background !== definition.background
      ) {
        environment?.resources.dispose();
        const selected = { ...definition };
        environment = {
          definition: selected,
          resources: createEnvironment(canvas, engine, scene, camera, settings, selected),
        };
      }
      return environment.resources.beginBattle(combatants, initialFrame);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      environment?.resources.dispose();
      environment = undefined;
      const release = () => {
        scene.dispose();
        engine.dispose();
      };
      // Close input and rendering now; already-started imports and BRDF decode still belong to this engine.
      // This readiness boundary belongs only to final renderer disposal, not to the next battle's ready().
      if (scene.isReady(false)) release();
      else void scene.whenReadyAsync().then(release);
    },
  };
}

function createEnvironment(
  canvas: HTMLCanvasElement,
  engine: Engine,
  scene: Scene,
  camera: FreeCamera,
  sharedSettings: { current: BattleSettings },
  definition: BattleEnvironment,
) {
  const environment = createBattleLayout([]);
  const groundRoot = new TransformNode("ground", scene);
  const groundMeshes: AbstractMesh[] = [];
  const groundHeightCache = new Map<string, number | undefined>();
  let cachedPlacement = "";
  let backdrop: Mesh | undefined;
  let groundAssets: AssetContainer | undefined;
  let environmentDisposed = false;
  let currentBattle: BattleScene | undefined;
  let environmentReady: Promise<void> | undefined;
  let groundFingerprint: string | undefined;
  const groundMaterialFaces = new Map<Material, boolean>();

  const textures = new Map<string, Promise<Texture>>();
  const ownedTextures = new Set<Texture>();
  const loadTexture = (path: string): Promise<Texture> => {
    const cached = textures.get(path);
    if (cached !== undefined) return cached;
    const loading = new Promise<Texture>((resolve, reject) => {
      const texture = new Texture(
        assetUrl(path),
        engine,
        false,
        true,
        Texture.TRILINEAR_SAMPLINGMODE,
        () => resolve(texture),
        (_message, error) => reject(new Error(`画像を読み込めません: ${path}`, { cause: error })),
      );
      ownedTextures.add(texture);
      texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    });
    textures.set(path, loading);
    return loading;
  };

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

  const loadGround = async () => {
    // Verify the same bytes imported by Babylon; do not issue another model request.
    const url = new URL(assetUrl(definition.ground), location.href);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`モデルを読み込めません: ${definition.ground} (${response.status})`);
    const bytes = await response.arrayBuffer();
    if (environmentDisposed || scene.isDisposed) return undefined;
    const fingerprint = hasGroundCullingProfile(definition) ? assetFingerprint(bytes) : undefined;
    // LoadAssetContainerAsync registers its own pending data with the scene until import completes.
    const preparation = LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
      rootUrl: new URL(".", url).href,
      pluginExtension: ".glb",
      name: "ground1.glb",
    }).then((assets) => {
      // Acquire native handles before waiting for independent identity metadata.
      if (environmentDisposed) {
        assets.dispose();
        return undefined;
      }
      groundAssets = assets;
      return assets;
    });
    const [assets, digest] = await Promise.all([preparation, fingerprint]);
    groundFingerprint = digest;
    return assets;
  };

  const loadEnvironment = () => {
    environmentReady ??= (async () => {
      const preparation = [loadGround(), loadTexture(definition.background)] as const;
      // A failed image must not report completion while a model import can still allocate GPU resources.
      const results = await Promise.allSettled(preparation);
      for (const result of results) if (result.status === "rejected") throw result.reason;
      const backgroundResult = results[1];
      if (backgroundResult.status !== "fulfilled" || environmentDisposed) return;
      // Own prepared materials before attaching meshes; failed environments never enter the rendered scene.
      groundAssets?.addAllToScene();
      for (const material of groundAssets?.materials ?? []) groundMaterialFaces.set(material, material.backFaceCulling);
      for (const mesh of groundAssets?.meshes ?? []) {
        if (!mesh.parent) mesh.parent = groundRoot;
        mesh.isPickable = true;
        groundMeshes.push(mesh);
      }
      const background = backgroundResult.value;
      backdrop = CreatePlane(
        "backdrop",
        { width: environment.backdrop.width, height: environment.backdrop.height },
        scene,
      );
      backdrop.material = imageMaterial("landscape", background, false);
    })();
    return environmentReady;
  };

  function beginBattle(
    combatants: readonly BattleCombatantDefinition[],
    initialFrame: readonly BattleActorFrame[],
  ): BattleScene {
    if (environmentDisposed) throw new Error("破棄済みの戦闘描画は再利用できません");
    currentBattle?.dispose();
    const layout = createBattleLayout(combatants);
    let needsRender = true;
    let settings = sharedSettings.current;
    const actors: SceneActor[] = [];
    let placements = projectActorPlacements(layout.actors, settings);
    let groundingMeasurements: GroundingSample[] = [];
    let groundedPlacement = "";

    const findActor = (id: string) => actors.find((actor) => actor.layout.id === id);

    const updateCombatantScreenPositions = () => {
      if (actors.length === 0) return;
      const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
      const transform = scene.getTransformMatrix();
      const scaleX = canvas.clientWidth / engine.getRenderWidth();
      const scaleY = canvas.clientHeight / engine.getRenderHeight();
      for (const actor of actors) {
        if (!actor.plane.isEnabled()) {
          actor.screenRect = undefined;
          continue;
        }
        actor.plane.computeWorldMatrix(true);
        const corners = actor.plane.getBoundingInfo().boundingBox.vectorsWorld;
        const projected = corners.map((point) => Vector3.Project(point, Matrix.Identity(), transform, viewport));
        const xs = projected.map((point) => point.x * scaleX);
        const ys = projected.map((point) => point.y * scaleY);
        const padding = 7;
        const spriteLeft = Math.max(0, Math.min(...xs));
        const spriteTop = Math.max(0, Math.min(...ys));
        const spriteRight = Math.min(canvas.clientWidth, Math.max(...xs));
        const spriteBottom = Math.min(canvas.clientHeight, Math.max(...ys));
        const left = Math.max(0, spriteLeft - padding);
        const top = Math.max(0, spriteTop - padding);
        const right = Math.min(canvas.clientWidth, spriteRight + padding);
        const bottom = Math.min(canvas.clientHeight, spriteBottom + padding);
        if (![left, top, right, bottom, spriteTop].every(Number.isFinite) || right <= left || bottom <= top) {
          actor.screenRect = undefined;
        } else {
          actor.screenRect = {
            left,
            top,
            width: right - left,
            height: bottom - top,
            markerX: (spriteLeft + spriteRight) / 2,
            markerY: spriteTop,
            spriteTop,
          };
        }
      }
    };

    const placementKey = (value: BattleSettings) =>
      [
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
      camera.fov = (next.fovDegrees * Math.PI) / 180;
      groundRoot.scaling.setAll(layout.ground.scale * next.groundScale);
      const cull = canCullGround(definition, next, groundFingerprint);
      for (const [material, original] of groundMaterialFaces) material.backFaceCulling = cull || original;
      if (backdrop) {
        backdrop.position.set(next.backdropX, next.backdropY, next.backdropZ);
        backdrop.scaling.setAll(next.backdropScale);
      }
    };

    const getGroundHeight = (x: number, z: number): number | undefined => {
      if (groundMeshes.length === 0) return undefined;
      const cacheKey = `${settings.groundScale}:${x}:${z}`;
      if (groundHeightCache.has(cacheKey)) return groundHeightCache.get(cacheKey);
      const ray = new Ray(new Vector3(x, GROUND_RAY_ORIGIN_Y, z), Vector3.Down(), GROUND_RAY_LENGTH);
      // 複数メッシュを横切る地面でも、レイに最も近い交点を選ぶ。
      const picked = scene.pickWithRay(ray, (mesh) => groundMeshes.includes(mesh));
      const height = picked?.hit === true && picked.pickedPoint !== null ? picked.pickedPoint.y : undefined;
      groundHeightCache.set(cacheKey, height);
      return height;
    };

    const updateActorPositions = (updateGroundHeight: boolean) => {
      if (updateGroundHeight) groundingMeasurements = [];
      if (actors.length === 0) return;
      if (updateGroundHeight) {
        groundRoot.computeWorldMatrix(true);
        for (const mesh of groundMeshes) mesh.computeWorldMatrix(true);
      }
      for (const actor of actors) {
        const placement = placements.find(({ id }) => id === actor.layout.id) as BattleActorPlacement;
        const validationY = updateGroundHeight
          ? getGroundHeight(placement.validationX, placement.validationZ)
          : undefined;
        if (updateGroundHeight) groundingMeasurements.push({ id: actor.layout.id, groundY: validationY ?? null });
        const worldX = placement.x;
        const worldZ = placement.z;
        const groundY = updateGroundHeight
          ? worldX === placement.validationX && worldZ === placement.validationZ
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
        if (actor.groundY !== undefined) {
          actor.shadow.position.y = actor.groundY + SHADOW_OFFSET;
        }
      }
    };

    // 通常画面には操作を接続せず、保存済みの初期構図をそのまま使う。
    const applySettings = (
      next: BattleSettings,
      updateGroundHeight = true,
      nextPlacements = projectActorPlacements(layout.actors, next),
    ) => {
      if (disposed) return;
      const nextPlacement = placementKey(next);
      if (nextPlacement !== cachedPlacement) {
        groundHeightCache.clear();
        cachedPlacement = nextPlacement;
      }
      const positionsChanged = JSON.stringify(placements) !== JSON.stringify(nextPlacements);
      placements = nextPlacements;
      const displayPlacementChanged = nextPlacement !== placementKey(settings) || positionsChanged;
      const groundingRequired = nextPlacement !== groundedPlacement || positionsChanged;
      settings = next;
      sharedSettings.current = next;
      applyCameraAndBackdrop(next);
      if (updateGroundHeight && groundingRequired) {
        // GLB上で配置ごとに実測した接地点へ足元を置く。立ち絵の大きさは変えない。
        updateActorPositions(true);
        if (actors.length > 0) groundedPlacement = nextPlacement;
      } else if (displayPlacementChanged) {
        // 連続入力中は重い地形判定をせず、XZだけを即時反映する。
        updateActorPositions(false);
      }
      needsRender = true;
    };

    applyCameraAndBackdrop(settings);

    let disposed = false;
    let finishCancellation: () => void = () => {};
    const cancelled = new Promise<undefined>((resolve) => {
      finishCancellation = () => resolve(undefined);
    });
    let cancelPreparation: (() => void) | undefined;
    const ready = (async () => {
      const preparation = [loadEnvironment(), ...layout.actors.map((actor) => loadTexture(actor.image))] as const;
      const settled = Promise.all(preparation).catch(async (error: unknown) => {
        await Promise.allSettled(preparation);
        throw error;
      });
      const loaded = await Promise.race([settled, cancelled]);
      if (disposed || loaded === undefined) return;
      const [, ...portraits] = loaded;

      layout.actors.forEach((actor, index) => {
        const sampled = initialFrame.find((frame) => frame.id === actor.id) as BattleActorFrame;
        const anchor = new TransformNode(`${actor.id}-feet`, scene);
        anchor.setEnabled(sampled.visible);
        const height = actor.height;
        const width = (height * actor.pixels[0]) / actor.pixels[1];
        const plane = CreatePlane(actor.id, { width, height }, scene);
        plane.parent = anchor;
        plane.setEnabled(sampled.visible);
        plane.visibility = sampled.opacity;
        // 画像の下端ではなく、実際の靴底・接地位置を原点にする。
        plane.position.x = width * (0.5 - actor.foot[0] / actor.pixels[0]);
        plane.position.y = height * (actor.foot[1] / actor.pixels[1] - 0.5);
        plane.billboardMode = Mesh.BILLBOARDMODE_Y;
        const portrait = new Texture(portraits[index].url, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
        portrait.wrapU = Texture.CLAMP_ADDRESSMODE;
        portrait.wrapV = Texture.CLAMP_ADDRESSMODE;
        if (actor.flipX) {
          portrait.uScale = -1;
          portrait.uOffset = 1;
        }
        const portraitMaterial = imageMaterial(`${actor.id}-portrait`, portrait, true);
        portraitMaterial.emissiveColor.set(...sampled.emissive);
        plane.material = portraitMaterial;

        const shadow = CreateDisc(`${actor.id}-shadow`, { radius: 1, tessellation: 48 }, scene);
        shadow.rotation.x = Math.PI / 2;
        shadow.scaling.set(actor.shadow[0], actor.shadow[1], 1);
        const shadowMaterial = new StandardMaterial(`${actor.id}-shadow`, scene);
        shadowMaterial.disableLighting = true;
        shadowMaterial.emissiveColor = new Color3(0.04, 0.05, 0.04);
        shadowMaterial.alpha = 0.25;
        shadowMaterial.backFaceCulling = false;
        shadow.material = shadowMaterial;
        shadow.setEnabled(sampled.visible);

        actors.push({
          layout: actor,
          anchor,
          plane,
          shadow,
          material: portraitMaterial,
          texture: portrait,
          shadowMaterial,
          paintedFrame: sampled,
          groundY: undefined,
        });
      });
      applySettings(settings);
      // Scene-wide readiness includes abandoned imports. Only this battle's meshes matter.
      const meshes = [
        ...groundMeshes,
        ...(backdrop ? [backdrop] : []),
        ...actors.flatMap((actor) => [actor.plane, actor.shadow]),
      ];
      await new Promise<void>((resolve) => {
        let preparationFrame: number | undefined;
        cancelPreparation = () => {
          if (preparationFrame !== undefined) cancelAnimationFrame(preparationFrame);
          resolve();
        };
        const prepare = () => {
          if (disposed || meshes.every((mesh) => mesh.isReady(true))) {
            cancelPreparation = undefined;
            resolve();
          } else {
            preparationFrame = requestAnimationFrame(prepare);
          }
        };
        prepare();
      });
      if (disposed) return;
      engine.resize();
      scene.render();
      updateCombatantScreenPositions();
      needsRender = false;
      // この画面は静止画。重い地面を操作のないフレームでも描き続けない。
      engine.runRenderLoop(renderBattle);
    })();

    function renderBattle() {
      if (disposed || !needsRender) return;
      scene.render();
      updateCombatantScreenPositions();
      needsRender = false;
    }

    const resizeEngine = () => {
      const width = engine.getRenderWidth();
      const height = engine.getRenderHeight();
      engine.resize();
      // 初回の監視通知や札の寸法変更では、描画済みの地面を描き直さない。
      if (width !== engine.getRenderWidth() || height !== engine.getRenderHeight()) needsRender = true;
    };
    const contextRestored = engine.onContextRestoredObservable.add(() => {
      needsRender = true;
    });
    const resizeObserver = new ResizeObserver(resizeEngine);
    resizeObserver.observe(canvas);
    const battle: BattleScene = {
      ready,
      applySettings(next, nextPlacements) {
        applySettings(next, true, nextPlacements);
      },
      previewSettings(next, nextPlacements = projectActorPlacements(layout.actors, next)) {
        if (disposed) return false;
        const pending =
          placementKey(next) !== groundedPlacement || JSON.stringify(placements) !== JSON.stringify(nextPlacements);
        applySettings(next, false, nextPlacements);
        return pending;
      },
      /** キャッシュした全戦闘者の画面範囲。味方への演出も実投影を使う。 */
      getCombatantScreenRect(id: string): ScreenRect | undefined {
        const actor = findActor(id);
        if (actor === undefined) return undefined;
        return actor.screenRect;
      },
      getCombatantDepths() {
        camera.computeWorldMatrix();
        const ray = camera.getForwardRay();
        return actors.map((actor) => {
          actor.anchor.computeWorldMatrix(true);
          return {
            id: actor.layout.id,
            depth: Vector3.Dot(actor.anchor.getAbsolutePosition().subtract(ray.origin), ray.direction),
          };
        });
      },
      /** 現在の寸法・変換から投影を更新する。実寸法の変更だけ次の描画へまとめる。 */
      refreshCombatantScreenPositions() {
        if (disposed || actors.length === 0) return;
        resizeEngine();
        scene.updateTransformMatrix();
        updateCombatantScreenPositions();
      },
      paintBattleFrame(frame) {
        if (disposed) return;
        for (const sampled of frame) {
          const actor = findActor(sampled.id);
          if (!actor) continue;
          const previous = actor.paintedFrame;
          if (
            previous?.visible === sampled.visible &&
            previous.opacity === sampled.opacity &&
            previous.emissive.every((value, index) => value === sampled.emissive[index])
          )
            continue;
          actor.paintedFrame = sampled;
          actor.anchor.setEnabled(sampled.visible);
          actor.plane.setEnabled(sampled.visible);
          actor.shadow.setEnabled(sampled.visible);
          actor.plane.visibility = sampled.opacity;
          actor.material.emissiveColor.set(...sampled.emissive);
          if (!sampled.visible) actor.screenRect = undefined;
          needsRender = true;
        }
        if (!needsRender) return;
        scene.render();
        updateCombatantScreenPositions();
        needsRender = false;
      },
      getGroundingMeasurements() {
        return groundingMeasurements;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        finishCancellation();
        cancelPreparation?.();
        cancelPreparation = undefined;
        engine.onContextRestoredObservable.remove(contextRestored);
        resizeObserver.disconnect();
        engine.stopRenderLoop(renderBattle);
        for (const actor of actors) {
          actor.anchor.dispose();
          actor.shadow.dispose();
          actor.material.dispose(false, false);
          actor.shadowMaterial.dispose(false, false);
          actor.texture.dispose();
        }
        actors.length = 0;
        if (currentBattle === battle) currentBattle = undefined;
      },
    };
    currentBattle = battle;
    return battle;
  }

  return {
    beginBattle,
    dispose() {
      if (environmentDisposed) return;
      environmentDisposed = true;
      currentBattle?.dispose();
      groundAssets?.dispose();
      groundMeshes.length = 0;
      groundMaterialFaces.clear();
      groundHeightCache.clear();
      backdrop?.material?.dispose(false, false);
      backdrop?.dispose();
      groundRoot.dispose();
      for (const texture of ownedTextures) texture.dispose();
      ownedTextures.clear();
      textures.clear();
    },
  };
}

/** Standalone demo/editor keep ownership of their single scene. */
export function createBattleScene(
  canvas: HTMLCanvasElement,
  initialSettings: BattleSettings,
  combatants: readonly BattleCombatantDefinition[] = initialBattleCombatants,
  initialFrame: readonly BattleActorFrame[] = projectInitialBattleActors(combatants),
): BattleScene {
  const renderer = createBattleRenderer(canvas, initialSettings);
  const battle = renderer.beginBattle(combatants, initialBattleEnvironment, initialFrame);
  return { ...battle, dispose: () => renderer.dispose() };
}
