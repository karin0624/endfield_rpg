# 同種のコンテンツを追加する

この手順は、既存の仲間・加入会話・効果を型付きデータで増やすためのもの。振る舞いの正本は[仲間・編成](../specs/party.md)、[スキル](../specs/skills.md)、[状態異常](../specs/status.md)。新しい効果、対象、イベント処理が必要なら、データだけで実現しようとせず、仕様・`src/game/`・テストを同じ変更で更新する。汎用スキーマ、DSL、エディタ、保存互換処理は追加しない。

## 仲間を1人追加する

1. `src/content/characters.ts` のギルベルタを例に、一意な `id`、表示名 `name`、`maxHp`、`speed`、`attackPower` を登録する。命中率を指定する場合は `hitRate`（0〜1）。ロッシの論理IDは `player`、会話画像のIDは `rossi` なので取り違えない。名簿への登録と加入は別で、初期仲間はロッシだけ、PTは1〜4人と控えを扱う。
2. `growthRules.ts` の `progression.initial` に初期レベル・経験値・能力補正があることを確認する。現行は名簿からLv1・経験値0・補正0を生成している。`skillDefinitions.ts` の `characters` に `characterId`、`poolId`、`initialSkillIds` を追加する。`null` は未決・未接続で、習得なしを確定した `[]` とは異なる。プレイ可能な名簿では `null` を残せない。
3. ギルベルタ同様、次節の加入イベントと `saveDefinitions.ts` の対応を追加する。`saveDefinitions.skills.catalog` と `saveDefinitions.skills.growth` は実行側と同じスキル・成長定義へ接続する。名簿だけ増やして保存側に旧profileや旧初期成長を残すと、現行形式でも保存・復元できない。初期習得と探索中の習得を区別する。保証アクティブがある場合は `guaranteedUnlocks` のIDとレベルを指定し、初期レベル以下の保証は置かず初期習得として表す。初期と保証で同じIDを重複させない。
4. キャラ詳細・編成等の画像登録は現状 `src/web/characterPortrait.ts` の `portraits` にある。未登録ではURLが返らず、編成では「画像なし」、キャラ詳細では画像欄を隠して名前と能力を表示する。会話画像は会話側の `portraitId`／`expressionId`、素材登録に従う。画像登録の移動はこの手順に含めない。素材追加時は[素材制作](ui-asset-production.md)と `scripts/check-assets.mjs` の検証を確認する。

帰還ではレベル・経験値・後天習得・成長とパッシブ補正を初期化する。加入、PT、フラグ、乱数、症状、精神疲労は巻き戻さない。症状の回復を帰還リセットで代替しない。

## 加入イベントを1本追加する

1. `src/content/initialAdventure.ts` の `gilberta-recruitment-sample` を複製の出発点とし、一意な会話ID、`startNodeId`、line／choice／endノードを用意する。開始ノードはendにしない。本文・選択肢から存在する `nextNodeId` へ接続する。
2. 加入するendノードに `recruitments` を設定する。例は `characterId: "gilberta"`、`when: { none: ["joined-gilberta"] }`、`setFlags: ["joined-gilberta"]`。人物名ではなく名簿IDを参照する。辞退のendには加入効果を置かない。
3. 街の `places` に会話へのルートを追加する。現行の `find-companion` は加入済みフラグのルートを先に置き、それ以外を募集会話へ送る。再訪で二重加入しないことを通常操作で確認する。ダンジョンから呼ぶなら `initialDungeon.ts` のconversationノードの `conversationId` を接続する。
4. `saveDefinitions.ts` の `recruitmentFlags` に `{ flag: "joined-gilberta", characterId: "gilberta" }` と同種の対応を登録する。イベントが設定するフラグと同じIDにする。独立したキャラの加入に同じ保存フラグを使い回さない。共通フラグが複数キャラを要求する場合、そのフラグを設定する終了ノードに全対応キャラの加入効果が必要。同じ終了ノードでの複数加入は既存コアが扱う。場所の保存対象は現状 `initialAdventure.places` から生成される。開始場所を変える場合は `initialGameOptions.ts` の `startingPlaceId` も実在する場所に合わせる。

報酬IDやイベントごとのreward参照は現在存在しない。報酬は `growthRules.ts` の共通数値 `battleExperience`、`eventExperience`、`townExperience` で、安全な非負整数を指定する。現行試用値は通常戦闘25、ダンジョン会話15、街5。街経験値は街から出撃・帰還までの一時成長セッションで1回だけであり、繰り返し街を選んで稼げない。最終ボスの経験値は0で、勝利後は帰還初期化される。これらは接続済みの試用バランスであり、最終調整値ではない。

## 既存効果のスキルを1つ追加する

1. `src/content/skillDefinitions.ts` の `skills` に、一意なID・名前・説明・`tier`・`type` を登録する。攻撃なら `test-strike`、戦闘／分岐の回復なら `test-heal`、常時補正なら `test-strength`／`test-power`／`test-vitality` を例にする。説明は実際の量・対象・場面と一致させる。
2. アクティブは `effect` の種別・基礎量・参照能力値と正の係数、`mentalFatigueIncrease`、`scenes`、`target` を指定する。既存のdamageは戦闘の敵1体、hp-recoveryは戦闘／分岐の生存味方1体。アクティブはランクを持たず、所持済みIDを再習得しない。パッシブは補正種別と `rankAmounts` を設定し、その配列長が個別上限。場面・対象・精神疲労増加量は持たない。
3. 抽選対象なら `pools[].candidates` の対応tierへ登録し、対象キャラの `poolId` を確認する。初期技や保証技ならキャラのprofileにも指定する。到達Lv10の倍数はultimate、それ以外の5の倍数はadvanced、その他はnormal。複数レベル上昇でも途中の各レベルの権利を順に解決する。
4. raw poolが3件以上でも足りるとは限らない。所持済みアクティブ、上限到達パッシブ、保証技（解禁前も含む）は抽選から除外される。有効候補が3件未満なら権利と乱数を保持して不足になる。権利スキップやアクティブのランク追加で回避しない。

使用前の精神疲労で今回の効果を決め、全効果適用後に疲労を1回加算する順序は採用済み。疲労増加が正のアクティブだけが減衰対象で、増加量0の技・パッシブ・通常攻撃は減衰しない。初期技の名前、威力、成長量、疲労曲線・回復量等は試用値であり、キャラ固有の最終仕様と混同しない。

## 追加後に確認する

- `npm run check`：`src/content/validateContent.test.ts` が本番の集約検証を必ず実行する。Node上でparty／adventure／dungeon／skill／progressionの既存検証を再利用し、名簿と加入・初期成長・解決済みprofile・保存フラグ・場所の参照、および共通報酬数値を追加検証する。保存側のcatalog・初期成長／成長規則・成長名簿は実行側と同じ内容を参照することを検証し、加入フラグの矛盾するキャラ対応も拒否する。症状の明示候補群・数値定義は既存 `validateLoadSymptomRules` に委譲する。エラーのID・会話／ノードを修正する。イベント報酬参照や画像素材をこの関数が検証すると解釈しない。
- 正例では新しい仲間・会話・既存効果を定義追加で接続し、通常の加入操作後に現行保存形式を往復できること、負例では壊れた参照が具体的に検出されることを確認する。加入→再訪→編成→探索→習得→使用→帰還→街保存・復元は関連する公開コア操作のテストで確認する。
- `growthRuntime.test.ts` の全97習得経路は、現行の街5＋ルート最大25 XP、Lv1→4の最大3権利を対象にした証明。XP・到達レベル・候補・初期習得・保証を変えたら、この到達範囲と有効候補の検証も拡張する。静的な参照検証の成功だけで枯渇しないとは言えない。
- `skillAcquisition.test.ts` の4→6／9→11と `skillAcquisitionBoundaries.test.ts` の14→16／19→21は独立した合法な試験定義によるコア境界検証。Lv4までの現行試用コンテンツのテストがLv15／20の本番経路を証明するわけではない。
- `npm run build` は素材検証込みで実行する。LFS実体がない環境でも検証を無効化しない。CIのverifyは `COVERAGE_BROWSER=1 npm run check` で通常配布を生成し、browserはその成果物を再利用してdebug・直接描画fixtureをbuildした後、`sh scripts/run-playwright-quality.sh browser` を実行する。ローカル未実施事項を記録する。[テスト方針](testing.md)に従い、ゲーム規則はheadless、実外観は直接VRTへ分担する。

## 症状の試用定義を調整する

`src/content/loadSymptomDefinition.ts` の明示候補群と各症状の `cap`・`scale`・`loadCoefficient`・`townRecovery`・`labelThresholds`、発症の `probabilityScale` を変更する。肉体疲労・朦朧は連続数値で、同種付与は今回のスキル負荷から算出した量を加算し、個別上限で止める。重度は表示ラベルであり上限ではない。街回復は固定量を減らして0で止め、ラベル下限へ丸めたり一段階ずつ回復したりしない。戦闘不能の街6回復stepは別に扱う。

現在の試用値は、個別上限200、肉体疲労倍率 `1 / (1 + 値 / 100)`、朦朧倍率 `1 / (1 + 値 / 300)`、街回復10、今回の負荷係数1、表示閾値25／50／75。発症確率は使用後精神疲労fで `f / (100 + f)`、候補は肉体疲労・朦朧の均等選択。使用前疲労で効果を適用した後に負荷を加算し、使用者へ最大一種類を付与する。命中→発症→成功時の候補選択の順で必要な乱数を使う。個別上限の候補だけを除外し、負荷0・空候補群・確率0なら追加乱数を使わない。曲線・数値は最終バランスではない。

集約入口は `src/game/loadSymptoms.ts` の `validateLoadSymptomRules` を呼ぶ。このAPIが `validateLoadSymptomDefinition` にも委譲するため、症状の検証を複製しない。候補を全状態異常から自動生成せず、精神疲労自身や戦闘不能の混入を拒否する。現在の保存形式はv5のみで、旧形式の変換は行わない。症状値と精神疲労は丸めず保存し、読込では回復しない。

残る全通し受入は [Issue 21](https://github.com/karin0624/endfield_rpg/issues/21)／[Issue 46](https://github.com/karin0624/endfield_rpg/issues/46)、ユーザー試遊はIssue 19で追跡する。定義検証・個別境界テストの成功を全通し受入の完了と取り違えない。
