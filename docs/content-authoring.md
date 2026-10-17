# コンテンツを追加する

既存の仲間・加入会話・スキル効果を型付きデータで増やす手順。新しい効果や対象が必要な場合は、担当する[仕様](../specs/overview.md)・ゲームコア・テストも更新する。

## 仲間を追加する

1. [characters.ts](../src/content/characters.ts)へ一意なID、名前、基礎最大HP・速度・攻撃力を登録する。命中率を指定する場合は`hitRate`（0〜1）。ロッシの論理IDは`player`、画像IDは`rossi`。
2. [growthRules.ts](../src/content/growthRules.ts)の初期成長と、[skillDefinitions.ts](../src/content/skillDefinitions.ts)のキャラ別profileを確認する。`poolId`と初期技を指定し、保証技があれば解禁レベルを追加する。未決を表す`null`は、習得なしの`[]`と異なり、プレイ可能な名簿には残せない。
3. 加入会話と[saveDefinitions.ts](../src/content/saveDefinitions.ts)の加入フラグ対応を追加する。保存側は実行側と同じカタログ・成長定義を参照する。
4. [characterPortrait.ts](../src/presentation/characterPortrait.ts)へ画像を登録する。画像なしでも名前・能力と操作は使える。会話画像は`portraitId`／`expressionId`と会話素材登録を使う。素材追加は[制作手順](ui-asset-production.md)と[素材検査](../scripts/check-assets.mjs)を確認する。

名簿への登録だけでは加入・PT配置は行われない。初期仲間・編成・帰還時の扱いは[編成](../specs/party.md)、初期技と保証技の制約は[スキル](../specs/skills.md)を参照する。

## 加入会話を追加する

1. [initialAdventure.ts](../src/content/initialAdventure.ts)の`gilberta-recruitment-sample`を例に、会話ID、開始ノード、文章・選択肢・終了ノードと接続先を定義する。開始ノードを終了ノードにはしない。
2. 加入する終了ノードへ`recruitments`を指定する。キャラID、`all`／`none`によるフラグ条件、加入時の`setFlags`を設定し、辞退側には加入効果を置かない。
3. 街の`places`へ会話ルートを追加する。加入済みルートを先に、既定ルートを最後に置く。ダンジョンから呼ぶ場合は[initialDungeon.ts](../src/content/initialDungeon.ts)の会話ノードへ接続する。
4. `saveDefinitions.ts`の`recruitmentFlags`とイベントのフラグIDを一致させる。同じフラグで複数キャラの加入を表す場合は、そのフラグを立てる終了ノードで全員を加入させる。開始場所を変える場合は[initialGameOptions.ts](../src/content/initialGameOptions.ts)も更新する。

報酬量は`growthRules.ts`の`battleExperience`、`eventExperience`、`townExperience`で指定する。イベントごとの報酬IDはない。報酬対象と一度だけ受け取る条件は[成長仕様](../specs/progression.md#通常操作との接続)に従う。

## 既存効果のスキルを追加する

1. `skillDefinitions.ts`へID・名前・説明・分類・種別を追加する。攻撃は`test-strike`、回復は`test-heal`、パッシブは`test-strength`等を例にする。
2. 効果のパラメータ、アクティブの疲労増加量・場面・対象、パッシブの`rankAmounts`を指定する。使用条件と多段・全体攻撃の制約は[スキル仕様](../specs/skills.md)を参照する。
3. 抽選対象は対応する分類の`pools[].candidates`へ、初期技・保証技はキャラ別profileへ登録する。初期レベル以下の保証技は初期技として指定する。
4. 習得済み・上限到達・保証技を除外した後も、到達可能な選択で有効候補が3件残ることを確認する。生の候補数だけでは不足を判定できない。

症状の試用値を変える場合は[loadSymptomDefinition.ts](../src/content/loadSymptomDefinition.ts)、精神疲労は[mentalFatigueDefinition.ts](../src/content/mentalFatigueDefinition.ts)を編集する。曲線・付与順・回復・乱数の消費条件は[状態異常](../specs/status.md)を参照する。

## 追加後の確認

- `npm run check`を実行し、[集約検証](../src/content/validateContent.test.ts)で壊れた参照を検出できることを確認する。画像の検査は素材検査が担当する。
- 公開コア操作で加入→再訪→編成→探索→習得→使用→帰還→ホーム保存・復元を確認する。再訪による二重加入や、保存側に古い定義が残る不整合も対象にする。
- XP・候補・初期習得・保証を変えたら、[成長接続テスト](../src/game/growthRuntime.test.ts)の到達範囲と候補枯渇の検証を更新する。
- [習得テスト](../src/game/skillAcquisition.test.ts)と[境界テスト](../src/game/skillAcquisitionBoundaries.test.ts)の分類切替は、試験用定義によるコア保証。現在のコンテンツで到達できる経路の確認も別途行う。

ブラウザ検証が必要な変更と提出前の確認は[テスト設計](testing.md)に従う。
