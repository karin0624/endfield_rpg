import type { AdventureDefinition } from "../game/adventure";

export const initialAdventure = {
  places: [
    {
      id: "town-square",
      label: "街の広場",
      routes: [{ conversationId: "town-square" }],
    },
    {
      id: "guild",
      label: "冒険者ギルド",
      routes: [
        {
          conversationId: "guild-return-quest",
          when: { all: ["visited-guild", "heard-guild-quest"] },
        },
        {
          conversationId: "guild-return-unselected",
          when: { all: ["visited-guild"], none: ["heard-guild-quest"] },
        },
        { conversationId: "guild-first" },
      ],
    },
    {
      id: "market",
      label: "市場",
      routes: [{ conversationId: "market" }],
    },
  ],
  conversations: [
    {
      id: "town-square",
      startNodeId: "look-around",
      nodes: {
        "look-around": {
          type: "line",
          text: "人通りのある広場だ。どこへ行こうか。",
          backgroundId: "town-square",
          nextNodeId: "end",
        },
        end: { type: "end" },
      },
    },
    {
      id: "guild-first",
      startNodeId: "greeting",
      onCompleteFlags: ["visited-guild"],
      nodes: {
        greeting: {
          type: "line",
          text: "受付係が掲示板の前で会釈した。",
          speakerName: "受付係",
          backgroundId: "guild-hall",
          portraitId: "receptionist",
          expressionId: "smile",
          position: "center",
          nextNodeId: "ask-about-work",
        },
        "ask-about-work": {
          type: "choice",
          prompt: "何を聞こう？",
          speakerName: "受付係",
          backgroundId: "guild-hall",
          portraitId: "receptionist",
          expressionId: "smile",
          position: "center",
          options: [
            {
              id: "ask-quest",
              label: "掲示板の依頼について聞く",
              nextNodeId: "quest-answer",
              setFlags: ["heard-guild-quest"],
            },
            {
              id: "ask-secret",
              label: "極秘依頼について聞く",
              nextNodeId: "secret-answer",
              when: { all: ["knows-secret"] },
            },
            {
              id: "leave",
              label: "今日は何も聞かない",
              nextNodeId: "end",
            },
          ],
        },
        "quest-answer": {
          type: "line",
          text: "街道の様子を調べる依頼が出ているそうだ。",
          speakerName: "受付係",
          backgroundId: "guild-hall",
          portraitId: "receptionist",
          expressionId: "neutral",
          position: "center",
          nextNodeId: "end",
        },
        "secret-answer": {
          type: "line",
          text: "受付係は声をひそめ、奥の部屋を指した。",
          speakerName: "受付係",
          backgroundId: "guild-hall",
          portraitId: "receptionist",
          expressionId: "serious",
          position: "center",
          nextNodeId: "end",
        },
        end: { type: "end" },
      },
    },
    {
      id: "guild-return-quest",
      startNodeId: "follow-up-quest",
      onCompleteFlags: ["visited-guild"],
      nodes: {
        "follow-up-quest": {
          type: "line",
          text: "受付係は前回の話を覚えていた。「街道調査の依頼、詳しい内容をまとめておきました」",
          speakerName: "受付係",
          backgroundId: "guild-hall",
          portraitId: "receptionist",
          expressionId: "smile",
          position: "center",
          nextNodeId: "end",
        },
        end: { type: "end" },
      },
    },
    {
      id: "guild-return-unselected",
      startNodeId: "welcome-back-unselected",
      onCompleteFlags: ["visited-guild"],
      nodes: {
        "welcome-back-unselected": {
          type: "line",
          text: "受付係は顔を覚えていた。「前回は依頼の話をしませんでしたね。今日は何か聞きますか？」",
          speakerName: "受付係",
          backgroundId: "guild-hall",
          portraitId: "receptionist",
          expressionId: "smile",
          position: "center",
          nextNodeId: "end",
        },
        end: { type: "end" },
      },
    },
    {
      id: "market",
      startNodeId: "market-greeting",
      nodes: {
        "market-greeting": {
          type: "line",
          text: "市場には旅支度をする人たちが集まっている。",
          backgroundId: "town-market",
          nextNodeId: "end",
        },
        end: { type: "end" },
      },
    },
  ],
} as const satisfies AdventureDefinition;
