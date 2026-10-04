import {
  type AdventureDefinition,
  type ConversationPresentation,
  getAvailableTownPlaces,
  getCurrentConversationScene,
} from "../game/adventure";
import type { GameState } from "../game/createInitialGameState";
import type { PartyFrame } from "./partyProjection";

export type AdventureFocus =
  | { readonly kind: "place"; readonly placeId: string }
  | { readonly kind: "choice"; readonly optionId: string }
  | { readonly kind: "party-entry" }
  | null;
export interface AdventureProjectionInput {
  readonly state: GameState;
  readonly definition: AdventureDefinition;
  readonly calendar: string;
  readonly feedback: readonly string[];
  readonly prompt: string;
  readonly saveStatus?: string;
  readonly home?: boolean;
  readonly debug?: boolean;
  readonly editorEntry?: boolean;
  readonly editorPreview?: boolean;
  readonly partyEntry?: boolean;
  readonly party?: PartyFrame;
  readonly focus: AdventureFocus;
}
const portraits: Readonly<Record<string, string>> = {
  rossi: "characters/rossi/expressions/neutral.png",
  gilberta: "characters/gilberta/expressions/neutral.png",
};
function portraitPath(id: string, expression: string | undefined): string | undefined {
  return expression === "smile" ? `characters/${id}/expressions/smile.png` : portraits[id];
}
function castFor(definition: AdventureDefinition, conversationId: string): Map<string, ConversationPresentation> {
  const cast = new Map<string, ConversationPresentation>();
  const nodes = definition.conversations
    .filter(({ id }) => id === conversationId)
    .flatMap(({ nodes }) => Object.values(nodes));
  for (const node of nodes) {
    if (node.type !== "line" && node.type !== "choice") continue;
    if (node.portraitId !== undefined && node.portraitId in portraits && !cast.has(node.portraitId))
      cast.set(node.portraitId, node);
  }
  return cast;
}
export function projectAdventure(input: AdventureProjectionInput) {
  const scene = getCurrentConversationScene(input.state, input.definition);
  const cast = scene ? castFor(input.definition, scene.conversationId) : new Map<string, ConversationPresentation>();
  const stagePortraits = scene
    ? [...cast].map(([id, initial]) => {
        const speaking = scene.presentation.portraitId === id;
        const presentation = speaking ? scene.presentation : initial;
        return {
          id,
          speaking,
          position: presentation.position ?? "center",
          path: portraitPath(id, presentation.expressionId),
        };
      })
    : [];
  if (scene && input.editorPreview)
    stagePortraits.push({ id: "rossi-preview", speaking: false, position: "right", path: portraits.rossi });
  return {
    mode: scene ? ("conversation" as const) : ("town" as const),
    backgroundId: scene?.presentation.backgroundId ?? input.state.currentPlaceId,
    backgroundPath: "backgrounds/landscape1.png",
    calendar: input.calendar,
    feedback: input.feedback,
    prompt: input.prompt,
    status: scene ? "会話中" : input.prompt === "行き先を選ぶ" ? "街の場所を選べます" : input.prompt,
    places: getAvailableTownPlaces(input.state, input.definition).map(({ id, label }) => ({ id, label })),
    scene: scene
      ? {
          type: scene.type,
          speaker: scene.presentation.speakerName ?? "",
          text: scene.type === "line" ? scene.text : (scene.prompt ?? ""),
          choices:
            scene.type === "choice"
              ? scene.options.map((option, index) => ({ id: option.id, label: option.label, number: index + 1 }))
              : [],
          portraits: stagePortraits,
        }
      : null,
    utilities: {
      party: input.partyEntry ?? input.party !== undefined,
      home: input.home ?? false,
      debug: input.debug ?? false,
      editor: input.editorEntry ?? false,
    },
    saveStatus: input.saveStatus ?? "",
    party: input.party,
    focus: input.focus,
  };
}
export type AdventureFrame = ReturnType<typeof projectAdventure>;
