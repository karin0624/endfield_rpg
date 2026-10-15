# UIデザインガイドライン

## r9採用と製品への接続

本人Slack message1792002525.703739「一旦見た目はこれでいいから実装して」「実装時はテキストやアイコンの僅かな誤差を除いてpx単位で一致することを目標として」により、同じSpace Page sequence 177の訂正済みr9を採用した。残る接触は採用版のまま保持し、再設計や再承認の条件にしない。サンプル制作中の製品実装・公開禁止は、この採用と製品実装依頼により当該工程を終了した。この採用はHome・Map・静的Townのr9画像と既存操作への製品接続を対象とし、独立した別画面・新機能の承認を含まない。現在のGitHub書込みは実際の許可判定の拒否により停止しており、画像採用をその拒否の解除や別経路公開の許可と扱わない。

本書は設計・実装で共通に使うデザインシステムの正本である。デザインレビューでは画面の目的と意図を理解する背景資料として参照し、設計値への適合を合否条件にしない。最初に[画面設計](ui-screen-design.md)と対象の画面別設計で目的・情報・操作結果を決め、その後に表現を選ぶ。ゲームの振る舞いは[仕様](../specs/overview.md)、画像の実入力・承認・比較は[制作手順](ui-asset-production.md)、検証層は[テスト設計](testing.md)を正本とする。レビュー役の定義に別の設計規則を置かない。デザインレビューは実画像の余白・まとまり・釣り合い・階層・可読性などの問題点と視覚的影響を指摘し、修正方法や値は設計側が決める。CSS・DOM・設計値の一致は実装検証、実測は設計補助として分離する。

既存CSSの値と既存画面の形は実装の現状であり、新しいホーム・街などの構成を決める要件ではない。共通化は同じ役割の部品を揃えるために使い、機能の性質・使用頻度・重要度・危険性に応じてfamily・variant・寸法・強調を選ぶ。差の目的、対象状態と判断根拠を設計票に記し、未計測の使用頻度や重要度を同じと断定しない。目的や情報構造を、旧ボタン配置・背景・立ち絵に合わせて歪めない。対象の完成画像が承認された後は、共通化を理由にその形・位置・余白・書体・材質を変更しない。

## 1. 情報と操作の優先度

プレイヤーが必要な判断・操作を完了できる最小の情報を、[情報0個からの設計順序](ui-screen-design.md#情報と配置を組み立てる順序)で決める。静的ホーム・街の場所選択と、話者・本文・選択肢が変わるADVは別に設計する。背景や人物を大きく置くこと自体を全画面の目標にしない。

各UI・テキストに「この画面に絶対に無くてはいけない理由」を求め、プレイヤーの意思決定に影響しない表示を置かない。文字なしで成立する構造を先に作り、文字なしでは伝わらない必要情報だけ文字で示す。必要な識別名・数値・操作名・制約・結果は読みやすく伝える。意味のない番号、余白を埋める装飾、操作に対応しない表示は増やさない。

一語ごとに、無ければ何が理解・判断・操作できないかを確認する。入口を「メニュー」と識別できるなら「システム」を足さない。既存ラベルの保持も削除も、この必要性の判定を経て決める。不要な可視情報を除くことを、必要なラベル・制約・結果やaccessible nameの削除へ読み替えない。可視ラベルを持たない操作も、意味と入力対象を支援技術へ伝える名前を保持する。

重複表示は、その表示が別の必要な判断や操作を助ける場合だけ採用する。重複でなくても意思決定への寄与が低ければ排除する。採用した情報の読み上げは保持する。編成の候補番号・HP・症状・詳細・確定方法等は[編成仕様](../specs/party.md)の対象であり、別画面へそのまま移植しない。

枠・面・操作で伝わる選択状態を「選択中」で言い直さない。平常時の「なし」や常時のスクロール案内を重ねない。選択順を示す有意な番号と、判断に不要な枠番号・管理番号を区別する。

## 2. 色と部品の役割

色は下地・文字・選択・操作・危険等の役割で使い分ける。選択、focus、使用不可を色だけで伝えない。主操作の強調はその画面の目的から選び、全画面に同じ位置・同じ数の主操作を強制しない。

必要最小限の情報の中で、今注目すべき対象だけにアクセントカラーを使う。各数値・アイコン・見出しを別々に強調して注意先を増やさない。

既存の[ui.css](../src/web/ui.css)は通常共通部品の実装値の正本で、採用r9の絵付き入口・日付・背景配置は[hub.css](../src/web/hub.css)・[hub-art.json](../src/web/hub-art.json)と対応するHubコンポーネントを参照する。以下はその役割の対応表で、全画面への適用済み・承認済みを意味しない。実装済みの具体的な色・寸法は実装から読み、文書へ実装値の別の正本を作らない。未採用の独立した設計仮説は本書の提案規格へ記し、採用r9と承認後の実装値から区別する。

| 役割 | 既存トークン |
| --- | --- |
| 下地と操作反応 | --ui-surface、--ui-hover、--ui-pressed |
| 主文字・補足 | --ui-ink、--ui-muted |
| 枠・選択 | --ui-metal、--ui-selection、--ui-selected-surface |
| 主操作 | --ui-primary、--ui-primary-hover、--ui-primary-pressed、--ui-on-primary |
| focus | --ui-focus |
| HP・危険 | --ui-hp、--ui-danger |

同じ役割・意匠が承認された部品では既存トークンを再利用する。ui-screen／ui-dialog／ui-button等の採用は画面設計との適合を確認して決める。旧style.cssや新ui.cssを新案の完成見本にしない。現状の接続は[UI適用一覧](ui-adoption.md)に記録する。

### UI案の前にデザインシステムへ決めること

全てのUI設計段階で、対象の全パーツを、機能・必要情報、component family、全体のどのvariant／patternに属するか、寸法・色・文字スタイル・操作状態、使用条件、採用意図と根拠へ対応付ける。既存パーツを残す場合もこの判断を省略しない。判断を本書の表現規則、画面設計の割当、承認後の共通部品・CSSという各正本へ反映し、デザインシステムを更新してからUI案を提示する。未確定の項目が残る間はUI案を提示しない。

最低でもMaterial Designの関連コンポーネントを全て公式資料で調べてから、この採用規則を決める。Icon・IconButton・Button・FAB・Typographyに加え、対象操作と構成に関連する他のcomponent／patternも用途・variant・状態・寸法・文字・入力条件まで確認する。他の参照デザインシステムも同様に、関連範囲を調べ、公式の根拠、本作への適用と不適用を対応付ける。アイコンの単品APIや一つの寸法だけの調査を、関連コンポーネント全体の調査完了と扱わない。出典を挙げただけで調査・適用判断済みとはしない。

調査から選んだ具体値も、実画像で検証する前は設計仮説である。本書の[提案用部品規格](#7-提案用部品規格)は新たな対象へ適用するだけでその画像承認・製品採用を意味しない。採用済みr9の対象は[完成部品構成](#採用r9の完成部品構成)で区別する。既存CSS値と以前の画像候補は現状・比較資料として区別する。

### アイコンの共通規格とサイズ選択

通常のUIアイコン操作と、本人のイラストを持つフレーム付き操作を別のcomponent familyとして扱う。通常UIのIconButton・アイコン付きButton等のpatternを、イラスト付き操作の大きな図案box・枠・下側ラベルへ無条件に統一しない。図案を選ぶ共通部品と、各familyの図案・容器・必要なラベル・余白・操作領域を組にした部品規格を先に決め、各画面はその規格から選ぶ。画面ごとに自由な寸法を付け、後からsmall／medium／largeという名前を付ける方法は採らない。段階の名称や数を固定せず、使用条件を伴う必要最小限の規格にする。同じ役割・使用条件の操作は外観と寸法を揃え、異なる機能は図案・必要なラベル・状態等で区別する。機能が近いことだけでfamilyや大きさまで同一と決めない。

図案box、PNG内部の見える図案、外枠、ラベル込み部品、当たり判定を混同しない。原画像の128×128等の入力指定は画面上の推奨寸法ではない。透明領域や図案の密度も確認するが、alpha面積の一致を光学的な均一さの証明にしない。原素材の保管と配置用の表示範囲・派生素材を分ける。本人が最終配置用のトリミングを許可したアイコンは実図案と周囲の空間を基準に扱い、透明余白の維持を制約にしない。その許可を背景や他画像の変更へ広げない。

文字の実書体・最長ラベル・桁数、識別できる図案の表示、必要な余白から下限を確かめ、背景の重要部分の遮蔽と配置間隔から上限を検討する。余白は図案用、外枠からラベルboxまでのinset、box内の文字余白を分け、各辺か合計かと枠線の内包関係を明記する。算式と実CSSのbox寸法・文字実測を照合し、枠線や余白を二重に加算しない。その範囲内の候補規格を全対象画面へ適用し、実表示の比較から選ぶ。例外は用途だけで正当化せず、共通規格では不足する理由と比較結果を残す。hover・pressed・focusで寸法を変えない。入力精度と実際の表示縮尺を照合し、操作領域の基準を可視図案の寸法へそのまま転用しない。

この方法の参考は、図案サイズと文字の比を定義し共通APIから選ぶ[Carbonの指針](https://www.carbondesignsystem.com/building-blocks/foundations/icons/guidelines)・[API](https://www.carbondesignsystem.com/building-blocks/foundations/icons/code)、サイズとwrapperの余白を分ける[Atlassian Icon API](https://atlassian.design/components/icon/code)、用途・入力精度・サイズ別図案を扱う[Fluent](https://fluent2.microsoft.design/iconography/)である。これらの製品固有のpx値・単色規則・書体との比率を本作へそのまま移す指示ではない。本作の部品と対象別割当は画面設計、未採用の独立した設計仮説は本書、採用版の適用と比較は画面別設計・対象画像、承認後の実装値は共通部品・CSSを正本にする。

通常文字4.5:1、重要な非テキスト3:1をコントラスト設計の基準とする。透過・画像下地は合成後の実表示で確認する。ratio計算、axeの違反0、VRT、目視をWCAG全要件への適合と読み替えない。基準の測定対象はW3Cの[文字](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)と[非テキスト](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)を参照する。既存の品質課題の扱いは[テスト設計](testing.md)に従い、本書だけで新しい必須テスト・完了条件へ昇格させない。

## 3. 文字・操作状態・到達性

[ADR 0002](adr/0002-ui-typography.md)の用途別文字体系を使う。読みやすさは判断情報の面積・配置を調整して確保し、収めるために文字を縮めたり横に潰したりしない。本文・状態名・使用不可理由、操作・主要数値、人物見出し、補助ラベルの役割を分ける。

| 役割 | 設計基準（CSS px、root 16px時） | 既存トークン |
| --- | --- | --- |
| 補助ラベル・単位 | 14px | --ui-caption-size |
| 本文・説明・状態・理由 | 16px | --ui-body-size |
| 操作・主要数値 | 20px | --ui-action-size、--ui-emphasis-size |
| 人物見出し | 24px | --ui-name-size |
| 画面／結果の見出し | 48px、既存の狭幅基準32px | --ui-title-size |

この表はADR 0002に基づく既存共通UIの用途基準であり、新しいfamilyへの適用済みを意味しない。新しい文字variantは、16px等の根拠あるbaseline、用途・情報階層・入力と表示条件からscale・行高・字間・書体・太さを選び、[デザインシステムの事前決定](#ui案の前にデザインシステムへ決めること)へ対応付ける。戦闘の既存コマンド等の具体的適用は[戦闘画面仕様](../specs/visuals.md)に従う。変更時に対象範囲を明記し、全画面へ未検証の一括変更をしない。

remと利用者のroot文字サイズを尊重し、rootを固定pxで上書きしない。本文の行高は1.6（下限1.5）、短い見出し・操作は1.4、単独数値は1.3を基準とする。字間は本文0〜0.02em、短い見出し0.03〜0.05em、数値0を基準とし、枠へ詰め込む調整に使わない。

見出し・操作は同梱Noto Serif JP、本文はNoto Sans JP、比較する数値はtabular-numsを使う。既存共通タイトルは500、承認済み編成の人物名等は700を使う範囲がある。実際の書体・太さ・読込はCSSと承認範囲で確認し、一つの画面の生成文字へ完全一致させるための個別字体調整を増やさない。全画面フォントの後続課題と、今回の読みやすさ・承認範囲を区別する。

| 状態 | 表現と操作 |
| --- | --- |
| 通常・hover・pressed | 押下結果が分かるラベルと操作領域。反応で文字位置・bboxを揺らさない |
| 選択中 | 選ばれた内容を示す。focusや実行済みと区別する |
| focus | 次のキー入力先を示す。枠が切れず、背景・選択面上でも識別できる |
| disabled | 操作を無効化し、実際の制約と解決方法を読める形で示す。理由を薄いopacityで消さない |
| 待機・失敗 | 待っている処理、保持される状態、再操作可能な時点を示す。ゲーム上のdisabledと混同しない |

狭幅・低い画面・長文では改行・領域拡張・縦積み・適切な内部scrollで到達性を保つ。名前を省略するならキーボードとタッチでも全文を確認できる方法を設け、hoverだけに頼らない。HP・コスト・残りtick・必要な状態名を省略しない。16:9の戦闘ステージ比率を、全情報を詰める制約へ拡張しない。

入力仕様・focus復元・dialog中の背面操作抑止は画面設計とspecsへ対応付ける。Escを一律の取消や戻るにしない。編成の選択画面ではEscも確定であるなど、画面の現行契約を確認する。

## 4. 選択マーカーと動き

枠・ラベルで対象が分かる場所にマーカーを重ねず、注意先を増やさない。既存の四面体マーカーは同画面で原則1個、最大2個（静止も含む）。戦闘の選択敵と会話選択肢の用途は[戦闘画面](../specs/visuals.md)・[会話](../specs/adventure.md)に従う。行動順・味方カード・スキル説明・通知へ機械的に追加しない。

左側に置く先端は右、上側は下を向け、対象との対応を明確にする。既存戦闘では立体投影による回転、会話選択肢では静止を使う。別画面で使う場合は必要性と対象を設計し、既存マーカーの使用実績を採用理由にしない。

動きは意味の補助とし、低コントラストや不明な操作を補う手段にしない。prefers-reduced-motionでは静止または移動を減らしても対象・結果を識別できるようにする。W3Cの[動きを減らす設定への対応](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)を参照する。演出時刻でゲーム時間・HP・所持を再計算しない。

## 5. 画面の共通配置

共通にするのは、同じ役割の情報・操作の扱いである。画面タイトルを常に左上、確定を常に右下、戻るを常に左下へ置くことを新規画面の自動制約にしない。情報のまとまり・読む順序・入力順・確認結果・戻り先から配置を決め、完成画像で対象状態を承認する。既存CSSの余白・角落ち・パネル比率は部品実装の現状として読む。

同じ役割・使用条件のタイトル・主操作・副操作は位置・サイズ・書体・色を、判断情報は形・配置を画面間で揃える。目的や確定・戻るの意味が異なる場合は差の理由を示す。この一貫性を、異なるfamilyの全操作同寸や全画面への帯の一律適用へ拡張しない。

現行の編成・選択・詳細の操作と構成は[編成仕様](../specs/party.md)、承認された位置・余白・状態・比較寸法は[固定版4画像](ui-concepts/approved/README.md)を参照する。その対象の実装では承認範囲を守る。編成の画像、1672×941の比較条件、1920×1080向け共通CSSを、ホーム・街・会話のレイアウトへ自動適用しない。

画面幅320px・390px、対象の基準寸法、切替境界前後、大画面、低い高さ、長名・最大桁・複数症状等で到達性を確認する。狭幅の操作回帰確認と狭幅の意匠承認は別であり、デスクトップ画像から狭幅の承認済みを推定しない。

## 6. 背景・人物と実画像

背景・キャラクターの見た目の説明は本書に置かない。場所設定は画面設計で決定・未決を分け、見た目は原画像を担当者と生成へ実入力として渡す。[原画像と本人の制作指示を使う規則](ui-asset-production.md#原画像を文章へ置き換えない)に従い、本人の具体的な変更指示と担当者独自の代用説明を区別する。

既存の背景・人物素材、編成コンセプト、実画面記録は、それぞれ出典・対象・承認範囲を確認して使う。背景や立ち絵を維持することを新案の自動前提にせず、本人が指定した保持条件を守る。現在の素材出典は[素材メモ](../art-src/README.md)、編成の承認は[承認記録](ui-concepts/approved/README.md)、接続状況は[UI適用一覧](ui-adoption.md)を参照する。対象固有の資料・保持条件・仮接続は[画面別設計](ui-screen-design.md#issue-80の資料と今回の境界)に置く。

完成画像承認、製品接続、同条件の直接pixel比較、操作検証は[制作手順](ui-asset-production.md#ui開発の必須ゲート)で個別に確認する。本書の基準への適合を、その代わりにしない。

## 7. 提案用部品規格

現在の適用規格は採用r9として以下へ集約する。撤回されたHome rect standard／utilityと旧日付規格は現行本文から除き、同じPageのv20固定exportとローカルv21/docs-beforeに履歴として保持する。2026-10-13 17:48:26のTown／Map marker了承は制作経緯であり、原frame・図案表示はその後の本人追加レビューを反映したr9を採用する。通常menu・確認とゲーム契約は保持する。旧96px・名称20px/500のv21-r2は比較入力へ保持する。

### 本人sampleへの適用

2026-10-14 03:55 UTCの本人指示は、当時のサンプル・設計文書制作だけを許可し、製品実装・push・PR・CI・mergeへ進めない工程制約だった。同Page sequence 177のr9採用と製品実装依頼により、この画像採用前の制約は当該r9の工程について終了した。以下の配置・原素材保持の要求はr9へ継承するが、独立対象の採用条件や現在のGitHub書込み停止は解除しない。旧v21の値と原画像は固定比較版へ保持する。

| family／用途 | 現在のサンプル条件 | 意味・検証 |
| --- | --- | --- |
| IllustratedButton／本人横型枠 | 共通可視272×88.3125。Homeは仲間・アイテムの2個を黄、出かける・Townホームは青 | 原枠は保持。Home常設編成は削除。任意準備内の既存編成は別操作として保持 |
| 絵付きButton内図案 | 原枠内へ原図案の意味ある全輪郭を比率保持で収める。slice・円形clipによる欠けを使わない | 表示viewportと実図案bboxを区別。原PNG・実寸・SHAを保持し、再生成・低解像度派生を使わない。原画との直接比較で先端・端・下部を確認する |
| PassiveCalendar | 原日付のDAYの右に日数を1行で置く。文字直下の水平枠線が移動Buttonの文字直下の水平枠線と実画素で一致 | 画像全体の高さをButtonに合わせない。原day/nightの文字部source座標と同じ1倍の実画素を照合し、文字直下の水平枠線を移動Buttonの文字直下の水平枠線へ合わせる。DOMの領域端だけでは判定しない。旧2段高・上下2行文字を撤回 |
| 横型入口名／日数 | Noto Serif JP700・32pxを保持。日数はtabular-nums、4桁overflow可 | DAYは原画像の文字で、日数はHTML。同一行の実字面・基線と1〜4桁を実表示で確認 |
| 円形吹き出し入口 | 本人指定の最新円形枠の実画像へ交換。原図案と内周の全周余白の偏りを減らし拡大 | 指定透過原枠f2b98de2…を正式取得・消費環境で実見済み。全輪郭の保持を枠非重複だけで証明しない。市場は四隅の頂点と縁の余白がある程度均一になるよう比率保持で配置 |

原枠内へ表示する原図案のviewportは、意味のあるalpha輪郭を全て囲む範囲とする。原図案の透明域を減らす表示選択と、物体の端を円形に切り落とす処理を区別する。原PNGを直接SVG imageから参照し、図案の再生成・描き直し・bitmapの縮小保存をしない。図案と文字の位置は合成後の完成部品で確認する。

日付の原画像は保持し、RGB原画の表示canvas除去はsource座標のSVG maskとして記録する。元の画素をSVG imageから直接参照し、文字部だけの枠線座標・原画像全体の外形・端間隔を分けて扱う。親確認前のsampleを完成採用と称さない。

### 判断の根拠と適用条件

[Material 3 Icons](https://m3.material.io/styles/icons/designing-icons)の通常glyphと[適用](https://m3.material.io/styles/icons/applying-icons)、[IconButton仕様](https://m3.material.io/components/icon-buttons/specs)・[用途](https://m3.material.io/components/icon-buttons/guidelines)・[accessibility](https://m3.material.io/components/icon-buttons/accessibility)を、UI glyphの24、操作領域48以上という出発点に使う。ブラウザではCSS pxの実表示・入力条件を照合し、他platformのdpを画面縮小率へ転写しない。PCという理由だけでdenseの20/40を選ばない。

[Buttons](https://m3.material.io/components/buttons/guidelines)の文字とleading iconを横型入口の操作の出発点とする。[Cards](https://m3.material.io/components/cards/guidelines)の単一action面とは、役割と表示情報を比較して区別する。[Fluent Button](https://fluent2.microsoft.design/components/web/react/core/button/usage)もmenu openerとtoggleを区別し、[Card](https://fluent2.microsoft.design/components/web/react/core/card/usage/)は内容と行動に合わせた寸法を許す。[Carbon pictograms](https://www.carbondesignsystem.com/building-blocks/foundations/pictograms/guidelines)のイラストとUI iconの区別、[Atlassian IconButton](https://atlassian.design/components/button/icon-button/usage)の文字なし操作はこの分離を支持する。絵付き入口へ通常glyphの24を適用せず、pictogramの最小値から本作の最適寸法を断定しない。

[Typography](https://m3.material.io/styles/typography/applying-type)・[type scale](https://m3.material.io/styles/typography/type-scale-tokens)は用途を先に割り当てる参考とする。本作のroot16と同梱日本語書体を出発点にし、他体系の14という基底値や見出し体系を転写しない。[色の役割](https://m3.material.io/styles/color/roles)・[states](https://m3.material.io/foundations/interaction/states/applying-states)・[state layers](https://m3.material.io/foundations/interaction/states/state-layers)はforeground/surfaceと状態の意味を分ける参考であり、元PNGへopacityを重ねる指示ではない。[密度](https://m3.material.io/foundations/layout/grids-spacing/density)・[spacing](https://m3.material.io/foundations/layout/grids-spacing/spacing)・[adaptive design](https://m3.material.io/foundations/layout/layout-overview/adaptive-design)を、余白の組と実表示を維持するreflowへ対応付ける。

Material 3本文・図版は親担当が公式design資料を直接閲覧した調査を入力として採用した。本環境のweb取得はJavaScript案内のみで、同本文を独立に取得できたとは記録しない。Fluent Button/Card等の取得本文との照合は別の確認である。出典を挙げたことを実画像での採否証拠へ広げない。

### 寸法と余白

寸法はroot16時のCSS px、括弧内はrem基準。border-boxで線を内包し、当たり判定は部品全体と一致させる。原素材は保持し、配置に使うアイコンの表示範囲は本人の許可内で選ぶ。本文拡大で高さが足りなくなればauto-heightと折返しで拡張し、文字を切らない。

| family／実際に使うpattern | 規格案 | 使用条件・採る理由 |
| --- | --- | --- |
| Button／leading glyph + text、default | 描画box22.5×18、可視図案22×18前後（DPR条件を記録）、target高さ48（3）以上。左右padding16（1）を基準に内容を包み、可視glyphから字面まで8px、幅は内容で伸長 | 常設menu opener等。絵付き縦型ラベルを流用しない。16pxの「メニュー」64pxなら幅128（8）。通常面・左icon・右textで、選択済みtoggleの面にしない |
| IconButton／default | glyph24、target48×48以上、可視図案から操作面まで12ずつ、角丸8（0.5） | 閉じる等。Xと同じ意味の可視ラベルを重ねない。opaqueな操作面、accessible name、focusを保持 |
| Button／text action、default | label16、target高さ48以上、左右padding16、最小幅96（6）、内容に応じ幅拡張 | 保存・取消等の命令。長い144pxの文字なら176px以上。重大確認は文脈内の実行だけを強調し、取消までprimaryにしない |
| IllustratedMarkerButton／marker standard | 部品幅160・自然高約199.11。原frameの可視cropを128×135.11へ等方表示、図案の全周を点検し、等方拡大と位置調整で可視余白の偏りを減らす。SVG描画viewportはframe全体とし、狭い窓による追加見切れをしない、frame横inset16ずつ。下のlabel160×56、gap8 | 背景上の施設・人物・行き先を指す場合。背景との位置関係を示す単一buttonで、通常の横型操作とは別pattern。人物の顔が円に入るだけでは別actionにしない |

絵付き入口の寸法は通常glyph24の倍数から導かない。必要なのは、図案と名前を組にして行動先を識別し、同格入口を区別できること、人物なら本人の顔を識別できることである。原絵の微細な描き込みすべてを読めることを最小寸法の条件にせず、残る識別情報を実画像で確認する。詳細を読まないことを、原画像からその詳細を削除する許可へ読み替えない。

markerはTown／Mapで幅160・自然高約199.11の完成button、128×135.11の原frame表示、160×56の別label、間隔8を使う。原frameの透明canvasではなく意味のある可視cropを等方表示し、frameそのものの再描画・縦横別拡縮をしない。2026-10-13 17:48:26（1791913706.024179）の了承案と17:55:13（1791914113.726089）の全周最狭余白確認を根拠とする。施設の絵と施設名、本人の顔と固有名、行き先の絵と名称を同じactionとしてまとめる。本人追加レビューの全周余白調整と拡大・原図案欠けの修正と最新frame交換が先行値より優先する。可視frameの透明余白と内周は実素材へ照合する。横型図案の表示範囲をmarkerへ自動適用しない。labelは左右16、24px Serif700・line-height1.4、名前を56へ収める。長名は必要時auto-heightへ拡張し、文字を切らない。原素材・world anchorを保持し、文字・図案・枠を一括縮小しない。

### 文字

| 用途 | size／font／weight | line-height／字間／条件 |
| --- | --- | --- |
| 本文・理由・feedback | 1rem／Noto Sans JP／400 | 1.6、字間0。長文は折返し、必要な情報をtooltipへ隠さない |
| 通常UI action | 1rem／Noto Sans JP／400 | 1.5、字間0。leading glyphと同じ横一列 |
| marker入口名 | 1.5rem／Noto Serif JP／700 | 1.4、0.02em。短い名前と必要操作名、labelは56以上 |
| 確認見出し | 1.5rem／Noto Serif JP／500 | 1.4、0.02em。確認対象を特定する場合だけ表示 |
| 横型Button入口名／日数 | 2rem／Noto Serif JP／700 | 1.2、字間0。日数はtabular-nums、昼夜名はaccessible textで保持。1〜3桁の字面を中央に置き、4桁はoverflowを許す |

これは通常UIの短いラベルと絵付き入口の階層差である。既存の全操作20という基準を対象外の画面へ一括変更しない。実際のNoto書体読込み、字面・metrics・フォント代替時を確認する。root16は比較出発点で、fontをviewport全体のtransformで縮めない。root20/24/32と狭幅では部品の最小面積・余白・改行を増やし、固定line-heightでglyphを切らない。

### 色と状態

色値はUI面に限定した提案token。画像の図案・背景・人物のpaletteへ適用しない。次の色名は設計上の役割で、未接続のCSS変数やAPIを新設した記録ではない。

| semantic role | 通常 | hover | pressed |
| --- | --- | --- | --- |
| neutral surface | #fff8e9 | #f0dfbe | #dec9a4 |
| foreground | #3e3326 | 同左 | 同左 |
| neutral border | #6c5437、2px内包 | 同左 | 同左 |
| focus ring | 内側#28526e 2px＋外側#ffffff 2px、offset2px | 同左 | 同左 |

横型Buttonは管理の黄枠と出発・帰還の青枠という原画像の対関係を使い、CSSのmovement面を重ねない。図案・frameはそのまま、hoverで名前を濃紺、pressedで名前の下線を追加する。通常名は濃いink。通常menu/closeはneutral。hoverはUI面の変化、pressedは濃い面とinset線で区別し、boxや文字位置を動かさない。通常menu／markerのfocusは背景画像上にも残す二重線、外周6pxを切らない。横型Buttonもmarker等と同じ明暗二重focus（濃紺outline2・offset2と白の外周6）を完成操作全体へ使い、原画像の輪郭と背景から次の入力先を識別する。即時navigationにselectedを付けない。既存の編成draft等、本当に選んだ状態はその画面の既存規則に従う。

実際に無効なactionはnative disabledと読める理由を伴い、foregroundを薄くせずneutral面・破線で区別する。未接続の制作状態をdisabledへ変換しない。待機中は既存の処理文言と再入力抑止、失敗は保持された状態と再操作先を本文で示す。hoverだけのtooltipは任意の補助であり、操作名・理由・必要情報を隠す場所にしない（[Tooltip](https://m3.material.io/components/tooltips/guidelines)）。

名目foreground比はneutralの通常11.636／hover9.379／pressed7.617。neutral border比は6.706／5.405／4.389。旧movement面の数値は横型原frameへ適用しない。focus dark対neutral7.872、white対dark8.326。これはsRGB pair計算であり、画像内部線・frame・focusと実際の背景隣接色、合成後の全状態を通過した証明ではない。識別に必要な図案内部線・外形・文字・状態を実寸で別々に確認する。

### 面・組合せ・入力

| part | 規格と意味 |
| --- | --- |
| CommandDialog | menu内容が背面操作を遮断・Tabを閉じ込める場合のcompact modal。幅min(20rem, viewport−2rem)、padding16、行gap8。Save/Titleのtext actionと右上48のclose、auto-height。accessible name「メニュー」、重複の可視見出しは置かない |
| ConfirmationDialog | 既存確認の本文・取消・実行を包む。幅min(30rem, viewport−2rem)、padding24、section gap16、action gap8、本文折返し。通常は取消を初期focus、長い確認は見出しから読む。Escは確認の取消契約へ。背面操作抑止 |
| Dialog backdrop | #101a20、opacity0.56のUI scrim。背景ファイル自体は不変。合成後の面・文字を確認。外側クリックの結果は画面設計で指定し、破棄確認を暗黙実行しない |
| Feedback panel | 内容が存在するときだけ、opaque neutral surface、padding16、body style、max-width32rem、auto-height。max-height40vhを超えれば内部scrollで全文に到達。内部scrollが必要なときだけ名前付きregionをTabでfocus可能にし、nativeの方向キー／PageUp／PageDownで読める。余分な可視見出し・装飾番号・timerは足さない |
| Background layer | 原画像をそのままcover、object-position:center centerで表示。UIの可読性は各opaque面と配置で確保し、画像の再着色で補わない。重要領域の遮蔽を実画面で検証 |

CommandDialogは[Menus](https://m3.material.io/components/menus/guidelines)と[Dialogs](https://m3.material.io/components/dialogs/accessibility)を振る舞いで比較して選ぶ。単に全面overlayだからDialogと呼ばない。nonmodalなanchored Menuへ変える場合はfocus・背面契約も再設計する。底部の操作群を[Toolbar](https://m3.material.io/components/toolbars/guidelines)、全入口を[Navigation Rail](https://m3.material.io/components/navigation-rail/guidelines)、同時に並ぶだけの操作を[Button Group](https://m3.material.io/components/button-groups/guidelines)へ機械的に置換しない。管理・移動は別の目的の群であり、不要な帯・dividerを追加しない。[FAB](https://m3.material.io/components/floating-action-button/guidelines)・[Extended FAB](https://m3.material.io/components/extended-fab/guidelines)は創造的な主操作の条件が合う場合だけで、menu/closeには使わない。

native buttonのclick／tap、Tab／Shift+Tab、focus中のEnter／Spaceを1対1の意味入力へ接続する。focusとhoverは独立し、押したあとactiveな選択面を残さない。modal中の背面入力を止め、閉じたら操作元へ復元する。DOM順と読む順を合わせ、root拡大・狭幅・低い画面では通常flowとscrollで全actionへ到達させる。固定1920ステージ全体をfit縮小する構成は採らない。viewport固有のanchors・切替・action結果は画面別設計で決める。

背景上の場所anchorは画像座標、menu・日付等はviewport端の座標として区別する。原画像の幅Iw・高さIh、viewport幅W・高さHに対し、cover倍率s=max(W/Iw,H/Ih)、center cropのoffset dx=(W−Iw×s)/2、dy=(H−Ih×s)/2とする。原画像点(u,v)はviewport点(dx+s×u,dy+s×v)へ移す。比較基準1920×1080の点を原画像点へ戻す場合も同じ逆変換を使い、viewport百分率で代用しない。位置だけを変換し、文字・図案・操作boxはroot基準の実寸を保つ。

wideの判定は画面比率・閾値に加え、表示する全actionの実box・実focus外周、日付・非空feedbackの領域がviewport内へ入り、指定済み群間余白を保つことを条件にする。coverのcropで場所anchorが端へ追いやられた場合、label拡張・root拡大・非空feedbackで衝突する場合は、画面別のcompact flowへ切り替える。anchorを適当にclampして背景上の対応位置からずらさない。compactで部品の必要実寸が幅を超える場合はscreenの横方向scrollも許し、文字・原枠・操作面をclip／全体縮小して収めない。原絵との対応が変わる範囲と全情報への到達は画像工程で別に確認する。これらは配置契約で、全条件の実表示が通過したという記録ではない。

## 採用r9の完成部品構成

この節の採用対象はHomeの仲間・アイテム・出かける、Townの施設・ギルベルタ・ホーム、Mapの行き先・close、日付・メニュー等のr9完成画像と既存操作への接続である。仲間は既存の全加入者装備への暫定入口であり、新仲間一覧→詳細→装備とアイテム一覧の実装は別タスクのまま。未採用の独立対象や別画面の意匠、新機能まで採用済みにしない。一般的な設計規則と、実装・検証が済んだ範囲も区別する。

原要求は[本人追加レビューの有効条件](#本人追加レビューの有効条件)と各画面別設計の本人原文を参照する。領域寸法の一致と美観・要求適合を分ける。円形markerの可視縁と内側の面は本人指定の最新透過PNGが所有する。今回の原frameは内側が不透明なので、原frameを図案の背後へ置く。旧SVG支持面は重ねず、原frameをCSSやSVGの似た形へ置換しない。原図案9点の全輪郭を保つ等方変換と、人物の顔を識別する用途cropを区別する。物品・施設・行き先の図案に円形clipは使わない。人物は原portraitを直接参照し、顔を円形内周の用途viewportへ等方表示する。normal／hover／pressedでは原PNGの画素と変換を保持し、label面と外周focusで状態を区別する。

横型IllustratedButtonは本人の黄／青frameの実PNG、原図案全輪郭の等方meet表示（円形clipなし）、名前のHTML文字を一つのbuttonへ構成する。可視外形を直接共通寸法へ投影し、透明paddingで同寸と扱わない。通常UIのmenu／close／text actionは独立したCSS面・縁で内容を包み、横型原frameやmarkerを流用しない。

PassiveCalendarは本人の元date-source PNGの昼／夜ROIを直接参照するSVGとHTML数値。原PNGの濃色canvasを座標maskで除き、画像生成した短縮派生は使用しない。原枠・内側の装飾・太陽／月は画像に含まれ、旧濃色受け面や別日付frameを重ねない。適用寸法・数値書体は本人sampleの規格表へ集約する。昼夜の原ROIはそれぞれ文字枠線の高さを基準に等方表示し、原画の比率を保つ。原画像は保持する。確認／通知／menu panelは既存面・内容・scrim・focusを各役割として保持する。

## 確認面の構成

ConfirmationDialogは読む内容と操作の順序を保つ。小viewportでは外側余白を1remから0.5rem、内側余白をmin(1.5rem,max(0.5rem,4vw))として、文字サイズを保ったまま折返しのための幅を確保する。確認内の2操作は同じ列幅のgridとし、長い操作名に一方だけ面積を与えない。幅が足りなければ同幅で縦に並べる。タイトル操作名は「保存して／保存せず」と「タイトルへ」の語句境界で折り返せるが、読み上げ名は連続した文字列を保持する。

通常の初期focusは取消。focus時のnative scrollで見出し又は警告が失われる長い確認では、初期focusを見出し（tabindex=-1）へ置き、先頭から読む。次のTabは最初の有効操作、Shift+Tabは最後の有効操作、以後は同じ操作内を循環する。単に取消をfocusしてscrollだけ強制的に戻す方式は、不可視focusを作るため採らない。Esc、取消、背面抑止、保存・破棄の確定点は変えない。長い確認は縦scrollで全内容と操作へ到達する。

確認内のfocusは操作面だけでなく二重外周までscroll領域内へ収める。各操作のscroll余辺を0.5remとし、focus時にnearestで部品全体と余辺へ到達させる。初期見出しは先頭に留める。外周のために個別ボタンの位置を変えない。


### 最新原枠と図案の表示

円形枠は本人が2026-10-14に指定した実画像を正式取得・実見して使う。枠の透明canvasと可視内周を区別し、図案の意味ある輪郭から実内周への全周余白を比較し、なるべく均等にして拡大する。旧v21の2.6px診断目安・固定等方係数を新frameへ転写しない。市場の4頂点は原画像へ対応付け、個別の形状変更ではなく等方拡縮と位置で周囲の見える余白を比較する。

Town menuの独立close・disabled保存＋隣接理由・titleはv21-r3の内容と機能を保持する。新しいlayoutに便乗してsystem確認や既存ADVのbodyを変更しない。


最新frameは1288×1221 RGBA・SHA f2b98de2b81c8046fae784d04e24ae3dfdd986725a31239909fb95aca269e8de。意味あるalpha成分のcrop(100,32,1080,1140)を128×135.111へ等方表示する。SVG図案viewportもこのframe全域を使い、原PNGの参照・等方配置で内周の全周の余白を比較し、偏りを減らして拡大する。画像生成やbitmap縮小保存でアイコンを加工しない。原portraitは顔入口として円形内周の用途viewportを使う。原ファイルを加工しない。耳・上胸の保持は本人が追加した必須条件ではない。市場だけは本人の四頂点の整列指示に対応してsource中心を補正する。


## 横型図案と日付字面の有効要件

横型IllustratedButtonの管理・移動・帰還も本人追加レビューの全周余白調整と拡大の対象とし、原枠内の表示範囲と見える全輪郭、frameの内側装飾線への最狭余白を区別する。画像生成で再切抜きせず原PNGを直接参照し、全輪郭の等方表示を保って実描画を照合する。原形の輪郭が非円形のため、全方向の可視余白を実画像で比較し、完全同値を新たな条件にせず偏りを減らす。

日付の1・12・123はそれぞれの実字面bboxの左右の見える余白を等しくする。桁数間の余白値を同じにする指定ではなく、grid／文字advance幅だけの中央寄せを実字面の中央寄せと混同しない。4桁は従来のはみ出し許可を保つ。

## 本人追加レビューの有効条件

本人DM msg1791985130.859549の最新指定を優先する。日付の文字直下の水平枠線と、出かける／ホームの文字直下の水平枠線の実画素高さを完全に合わせる。円の下端やDOM boxの下端は比較対象にしない。原日付の比率・DAYと日数1行・装飾は保持する。全アイコンの全周可視余白を確認し、等方拡大と位置調整でなるべく均等にする。旧64px窓を現行の全体表示窓へ転記しない。最新本人message1792000045.111829の全周約2px基準を保持し、指定Y−2px後にも重なりが残る測定事実と区別する。横型原枠の外形・marker原枠・既存提案の配置は保持する。

人物は同じ原portraitを参照する顔用途の楕円切出しで、過剰な頭部・顔の見切れを修正する。原ファイル全画素を保持し、新人物生成や新会話へ置換しない。メニューは可視図案の右端と文字の左端を8px離し、可視の中心を整列する。透明域・box gapの値を可視間隔と同一視しない。menu／close・日付内の太陽／月も全アイコン点検へ含め、生成済み原frame内の装飾は原画像の視覚関係を保持する。

normal／hover／pressed／native keyboard focusの完成部品と外周、日付と移動のクラスタ、人物と帰還の周辺、原参考との比較、3全画面を実画像で確認する。ピクセル測定は設計補助、独立デザインレビューは見た目、本人の採用判断は別である。Mapの座標は既存提案の配置で、既存WARNは非阻害。

## 現行固定画像との対応

横型図案は共通272×88.3125の原枠全体をSVG viewportとし、表示transformは固定sourceのasset-config.jsonのhorizontal.placements、施設・行き先はmarker.iconsを正本にする。原図案の全positive-alpha画素をviewport内へ含め、原素材を加工せず等方表示する。人物はsource中心[512,285]・倍率0.185、顔楕円中心[63.9636254192,62.8276507277]・半径[50.56460022846,49.19259163197]。旧r4/r5の顔変換を現行として使わない。

日付は元day/nightの比率と表示寸法を保持して6px上へ置き、文字直下の水平枠線の下端を移動文字直下の水平枠線の下端へ合わせる。メニューのglyphは22.5×18描画box、可視glyphと字面の間隔8px・可視中心整列。box gapは5.5pxであり、透明域と日本語字面の余白を含む実描画で8pxを確認する。closeは可視24px・操作面48pxで全周12px。


## 仲間・ダンジョンの本人指定変更

最新本人原文 message1792000045.111829「なんでこんな時間掛かってるの？　縁とアイコンが接してる状態から2px上にずらすだけでしょ？？　ああ、馬鹿だから余白の基準が2pxって話も忘れたのか」を適用する。基準は本人確認どおりr7である。図案Yだけ各2 CSS px上へ移動し、追加の倍率・X・Y変更や独自のデザイン判断は行わない。r8の倍率・X固定は親の指示であり、本人の禁止ではなかった。今回は最新の指定変更の状態を保存し、残る重なりを結果として明記する。

仲間のimagePositionCssは[9.9396179811,9.1318290888]、等方倍率0.054085929531。ダンジョンは[18.4145709401,13.9208302063]、等方倍率0.072544392612。いずれもr7のYから−2、X・倍率・viewport・外枠・ラベルを保持する。sourceCenterのYは同じ表示transformの逆算metadataとして同期し、追加移動として使わない。compositor HTML／JS／CSS・原素材22点はr7と同じbytes。11全画面の差分は2図案の旧／新alpha描画領域だけで、その外は0画素である。

全周の約2px余白は、この指定変更後には達成していない。設計変更や追加調整をせず、同一画素重なりと画素セル間距離を測定結果として保存した。主測定の図案alpha≥128は50%閾値で、完全不透明を意味しない。近不透明のalpha≥250（98%以上）も併記する。金線maskは実ブラウザ描画のframe alpha≥128、R>180、(maxRGB−minRGB)/maxRGB>0.17と、元frameの内側金線を限定する帯域を使う。仲間は中心から半径30〜36.5 CSS px、ダンジョンは原内周楕円正規化距離0.96〜1.04で外枠を除外する。DPR1／4のdevice pixelsを数え、距離はDPRで割ったCSS pxとして記録する。

DPR1・alpha≥128の同一画素重なりは仲間3、ダンジョン29 device pixels。DPR4では27、278。alpha≥250はDPR1で仲間0、ダンジョン20、DPR4で9、245。全4状態で同じ結果で、最狭画素セル間距離は0 CSS px。alpha8／32も補助として固定測定へ残す。閾値による0画素を余白の合格へ読み替えない。この測定単独は本人採用・製品実装・新機能完成の証明にならない。現在のr9本人採用と既存操作への製品接続は、冒頭の採用指示と各画面の製品接続・検証記録で別に確認している。新一覧・詳細機能は別タスクである。
