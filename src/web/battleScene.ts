import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Material } from "@babylonjs/core/Materials/material";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { battleLayout } from "./battleLayout";
import type { BattleSettings } from "./battleSettings";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;

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
  let backdrop: Mesh | undefined;
  const actors: { anchor: TransformNode; shadow: Mesh; position: readonly number[] }[] = [];
  // 通常画面には操作を接続せず、保存済みの初期構図をそのまま使う。
  const applySettings = (next: BattleSettings) => {
    settings = next;
    camera.position.set(next.cameraX, next.cameraY, next.cameraZ);
    camera.setTarget(new Vector3(next.targetX, next.targetY, next.targetZ));
    camera.fov = next.fovDegrees * Math.PI / 180;
    groundRoot.scaling.setAll(battleLayout.ground.scale * next.groundScale);
    if (backdrop) {
      backdrop.position.set(next.backdropX, next.backdropY, next.backdropZ);
      backdrop.scaling.setAll(next.backdropScale);
    }
    // GLB上で実測した同じ接地点を保つ。立ち絵の大きさは変えない。
    for (const actor of actors) {
      actor.anchor.position.copyFrom(Vector3.FromArray(actor.position).scale(next.groundScale));
      actor.shadow.position.copyFrom(actor.anchor.position);
      actor.shadow.position.y += 0.005;
    }
    needsRender = true;
  };
  applySettings(settings);

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
    }
    backdrop = CreatePlane("backdrop", {
      width: battleLayout.backdrop.width, height: battleLayout.backdrop.height,
    }, scene);
    backdrop.material = imageMaterial("landscape", background, false);

    battleLayout.actors.forEach((actor, index) => {
      const anchor = new TransformNode(`${actor.id}-feet`, scene);
      anchor.position.copyFrom(Vector3.FromArray(actor.position));
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
      shadow.position.copyFrom(anchor.position);
      shadow.position.y += 0.005;
      shadow.rotation.x = Math.PI / 2;
      shadow.scaling.set(actor.shadow[0], actor.shadow[1], 1);
      const shadowMaterial = new StandardMaterial(`${actor.id}-shadow`, scene);
      shadowMaterial.disableLighting = true;
      shadowMaterial.emissiveColor = new Color3(0.04, 0.05, 0.04);
      shadowMaterial.alpha = 0.25;
      shadowMaterial.backFaceCulling = false;
      shadow.material = shadowMaterial;
      actors.push({ anchor, shadow, position: actor.position });
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
