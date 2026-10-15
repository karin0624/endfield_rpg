import { describe, expect, it } from "vitest";
import { type CampaignCommand, type CampaignModel, createCampaignModel, reduceCampaign } from "./campaignModel";
import { projectCampaign } from "./campaignProjection";

function home() {
  let state = createCampaignModel();
  for (const command of ["new-game", "accept", "home"] as const) state = act(state, command);
  return state;
}
const act = (state: CampaignModel, command: CampaignCommand) =>
  reduceCampaign(state, { type: "command", command }).state;
describe("採用Homeの任意準備・systemと街の既存契約", () => {
  it("準備と街menuの戻る操作を反復してもclock・所持・加入を変えない", () => {
    let state = home();
    const game = structuredClone(state.context.game);
    state = act(act(state, "prepare"), "close-panel");
    expect(state.context.hubPanel).toBe("normal");
    expect(state.context.game).toEqual(game);
    state = act(act(state, "destinations"), "town");
    state = act(act(state, "menu"), "close-panel");
    expect(state.value).toBe("town");
    state = reduceCampaign(act(state, "menu"), { type: "escape" }).state;
    expect(state.value).toBe("town");
    state = reduceCampaign(state, { type: "escape" }).state;
    expect(state.value).toBe("home");
    expect(state.context.focus).toEqual({ kind: "command", command: "prepare" });
    expect(state.context.game).toEqual(game);
  });
  it("準備は0持込みで進め、閲覧・取消・装備往復は時計と在庫を動かさない", () => {
    const start = home(),
      game = structuredClone(start.context.game);
    let state = act(start, "prepare");
    expect(state.context.hubPanel).toBe("preparation");
    state = reduceCampaign(state, { type: "carry-changed", quantity: 1 }).state;
    state = act(state, "equipment");
    expect(state.value).toBe("equipment");
    state = act(state, "home");
    expect(state.context.hubPanel).toBe("preparation");
    expect(state.context.carryQuantity).toBe(1);
    expect(state.context.game).toEqual(game);
    state = reduceCampaign(state, { type: "escape" }).state;
    expect(state.context.hubPanel).toBe("normal");
    expect(state.context.focus).toEqual({ kind: "command", command: "prepare" });
    state = act(state, "equipment");
    state = act(state, "home");
    expect(state.context.hubPanel).toBe("normal");
    expect(state.context.focus).toEqual({ kind: "command", command: "equipment" });
    state = act(state, "prepare");
    state = reduceCampaign(state, { type: "carry-changed", quantity: 0 }).state;
    expect(act(state, "destinations").value).toBe("destinations");
    expect(state.context.game).toEqual(game);
  });
  it.each([null, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, 1000])(
    "不正な持込み%sを行き先確定で拒否しdraftと在庫を保持する",
    (quantity) => {
      const start = home(),
        game = structuredClone(start.context.game);
      let state = act(start, "prepare");
      state = reduceCampaign(state, { type: "carry-changed", quantity }).state;
      const result = reduceCampaign(state, { type: "command", command: "destinations" });
      expect(result.state.value).toBe("home");
      expect(result.state.context.hubPanel).toBe("preparation");
      expect(result.state.context.carryQuantity).toBe(quantity);
      expect(result.state.context.game).toEqual(game);
      expect(result.state.context.focus).toEqual(state.context.focus);
      expect(result.effects).toEqual([{ type: "report-carry-validity" }]);
    },
  );
  it("system取消と保存失敗は現在gameを保持し、成功を待ってタイトルへ進む", () => {
    const start = home(),
      game = structuredClone(start.context.game);
    let state = act(act(start, "menu"), "title-options");
    state = reduceCampaign(state, { type: "escape" }).state;
    expect(state.value).toBe("home");
    expect(state.context.focus).toEqual({ kind: "command", command: "menu" });
    const confirm = act(act(act(state, "menu"), "title-options"), "save-title");
    expect(reduceCampaign(confirm, { type: "escape" }).state.context.game).toEqual(game);
    const saved = reduceCampaign(confirm, { type: "command", command: "accept" });
    expect(saved.state.value).toBe("saving");
    expect(saved.effects[0].type).toBe("write-save");
    expect(reduceCampaign(saved.state, { type: "escape" }).handled).toBe(false);
    const failed = reduceCampaign(saved.state, { type: "save-written", saved: false }).state;
    expect(failed.value).toBe("home");
    expect(failed.context.game).toEqual(game);
    expect(failed.context.focus).toEqual({ kind: "command", command: "menu" });
    expect(reduceCampaign(saved.state, { type: "save-written", saved: true }).state.value).toBe("title");
  });
  it("街systemは活動前だけ、破棄確認の取消は街へ戻り加入・半日を再実行しない", () => {
    let state = act(act(home(), "destinations"), "town");
    const game = structuredClone(state.context.game);
    state = act(act(act(state, "menu"), "title-options"), "title");
    expect(state.value).toBe("confirm");
    state = act(state, "cancel");
    expect(state.value).toBe("town");
    expect(state.context.game).toEqual(game);
    state = reduceCampaign(state, { type: "town", event: { type: "select", placeId: "find-companion" } }).state;
    expect(state.context.game.adventure.mode).toBe("conversation");
    expect(reduceCampaign(state, { type: "command", command: "menu" }).handled).toBe(false);
    expect(reduceCampaign(state, { type: "command", command: "title" }).handled).toBe(false);
    expect(projectCampaign(state)).toMatchObject({ kind: "town", town: { adventure: { mode: "conversation" } } });
  });
});
