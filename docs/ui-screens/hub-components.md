# 拠点3画面の部品仕様

[ホーム](home.md)、[探索先](map.md)、[街](town.md)に適用する具体的な部品契約。全画面共通の設計原則は[デザインシステム](../design-guidelines.md)を参照する。数値は現在の実装との対応であり、別のゲーム画面へ適用する標準値ではない。外観の比較元は対象の固定版デザインとする。

実装名の`Hub`は、この3画面からなる拠点画面群を指す。部品ごとの利用範囲はそれぞれの用途に従う。マスターの`Components / Hub`には横長ボタン・日付・メニューと内部素材を置き、ホーム専用の差し替え図案は`Screens`の`Home / Local Components`へ分ける。全画面共通の部品と機能領域・画面専用部品の分け方は[マスターの構成](../../README.md#openpencilでデザインマスターを編集する)を参照する。

## 実装と値の所在

| 対象 | 所在 |
| --- | --- |
| ホームのデザインマスタ・共通スタイル・部品 | [endfield-rpg.fig](../../art-src/openpencil/endfield-rpg.fig) |
| 形状・文字・色・配置の実装 | [hub.css](../../src/web/hub.css) |
| 素材の表示範囲・縮尺・図案位置・日付領域 | [hub-art.json](../../src/web/hub-art.json) |
| 部品構造 | [IllustratedAction](../../src/web/components/IllustratedAction/IllustratedAction.svelte)、[HubCalendar](../../src/web/components/HubCalendar/HubCalendar.svelte) |
| 背景と画面構成 | [HubScene](../../src/web/components/HubScene/HubScene.svelte) |
| 準備・メニュー・確認・focus接続 | [CampaignHub](../../src/web/components/CampaignHub/CampaignHub.svelte) |
| 意味入力と状態遷移 | [campaignModel](../../src/presentation/campaignModel.ts)、[townModel](../../src/presentation/townModel.ts) |

設計上のIllustratedAction／PlaceEntryは、実装では同じ`IllustratedAction.svelte`の`round`・`movement`・`picture`で構成する。設計familyの区別は別モジュールの追加指示ではない。

## 部品と使い分け

| 部品／variant | 構成・値 | 用途と制約 |
| --- | --- | --- |
| IllustratedAction／管理 | 黄frame、対象図案、HTMLラベル。272×88 CSS px | ホームの仲間・アイテム。図案とラベルを別操作にしない |
| IllustratedAction／移動 | 青frame、移動先の図案、HTMLラベル。同じ外寸 | 出かける・ホーム。履歴を戻す操作の記号へ置換しない |
| PlaceEntry／施設・行き先 | 吹き出しframe、原図案、下側ラベル。外幅10rem、最小高12rem。frame表示128×135px | 地図と街の場所に対応する入口。図案を見切れさせない |
| PlaceEntry／人物 | 同じ構成、図案は人物portraitの顔領域 | 顔の表示用楕円viewportを使う。施設図案全体を同じ楕円で切らない |
| PassiveStatus／日付 | 原画像内の昼／夜の図案・DAYと、HTML日数 | 受動情報。操作のfocus・pressedを付けず、日数と昼夜をaccessible nameへ |
| Button／メニュー | 通常の面・縁、SVG記号＋可視文字。最小幅8rem、高さは内容とpaddingによる | システム操作の入口。絵付きframeへ変更しない |
| IconButton／close | 通常の面・縁、×記号。3rem角、padding 0.75rem | 地図・メニューを閉じる。用途別accessible nameを保持 |
| Dialog／command・確認 | 通常面、見出し・説明・操作群。commandは最大20rem、確認は最大30rem、画面端1rem以上を確保 | 選択と確定、待機を区別。背面をinertにする |
| Feedback／結果 | 非空時のみ通常面に本文。最大幅32rem、最大高40vh | 長くscrollする場合はfocus可能なregion、通常はstatus |

横長frameは原素材を指定範囲で表示し、図案とラベルを別レイヤーで描く。図案全体の輪郭を保持し、元PNGの透明canvasと可視図案を混同しない。ラベルの左端は88px、右端は2px。表示位置と縮尺の詳細はJSONを参照し、表へ転記して二重管理しない。

PlaceEntryの図案はframeの上へ描く。frame内部の塗りを別の円やSVG面で描き直さない。図案とlabelのgapは0.5rem、labelは最小高3.5rem、左右padding 1rem。図案の全周、斜めの突起、最狭部、偏りを固定版の実画像で比べる。外形や計算値が同じでも、全周の余白条件を満たした証拠にはならない。

## 可視間隔の目標と固定版の制約

IllustratedAction／PlaceEntryの図案と枠内周の間には約2 CSS pxの可視余白を目標とする。四辺や中央真下だけでなく、斜めの突起を含む全周の最狭部と偏りを確認する。Home／Townのメニューは図案と文字の可視端の間隔を8 CSS pxとし、可視図案と字面の上下中心を揃える。これらは本章の拠点UIに限定した目標であり、共通DSの全画面へ適用する値ではない。

固定版の仲間・ダンジョンには、図案と金線の局所的な接触が残る。この接触を含む配置・縮尺・輪郭・原frameが固定版への一致対象であり、約2pxの全周目標を完全達成した状態とは区別する。固定版を再現する実装で余白を埋め合わせる再調整は行わない。意匠を変更する場合は本人のデザイン改訂を要し、この局所接触を他の部品や画面での一般的な許容へ広げない。

メニューのCSS gap 5pxは、図案と字面の可視間隔を作るlayout値である。固定版との比較では可視端と上下中心を確認し、透明なbox端どうしの距離やCSS gapを目標値8pxへそのまま置換しない。

## 色・文字・状態

root 16px時、横長ラベルはNoto Serif JP 700・32px・行高1.2、場所ラベルは同700・24px・行高1.4・字間0.02em。通常操作はNoto Sans JP 400・16px・行高1.5、本文は同400・16px・行高1.6、dialog見出しはNoto Serif JP 500・24px・行高1.4。fontの実ファイルとfallbackはCSSで管理する。

通常面は`#fff8e9`、縁は`#6c5437`、文字は`#3e3326`。通常操作のhoverは`#f0dfbe`、pressedは`#dec9a4`。横長ラベルは通常`#3e2b12`、hover／pressedは`#173a55`、pressed時は下線を加える。図案とframeのbytesを状態色で置換しない。

focusは`#28526e`の2px outline・offset 2pxと白の外周で示す。通常・hover・pressedと併存し、外周を切らない。disabledは実際に無効な通常操作へ適用し、破線と理由を示す。アイテム入口は現在表示のみであり、未接続を理由にdisabled意匠へ変えない。

メニュー記号は23×18px、close記号は1.5rem角。これらは図案の描画領域であり、可視の線と字面との距離をそのまま表すものではない。メニューの可視間隔とlayout値は[可視間隔の目標と固定版の制約](#可視間隔の目標と固定版の制約)を参照する。

## 日付

日数はDAYの右へ横1行で示す。昼／夜の表示範囲、数値の有効領域、表示寸法はJSONとHubCalendarで管理する。日数ごとの位置補正は設けず、tabular numeralsの文字を有効領域の中央に配置する。1〜3桁を対象とし、4桁の収容は要求せず、縮小・枠延長・2行化で帳尻を合わせない。

日付と移動ボタンは、指定された文字直下の横線を整列の比較対象にする。太陽／月、画像全体、DOMの下端をその線へ読み替えない。昼と夜は原画像の寸法が異なるため、全体の高さを横長ボタン高へ潰さない。

## 配置と表示条件

基準は1920×1080・DPR1。背景原画像は1672×941で、中央のcover表示。拠点の図案・frameは原画像を保持し、表示寸法と図案の部品内配置を整数CSS pxで管理する。寸法は`hub-art.json`を参照する。背景上の場所anchorは基準座標からcover変換して整数pxに丸め、当たり判定の左上とは区別する。

wideは幅900px超、高さ650px超、横長を候補とし、主要部品が端6px内へ収まり、互いにroot 1rem相当以上離れる条件を確認する。収まらない場合はcompactへ切り替える。compactは通常flowで、上から結果・メニュー／close・入口・移動と日付の順。場所一覧は10rem列のgridで、文字拡大時は収まる列数へ折り返す。

wideの移動・日付群は右端24px、間16px、移動ボタン下32px。メニュー／地図closeは右3rem・上1.75rem。画面ごとの入口位置は各仕様を参照する。下部で視認性を支える面や帯を含め、固定版の表現を無断で削除しない。追加の帯を全画面共通の必須部品にもしない。

## 確認対象

各完成部品の通常・hover・pressed・native keyboard focus、日付の昼夜・1〜3桁と4桁overflow、非空の結果、メニュー・確認・待機・失敗、compact・root文字拡大を対象へ対応付ける。背景と隣接部品を含む局所、全体、3画面間を比較する。

固定版への一致、全周余白等の個別要求の達成、操作の保証、本人の判断を分ける。採用された画面であることを、以前の全数値目標の完全達成へ読み替えない。検証方法は[制作手順](../ui-asset-production.md#figmaからの実装と直接比較)と[テスト設計](../testing.md)を参照する。
