# 仕様テスト整備の検証記録

恒常的な方針は [テスト設計](../testing.md)、仕様の正本は `specs/`、具体的な入力・assertionは各テストコードに置く。この記録は今回の変更理由と検証証跡であり、全assertionを転記する日常台帳ではない。過去の静的監査は [固定commitの記録](https://github.com/karin0624/endfield_rpg/tree/8bee4b79fac4bb95490efa8fc3fc064aa405d640/docs/testing-audit/2026-10-03) を参照する。領域間に重複する監査行数を一意の仕様数やcoverage率と扱わない。

## #102の責務分離とローカル検証

ブラウザ非依存の明示状態と意味イベントでゲーム結果・画面遷移・draft・focus・dialog・演出を決め、ブラウザ接続は入力の変換と結果の適用だけにする。表示は代表snapshotから実UI・素材を直接描いてVRTで確認する。ゲーム進行やクリック連鎖を通すE2Eは廃止する。追加の実ブラウザ検証はrendererへ直接作用するWebGL資源の生成・切替・破棄に限定する。

入力は現在状態へ順に同期適用する。閉じた画面で未定義の操作は受け付けず、開き直した画面の操作は再び受け付ける。`event.detail`、時間窓、直前入力の履歴、汎用ID台帳で一般入力を抑止しない。ゲーム内の時間と演出の再生時刻、外部資源の所有対象識別は入力の重複抑止と分ける。

編成と人物詳細を先行移行した。`partyModel`は現在の実`ExpeditionGame`へ編成確定・出発のコア遷移を同期適用する。未確定の選択番号・modal・focus復帰・scroll位置は別の画面状態に保持し、DOMを正本にしない。Nativeの`partyView`は意味イベントを通知し、確定した表示投影を描く。候補の正当なtoggle二回、欠番の確定、詳細の読取り、再表示後の再入力、成長・帰還後の現在値はheadless結合テストへ移した。

この区切りでは全headlessの発見・実行708件が成功し、編成・詳細の23件について新presentationのnative V8計測も確認した。直接snapshotを描く4ケースで既存11画像のVRTが一致した。初回の候補focus ring差分は、撮影前のnative入力modalityを元の条件へ合わせて解消した。製品CSS・素材・既存基準画像・許容差は変更していない。件数はこの時点の観測事実であり不変要件ではない。

続いて本編の非戦闘画面・街・会話・買物・成長選択を移した。本編とdebugセッションはそれぞれゲーム状態の正本を一つ持ち、子画面は未確定draftとfocus・dialogだけを保持する。保存は先に保存待ち状態を同期確定し、I/O効果の結果を別イベントとして受け取る。街の回復は現在の街探索の完了から同期確定し、架空の回復signalと入力時刻・購入versionの照合を外した。入口ごとの買物能力は純粋な入力で明示し、debug市場へ新しい操作を増やしていない。

この区切りの`npm run check`は54ファイル・753ケースの発見／全実行／成功とgame・presentationのV8 gateを確認した。この時点のpresentation全体は文561/566、関数119/119、分岐846/906だった。通常タイトルを実minified配布から、その他を同じ標準minifierの複数HTML入口buildから直接描き、キャンペーン10画像と会話2画像が別の部分実行で一致した。通常配布へのfixture混入はなく、fixtureは`/rpg/`配下の実素材URLを使う。最初のfocus ring・debug badge・hover差と、撮影準備のlocatorタイムアウトは失敗証跡として別に保持した。helperの配置変更後の最終head全VRT成功には読み替えない。

長いキャンペーンの状態遷移は実コアの意味入力をheadlessで実行し、各HP・疲労・習得・帰還・時刻・RNGを確認した。保存時の育成RNGの正規化を内部形状の一致で固定せず、読込後と未中断の次の実街操作の結果も比較した。画像fixtureは確定した代表snapshotだけを描き、ゲーム進行を再実行しない。これらの部分検証は全体の最終検証を代替しない。

戦闘の確定イベントに各HP結果・一回の負荷・発症結果を持たせ、演出モデルは確定値を表示へ割り当てる。現在phaseの速度を固定し、次phaseへ速度変更を適用する。DOMの最新標本とcanvasの最後の描画標本は別の表示入力であり、ゲーム規則を再実行しない。探索・debug・本編は親の単一ゲーム状態へ命令を同期適用し、敗北帰還が先に確定しても戦闘表示と資源は演出終了まで保持する。ルートのpan・focus・分岐回復・成長復帰も意味イベントへ移した。native幅・画像範囲・深度は測定入力として扱う。

この区切りの`npm run check`は61ファイル・782ケースの発見／全実行／成功とgame・presentationのV8 gateを確認した。実編成3／4人と控え、各HP・行動順・再対象選択、回復後の発症・被弾・残数、敗北帰還と旧表示、会話・成長・focus復帰を独立した結果で確認した。部分実行で既存戦闘8画像とルート2画像が一致した。ルート初回の差分はCSSの小数幅をnative整数測定で上書きしたことが原因で、通常CSS幅を保持して解消した。失敗ログと画像は別に保全し、無関係な旧artifactや部分実行のcoverageを全件成功の証拠にしない。

構図・会話エディターのraw入力、全フィールドの検証、最後の有効preview、draft、保存待ち、focusを純粋モデルへ移した。保存結果は発行したsnapshotで確定し、会話設定の保存待ち中にcurrentが変わった場合は最新draftを保持する。Nativeは入力の変換、Storage・HTTP結果、実地形へのray測定と値の適用を担当する。確認人数の表示配置と全編成の保存判定用接地点は純粋投影で分け、通常戦闘の可視frameをNativeの人数判定で上書きしない。

この区切りの`npm run check`は63ファイル・793ケースの全実行とgame・presentationの既存V8 gateが成功した。構図3画像と会話2画像は同じ標準minifiedの直接fixtureから描く2ケースで既存基準に一致した。本編・debugの実親モデルで、敗北帰還、保存再開、5回療養後の再保存・読込、6回目の復帰と再出発も独立したHP・回復残数・生活時刻・RNGで確認した。設定スキーマ移動前の検証用コピー先による失敗は修正し、失敗ログを別に保全した。これらは全ブラウザ構成の最終成功や5分以内の証明ではない。

Native資源検証はrendererへ直接create／switch／disposeを行い、warm三往復の資源数と地面HTTP一回、保留した実素材の旧owner完了、DPR／描画倍率、素材失敗、pagehide、必要時HMRを確認する形へ移した。ゲーム操作journeyは通さない。旧controller、旧timer演出、Nativeの対象選択判断、使われなくなったfixture／操作ハーネスを除去し、純粋モデル・projection・直接viewへ一本化した。

背景404の以前の4ケース成功は限定した部分結果だった。後続の第五実行で再発し、実allocation診断でScene／Engine破棄後のProgram・Texture生成を確認した。glTFのCOMPLETE待ちやmaterial compileだけを原因・解決と断定せず、実RGBD shader準備を保留して正常素材の読込途中退出も再現した。最終renderer closeは入力／RAFを即座に終了し、標準Scene pendingとScene所有BRDF readinessが終了してから実Scene／Engineを解放する。既にreadyなら同期解放する。現在BattleSceneのreadyはその場面自身の準備だけを待ち、新しい環境を古い保留importで止めない。AssetContainerの所有はimport完了時点で取得し、fingerprint metadata待ちへ遅らせない。

第七の部分実行では、論理退出後に実GPU生成が完了し、その後deleteされ全資源0になることと背景404の解放を確認した。第八は20中19成功で、独立構図のdefault比較だけが失敗した。元画像がcanvas上のDOM overlayも含む条件と、default更新後の次BattleScene／HUDのfresh初期化を直接fixtureへ保った。第九は全headless793成功とNative／構図の2ケース成功だったが、build中のground fixture変更により一つのmap sourceが現行と異なった。実build sourceと不一致を保全し、この2ケースを現行fixtureの成功と扱わない。

実行構成は既定`views`／`renderer`と必要時editorの直接VRT／Native HMRへ整理した。通常buildをcheck内で一度作り、現在の実HTTP／配布FS検証と初期タイトルVRTで共用する。debugと任意state fixtureは異なる実入口として標準minifierで各一度buildする。CIはverifyの通常artifactとintegration SHAをbrowserへ渡し、先行通常build・coverage専用再build・録画journeyの重複起動を行わない。実configから必須project／coverage集合を導き、全git spec・無filter discovery・今回JSONを照合する。未知の品質specディレクトリも未発見なら拒否する。

この清掃時点の型検査と実CLI／Storage部分検証は3ファイル12ケース成功だった。各実画像比較へ渡した旧baseline pathを標準snapshotPathで記録し、最終成功JSONから54のunique path使用を照合する。保持bytesだけを実行済みの証拠にしない。

狭幅・詳細等の旧撮影資料30枚を、同じ実コアの確定snapshotとNative表示条件から直接取得した最終比較は30枚取得／失敗0、21枚が完全一致だった。撮影処理はpreview・browser起動と終了を含め48.365秒で、先行build・Docker起動や原因調査の失敗反復は別の費用である。狭幅詳細では、変更していないCSSの実scroll ownerが本文全体になるのに情報欄だけへscroll位置を適用していた接続を修正した。分岐の16px差はNative modal終了のopener focus復元によるoverflow scrollを同じviewへ直接描いて再現し、背景・状態を変えず解消した。

残る9枚は背景fixtureボタン端の14pxが2枚、長名の確定ボタン飾り端152〜223pxが4枚、低い画面の画像端11px、dialog角13px、購入ボタンのhover遷移中の色10,661pxである。旧資料にはNativeのsubpixel矩形・撮影時刻等がなく、完全一致は未確認とする。旧購入色は変更していないCSSの通常色とhover色の中間で、静止した両端へ合わせても一致しない。製品CSS・位置・確定状態・基準画像・許容差を残差へ合わせていない。これらの参考画像を新たな承認済みgoldenにしない。

参考画像の比較結果と、以下の正式な54基準によるVRT・全体検証は別の証拠である。参考画像の残差を基準画像の変更や許容差増加で隠さない。

最初の全体実行はheadless795件とbuild成功後、未対応のsnapshot template token `{configDir}` がliteral pathとなり、画像比較前に基準ファイル不在で失敗した。全VRTに共通する構成不備として中断し、179.388秒・exit130の失敗資料を保全した。公式の相対template `tests/{arg}{ext}` へ修正し、基準path・bytes・matcher設定は変えない。この中断実行を全品質成功や性能達成へ数えない。

### 全体検証と残る時間条件

検証した実装はローカルcommit `24692b5bc06fd7810ac403faab6617de79ca6bfe`、tree `c5ca4d91e29a4cd1560f055dedb832c344988788`。固定Playwrightコンテナで実際の `npm run test:all` を起動からshutdownまで直列実行し、2026-10-04 22:58:09〜23:05:02 UTC、wall **413.243秒**・exit 0だった。既存依存がある状態でもwrapperの `npm ci` を実行しており、その費用も含む。後続の検証記録更新だけを含むheadを、この実装headの実行結果に読み替えない。

全headlessは63ファイル795件成功、game・presentationのV8閾値と発見／実行ゲートも成功した。通常・debug・viewは各一度の標準minified build。ブラウザは実configの4project・12ファイル31件が一回ずつ成功し、retry／skip／期待失敗／global errorは0、各ケースのcoverage収集と実行照合も成功した。成功ケースの標準snapshot annotationから得た54のunique pathは旧54基準inventoryと一致し、missing／extraは0。実sourceと全compiled mapの不一致は0、実行前後のhead／tree、449 trackedファイル、CSS・素材・基準等162ファイルとLFS実体の変更も0だった。

| 観測範囲 | 時間 |
| --- | ---: |
| 起動・npm ci・check・必要build・全ブラウザ・coverage／全gate・shutdown | 413.243秒 |
| Playwright native run全体 | 336.627秒 |
| ブラウザ各caseの合計（共通fixtureを含む） | 326.255秒 |
| case合計：views／renderer／editor-views／editor-resources | 124.333／73.721／109.930／18.271秒 |
| Playwright外のwall（npm ci・check・build・起動／終了等） | 76.616秒 |

Vitestは従前の標準forks・file parallelism、実コンテナではmaxWorkers 4、Playwrightは1workerで、目標に合わせて並列設定を増やしていない。Vitest nativeは24.70秒、npm ciの表示は丸めた14秒、Vite表示は通常／debug／viewが1.47／1.38／1.12秒だった。これらの部分時間は上表の内数で、前処理や起動を含むコマンドwallとは異なる。Playwrightのcase外10.372秒を全てcoverage変換の費用とは扱わない。

第二の全体実行は30成功／1失敗・411.654秒で、同じsceneの設定更新時にfixtureがモデル／viewを新規生成し、初期選択とHUDをやり直していた。旧撮影条件と実diffを確認し、同じsceneの更新はモデル／viewを保持する責務へ直した。通常のfresh生成と、独立5条件のdefault更新後に次BattleSceneが設定を引き継ぐ検証は維持した。単独診断の3画像一致後、上の第三全体実行で全gate・全54基準を再確認した。第二はPlaywright失敗後の実行ゲートに到達しておらず、全gate成功に数えない。

成功sourceを保持して、標準CDP Profiler／PerformanceでNative準備と撮影を別に測った。初期準備7.118秒、warm切替1.739秒、内部構図更新4.042秒、previewの撮影2.558秒が観測された。CPU sampleにはray／vector計算と大きなNative処理の双方があり、TaskOtherをGPUだけ、coverageを唯一の原因とは断定できない。既存の接地cache・静止時の描画抑止・同値frameの抑止は既に働いており、重複cacheを追加していない。

[Babylonの標準submesh最適化](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimizeOctrees/)を隔離コピーで評価した。installed 9.27の `Mesh.subdivide(64)` の算式を実素材のindex数へ適用すると、一meshの末尾6三角形が分割範囲から欠けるため採用せず（これは算式による分析で、実method呼出しの結果ではない）、標準 `SubMesh.CreateFromIndices` で元の全index範囲を連続分割する一候補だけを試した。対象17meshのindex／position vertex生bytes、全範囲とmaterialIndexの変更は0、選抜5ケース・既存17画像assertion・warm三往復／素材HTTP一回／退出時GPU 0は成功した。しかし初期準備は6.119秒、warmは1.979秒、内部構図は3.978秒、preview撮影は2.697秒となり、ray sampleの改善は必要なwall短縮へ結び付かなかった。四隅caseも36.525秒で、元全体実行の26.837秒より遅い。各cold一回で分散未評価・部分実行と全体実行の条件差もあり、113秒の短縮を支持する結果ではないため製品へ採用しない。起動不備と候補の初期化例外は別の失敗記録として保持し、成功性能へ混ぜない。

旧58bでのtrace filmstrip停止と小viewportの診断も有効な改善を示さず、設定を変えていない。[V8公式](https://v8.dev/blog/javascript-code-coverage)はprecise coverageの実行回数計測が最適化コンパイラを止める費用を説明するが、Playwrightの公開APIを迂回する独自collectorや粒度の弱化を採用する根拠にはしていない。rendererのfresh境界、全54画像、全収集／実行gateや必要時editorを削って5分達成とはしない。

全品質検証は成功したが、300秒まで **113.243秒不足**している。今回確認した標準候補では必要短縮を実証できず、同品質のあらゆる実装で5分以内が物理的に不可能だという証明も成立していない。**#102の時間条件は未解決で、公開停止を継続する。** 生log／JSON、source固定とmap／54基準照合、Native CPU profile、候補の失敗・不採用根拠はローカル証跡へ保存した。旧参考30枚の取得48.365秒と失敗反復は全体wallとは別費用であり、54基準の成功でその残差まで一致したとは扱わない。

## 再開後の準備削減と撮影条件の確認

実CLIの8回のwrapper実行を4回へ整理した。browser／editorの実report生成、古いJSONを置いたfiltered実行のreporter置換拒否、native list-onlyの未実行拒否は実CLIに残す。未登録ファイル、coverage欠落、editor部分結果とall scopeのinventoryは実CLI生成済みreportに必要な差を与え、実Git inventoryと照合する。単独検証は8.41秒、全`npm run check`は63ファイル・795ケース成功、Vitest表示durationは11.64秒だった。これはhost wrapper全体のwallではない。Browserのcollector／詳細粒度／minification／VRT／全projectは変えていない。

旧参考の未解明6差分のうち編成5枚は、旧Native sourceの隔離再現で元rawと全pixel一致した。現行の直接snapshotではdevelopment配信へ替えても同じ微小差が残ったが、元のNative詳細dialog開閉履歴を与え、clickで変わった実grid scrollをモデルsnapshotへ戻すと5枚とも全pixel一致した。最初の隔離試行はscroll通知をclickの前に採ったため候補領域が異なり、後の通知で条件を揃えた。これは一回の参考条件の診断であり、ゲームjourneyを品質suiteへ戻したり、完成画像や基準PNGを追加したりしていない。標準minified配信の追加照合とショップ390pxのcorner差はこの区切りでは未確認。旧参考30枚の既存計測と正式54画像VRTの保証は分ける。

停止前の工程別診断は全stage成功・402.472秒で完了していた。npm ci 16.113秒、unit discovery 4.535秒、unit実行／coverage 21.723秒、三build計5.222秒、Browser実行334.048秒、終了時global teardown 4.485秒だった。expanded commandsの診断であり、既存の正式host wrapper 413.243秒とは起動方法が違う。残るcase費用をcoverage集計やGPUだけへ帰属させない。今回のcollector annotationで実回収費用を分離し、準備削減後の直列全体を先に測る。並列化はその後に同一runnerの2workers、2shard、独立工程を比較し、Actions上の性能をローカル測定から断定しない。

## 直列と標準2workersの比較

準備削減後の固定head `0f5207e`で、正式host wrapperは直列398.187秒、`--workers=2`は301.204秒だった。どちらも単体795件、Browser31件、54画像、4projectのcoverage／全実行gateが成功し、449 tracked filesと162保護ファイルの変化は0、三buildのmap原文不一致は0だった。Browser wallは直列332.230秒／2workers236.411秒、直列case回収は計8.019秒。2workersのcase duration合計453.722秒は並行latencyの合計であり、CPU消費やnoncase費用とは扱わない。warm caseは23.1→32.2秒、単独設定caseは50.6→73.3秒となり、同一マシン内の競合もある。現在の環境はcpuset 5 CPU、quota 4 core相当、メモリ上限16GiBで、2workers途中のcontainer memory peakは約3.17GiBだった。途中cgroup値は最終CPU総量やGPU利用率を示さない。

標準 `--shard=1/2`／`2/2` の未実行discoveryは25件／6件へ分かれ、先の直列実測重みは192.229秒／129.894秒だった。件数も費用も均等ではない。現collectorは一回の全project run後に集計し、partial shardは今回の全実行gateを通らない。別runnerへ分ける案にはblob reportの標準merge、coverage cacheの独立所有／全体集計、全無filter discoveryとの照合が必要になる。同一マシンの2shardはCPU quotaを共有し、server／processの準備を増やす。独立工程の並列化で隠せる三buildの既存実測は合計5.222秒に限られる。これらを未測定のActions wallや別runnerの計算時間へ読み替えていない。

Vitestのcollectionを既存公開Reporterへ統合した。実行前の全ケースを保存し、stock JSONに見かけの成功として出るretry／期待失敗の拒否を保つ。name filterの外に残るケースもNative collectionへ記録され、結果照合で未実行を拒否する。実CLI5条件と全`npm run check`63ファイル・796ケースが成功した。単独設定5条件は同じfresh constructor、同じdefault更新→次sceneと10画像assertionを保ったまま独立caseへ分け、editor-viewsだけ標準case並列配分を許す。少なくとも前比較の73.3秒一caseが不可分の末尾へ残る問題を解消するためで、保証の省略はない。既定worker数はこの区切りでは1のままで、変更後の全体wallは未測定。

旧編成5枚は標準minified配信でも元rawと全pixel一致した。ショップ390pxの13pixel corner差は元の直前320px captureを与えても残った。CSS／素材／基準／許容差の変更で消しておらず、原因は未解明のまま保持する。

固定head `6af5545`の全2workers比較は302.068秒、単体796件／Browser35件／54画像／4coverage projectが全成功した。Native wallは244.337秒で、source449／保護162の前後変化とmap原文不一致は0。既定は1workerを維持し、この比較を直列5分以内や実行不可能の証拠にはしない。

重いNative手順を隔離して計測した。通常と同じ呼出し単位の設定5ケースは、初回create→start→readyのNode wallが5.554～11.777秒、default適用→次scene→readyが1.967～3.498秒、各既存画像比較が0.532～0.825秒、pagehide→GPU 0が0.033～0.059秒だった。browser内の更新JSは配置3条件で1.274～1.536秒、背景／カメラでは0～0.003秒。Node wallとの差にはNative処理・protocol・task scheduling等があり、GPU時間へ一括帰属しない。別CDP呼出しへ分けた初回probeは間に余計な描画を許すため性能比較へ使わない。実backendはANGLE／Vulkan SwiftShader、GPU timer extensionは利用不能だった。

元のwarm三往復caseは26.3秒、初回ready 7.923秒、各small／full準備は概ね1.5～1.6秒だった。取得・decode・shader準備・実初期drawはreadyの中で重なるため、独立測定していない内訳を推測で分割しない。責務整理ではfullだけの同じ三往復を、最初のfull／smallと一回のwarm往復で両状態の実資源数を照合する形へ変更した。旧ownerへの更新が無効、実GLB取得一回、RAF取消、退出後とresize後のGPU 0、page errorなしは維持する。

素材照合の利用不能／拒否を実WebCrypto I/O境界へ移した。実LFS GLBの既知SHA-256、subtleなし／cryptoなし、digest拒否を検証し、未照合から元材質の純粋判断と、既知・未検証・同パス別bytesの実PBR画像／HTTP一回はNativeに残す。重複していた元材質PNG二回を省くためで、基準54画像のpath／bytes／許容差は変えない。この区切りの変更後の全検証と正式直列wallは未完了である。

固定head `0e4c5c9`の正式直列全体は379.923秒で、単体800件／Browser33件／54画像／4coverage projectと全実行gateが成功した。Browser wallは308.698秒、case回収8.167秒、source451／保護162の前後変化とmap原文不一致は0。warmは17.104秒となり、同じ素材・失敗・旧owner・両状態の資源非増加・退出0を実行した。時間条件はまだ79.923秒超過している。

GPU描画submeshを増やさずNative rayを分割する標準Mesh.clone／SubMesh.CreateFromIndicesの隔離候補も比較した。同じ6ケース・10画像assertion・元のwarm三往復・GPU 0で基準90.279秒、候補86.293秒、全成功だったが、cold単発で分散未評価・一部条件は遅化し、必要短縮を支持しないため製品へ採用しない。

画像比較のないrenderer／editor-resourcesのviewportを既存DPR条件800×900へ揃えた。変更するのは資源観測の描画面積で、全実素材・shader・三角形・Native初期draw・切替／失敗／遅着／HMR／解放とDPR両条件は残す。VRTのviewport／DPR／PNG／許容差は変更しない。この変更の全実行・正式wall比較はこの区切りでは未完了である。

固定head `0a63c22`の正式host wrapperは、既定1workerで389.228秒、CLI `--workers=2`で285.429秒だった。両方で単体800件／Browser33件／54 unique基準画像（62画像assertion）／4coverage projectと全実行gateが成功し、failure／skip／retry／flaky／global errorは0、source451／保護162の前後変化と三buildのmap原文不一致は0だった。Browser wallは314.896秒／214.067秒。case duration合計は304.655秒／397.052秒で、並行case latencyの増加をCPU消費へ読み替えない。資源case合計は前headの62.656秒から56.374秒へ減ったが、別caseの変動で直列全体は遅くなり、viewport変更の全体改善を実証したとは扱わない。

同じ準備済みminified JSと既存Native手順6ケースで、precise coverageあり90.279秒／なし86.151秒、両方全成功だった。出力JSの前後SHAは一致し、Nativeの素材・構図・画像比較・warm三往復を変えていない。cold単発で分散未評価、coverageなしは部分性能診断で品質成功ではなく、終了時全体集計も含まない。回収timer8.167秒だけで実行中のV8費用を代表させず、この比較から残り費用をGPUだけへ帰属させない。

既定1workerは維持する。2workersの全品質285.429秒は同一マシンの標準並列比較であり、直列5分やActions複数runnerの性能の証明ではない。2shardは以前のdiscovery配分だけで実行／merge未測定、独立工程並列も未実測のまま。今回の2workers cgroup読取りは終了・container自動削除後になり、CPU／memory値を取得できなかった。前headの途中peak3.17GiBを今回の値に流用しない。直列は300秒を89.228秒超過し、同品質で直列5分が不可能という証明も未成立なので、#102の公開停止を継続する。

## 代表ケースの時間軸と描画待ちの対照実験

固定head `a04880c`、同じ標準minified build・実GLB・fixture・1workerで `only-ground-scale` 一件を調べた。品質ゲートの全体再実行ではなく、既存の初期画像とdefault更新後画像の2assertionを保った部分診断である。標準Reporterのstepを終了時に保存し、別の実行では初期化区間だけをCDP Tracing／ProfilerとResourceTimingで観測した。製品・通常テストへ常時計測や分岐を追加していない。

計測traceを外した代表一回の、Native stepの相互に重ならない時間軸は次の通り。fixture/API/expectの子stepは各行の内数である。

| test開始からの秒 | 区間 | wall秒 |
| --- | --- | ---: |
| 0.026～0.342 | Before Hooks（browser／context／page／coverage開始） | 0.316 |
| 0.342～0.629 | 通常fixtureへのnavigation | 0.287 |
| 0.629～4.514 | fresh create→start→ready、一つの通常API呼出し | 3.885 |
| 4.515～8.628 | 初期承認画像の取得・安定待ち・比較 | 4.113 |
| 8.628～10.222 | default適用→同じrendererの次scene→ready | 1.594 |
| 10.224～12.523 | 次scene承認画像の取得・安定待ち・比較 | 2.299 |
| 12.524～12.536 | ResourceTimingの終了時観測 | 0.012 |
| 12.537～15.600 | After Hooks（coverage回収、page/context終了） | 3.063 |

step和は15.569秒、開始から最後のhook終了まで15.600秒、和の外は0.031秒だった。回収annotationの2.700秒はAfter Hooksの内数で、再加算しない。stock `TestResult.duration` の15.333秒はtimeout slotのelapsed合計であり、全stepのwallと同一の時計区間ではない。installed Playwrightの算式を確認し、差を負のoverheadやGPU費用と解釈しない。起動／server終了まで含む全CLI wallとはさらに区別する。

隔離コピーへPromise区間とBabylonの公開render／shader observableを加えた細分化では、初期GLBのResourceTimingは0.349～0.944秒（実転送58,790,696 bytes）、fetch応答待ち0.082秒、bodyのarrayBuffer待ち0.564秒、GLB import・mesh/material/texture準備0.691秒だった。actor準備0.013秒、初期ground設定1.632秒（4ray合計1.629秒を含む）、mesh/shader readiness待ち2.480秒、scene renderコマンド発行0.046秒を観測した。texture準備・HTTP・import・readinessには重なりがあり、純粋なGLB/image decodeやshader compilationへ分解できたとは扱わない。source観測付きコピーと通常sourceの条件差もあるため、この数値を上の一回のwallへ足し合わせない。

通常sourceの標準Chromium traceでは、初期canvas Commitに `GLES2::ReadPixels` の3.418～3.698秒が含まれ、同時刻にGPUプロセスのWebGL command処理が進んでいた。`scene.render()` やdraw APIが返る時刻はこの完了時刻ではない。ReadPixelsは先行描画の待ちを含むので、純粋なreadback／PNG／shader／GPU経過時間とは呼ばない。backendはANGLE Vulkan SwiftShader、GPU timer extensionは利用不能で、GPU経過時間・利用率は未計測である。Profilerのsample weightや `(program)` もCPU消費・GPU時間の測定値ではない。

同じsource・fixtureの計測あり／なしを比較した。各条件はfresh process/contextのcold一回で、分散は未評価。trace停止が先行canvas Commitの待ちを吸収するため、停止のwall全体を計測overheadとしない。

| 条件 | 初期API＋trace停止＋初期画像比較の秒 | 次scene API＋画像比較の秒 |
| --- | ---: | ---: |
| 追加traceなし、precise coverageあり、通常trace off | 8.219 | 4.042 |
| 追加traceあり、precise coverageあり、通常trace off | 9.251 | 3.317 |
| 追加traceあり、precise coverageなし、通常trace off | 8.421 | 3.236 |
| 追加traceあり、precise coverageあり、通常trace retain-on-failure | 8.694 | 3.236 |

通常traceの有無でAPI／画像検証への費用の現れ方が変わるが、合算区間の大幅短縮は実証していない。coverageなしは原因調査の対照であり、正式な品質成功へ数えない。coldの約2秒区間もJS callbackやNative uniform-block待ち等へ現れる位置が異なり、一回の関数self sampleだけから純粋なshader JS処理を支配原因と断定しない。

読み込みと描画を切り分けるため、初期の通常画像を通してGLB・texture・buffer・shaderを準備した後、次sceneの描画直前にBabylonの公開 `mesh.isVisible` だけで実PBR地面78meshを表示／非表示にした。両条件で製品bundleのSHAは一致し、変更は隔離fixtureの公開observable callbackだけである。actorのground rayと通常のapply→start→readyを保ち、同じ実canvas取得を二回行った。

| 対照組 | 地面表示：次scene API＋2画像取得の秒 | 地面非表示：同区間の秒 | ReadPixels wall（表示／非表示）の秒 |
| --- | ---: | ---: | ---: |
| 1 | 4.150 | 2.106 | 1.813／0.060 |
| 2 | 4.254 | 2.218 | 1.855／0.074 |

各実行はfresh process/contextで初期GLBの実HTTP取得が一回あり、warm区間の追加GLB取得は0。表示条件のdefault画像は両方とも既存基準との差0、各条件の二画像も完全一致した。非表示条件は543,030画素が意図的に異なり、品質実装への採用候補ではない。この対照で、準備済みの次sceneにも地面描画／Native command完了が画像取得の遅延へ大きく寄与することを確認した。初期化の全費用が描画だけであることや、純粋なGPU所要時間を証明していない。

初回にも、同じ準備・mesh/material readinessを通した後の地面表示だけを切り替えた。ReadPixelsは表示3.884／3.478秒から非表示1.113／0.987秒へ減り、最初の実画像取得は4.410／3.981秒から1.562／1.370秒になった。初期APIは表示5.353／4.234秒、非表示4.140／5.240秒と逆方向に動き、読込時間だけで取得区間の減少を説明できない。表示2条件は元の初期基準と差0、非表示は570,306画素差で、各条件の二画像は一致した。初期の約3.5秒にも地面描画の寄与を示すが、driverがshader/pipeline準備を実描画へ遅延できるため、純粋なraster時間を取り出したとは扱わない。

さらに地面を非表示にしたまま背景・actor等9meshの表示だけを切り替えたが、残る初回ReadPixelsは一貫して減らなかった。API内の待ちと画像取得の待ちが移り、非表示側のcold変動も大きいため、残り約1秒をactor描画と断定しない。GLB・texture等の準備は両方で通っており、残る準備／driver pipeline／転送の分離は未了である。

通常sourceの代表一回で標準CDP `SystemInfo.getProcessInfo` も使った。これはprocess内の全threadの累積CPU使用秒である。初期API後から既存画像検証終了まで5.004秒の間にGPU processは12.380 CPU秒、rendererは0.560 CPU秒、browserは0.360 CPU秒増えた。次scene API後から画像検証終了まで2.514秒では、それぞれ7.120／0.140／0.290 CPU秒だった。SwiftShaderを動かすprocessで相当のCPU処理が進む証拠であり、GPU経過時間・利用率ではない。複数threadのCPU秒はwallより大きくなり得る。Node側の画像比較／collector CPUはこのprocess集合に含まない。5checkpointのAPI呼出しwall計約13msを別記録し、task schedulingへの影響とcold分散は未評価とする。

installed Playwrightでは `Frame.evaluateExpression` にtrace snapshotが付き、serverは応答送信前にafter-callのsnapshot captureを待ち、snapshotは既存renderer main contextで評価される。このsourceとtrace有無の対照から、GPU command完了を待つcanvas Commitへsnapshot要求が連鎖し、ready以後の費用がNode API応答へ現れる経路が説明できる。待ち全量をsnapshot作成CPUやPlaywrightだけの費用と解釈しない。

同じ1worker・source・画像比較でCPU affinityを5 CPUから4 CPUへ絞る標準実行環境の対照も二組調べた。初期合算は5 CPUで8.825／8.641秒、4 CPUで8.673／10.126秒、warm合算は3.186／3.201秒から3.394／3.485秒となり、一貫した短縮はなく採用しない。container自身のquotaは無制限だが祖先の4 core相当quotaは維持されており、自身のthrottled=0を祖先の無制限と取り違えない。Nativeコマンド全体のCPU使用量約32～34 core秒は、renderer/GPUだけの使用量ではない。

これらは重い一件の原因調査であり、全体5分の達成や不可能性の証明ではない。正式全体の直列389.228秒、既定1worker、全54基準画像、全project／coverage gate、公開停止を維持する。新しい製品最適化・test削減・既定並列化はこの診断から採用していない。

### 旧raw shop画像の追加対照

390pxの旧rawとの差13画素（左下角、最大channel差2）は、同じ現在sourceのfresh process/context六回でも5回が差0、1回が同じ13画素となった。320pxの前回撮影でpointerを先に移す／後に移す一条件対照では後者の中でも0／13が変わり、pointerだけを原因とは確定できない。dialog矩形 `x=19, y=317.3125, width=352, height=445.359375`、最終focus／hoverは六回で一致した。旧Native UIを元のlazy stylesheet読込順で読み、旧公開headless coreのmarket開始・購入処理と二回の実Native購入を通した別対照でも、旧側13／現在側0が現れた。最初のstatic import試行は元とCSS挿入順が違い、font／geometryも違ったため、外観回帰の証拠へ使わない。

これは同じsource／観測されたgeometryでも単発raw出力が変わる観測であり、13画素の内部描画原因まで解明していない。AAと断定せず、旧rawを正式54基準の合否やWCAGへ読み替えず、基準・許容差・CSS・製品sourceを変更しない。

## 現在の保証対応

| 公開結果 | 主な検証 |
| --- | --- |
| 編成draft・欠番・二回toggle・詳細・focus・再入力 | `partyModel.test.ts`、`characterDetails.test.ts`、純粋projectionと直接party VRT |
| 本編／debugの進行・帰還・保存再開・六回療養 | 親子の実コア結合、`campaignJourney.test.ts`、`campaignRecovery.test.ts`。途中のHP・乱数注入なし |
| 各着弾・回復→発症→敵hit・多段・全体・成長・取消・速度 | 実コア結果とplayback／battle／dungeonモデルの独立HP・残数・時刻・乱数、直接FX／route VRT |
| 設定raw・全invalid・draft障害・保存待ち／失敗／再試行 | `editorModel.test.ts`、実HTTPの固定書込先／旧bytes、必要時直接editor画像 |
| 通常配布・素材・Native寿命 | 現行normal artifactの実HTTP／FS、直接初期VRT、実GPU・取得数・DPR・遅着・失敗・pagehide／HMR |

詳細の対応はテストコードと差分で読み、巨大な仕様ID・assertion台帳は作らない。モデル結果をNative幾何の保証、VRTを状態規則の保証へ読み替えない。

## 旧実装の整備・監査記録

以下は [旧head58b32ab](https://github.com/karin0624/endfield_rpg/tree/58b32abffd58fa4a324f2ea099a1dc41acf454db) 以前の経緯で、現在のsuite・API・保証範囲の説明ではない。旧E2E本文は現行の意味モデルと直接VRT／資源検証へ移し、基準PNGだけ元pathへ保持した。version・入力時刻・報酬台帳等の旧内部受理契約は現在状態原則へ置き換えた。判断は[ADR0006](../adr/0006-synchronous-presentation-models.md)を参照する。

### 旧整備時の保証と追加

| 層・技術 | 既存の保証 | 今回補った具体例 |
| --- | --- | --- |
| 静的検査：TypeScript・Biome | 型・整形・lint、配布build | 新しいfixture・HTTPテスト・実行結果確認も対象。runtime仕様の保証とは別扱い |
| 規則：Vitest | 行動順、成長、保存、物品等の公開結果 | 乱数0.5と確率の等値境界、各回の持込み優先消費、成功する重複持込み合算、DAG不正定義 |
| ドメイン接続：Vitest | 探索・帰還・保存の代表経路 | 装備＋成長＋疲労の順序、実戦闘の物品回復後の敵攻撃、負傷控えと療養時計、古い戦闘入力の拒否 |
| 公開I/O：Vitest＋Vite/Node HTTP | 保存APIの正常系と一部不正入力 | 両APIのmethod/origin/content-type、409並行保存、4096/4097byte境界、500でも旧bytes保持、固定保存先 |
| UI接続：Playwright | 対象選択、focus、ARIA、保存導線 | 親capture込みの押し直し、native連続入力の各結果、各着弾HP、表示速度・省略・退出後の実論理状態/RNG |
| 実描画：Playwright＋Babylon.js/WebGL | 初期画面VRT、資源寿命、HTTP取得数、culling | DPR上限、非rootでbuildした実配布、実entryのpagehide。開発HMR・任意設定の構図VRTは下記の必要時suiteへ |
| 通常配布：Playwright | タイトル→探索→帰還→保存再開 | 開発API・fixtureを公開しない短い境界。通常画面10状態の自動画像比較は明示実行のlong suiteへ保持 |

VRTはブラウザの各層で用いる視覚assertionであり、操作・論理規則・I/Oを代替しない。新規基準は現UIの回帰検出用で、ユーザーの完成画像の承認を新たに取得したという意味ではない。共有フォントの仕上げはユーザーが別作業を明示承認した [Issue #99](https://github.com/karin0624/endfield_rpg/issues/99) へ分ける。読めない・操作できない崩れまで免除しない。

### 旧整備時のassertion置換

- 編成ボタンのRGB/outline値、設定画面のCSS変数だけの比較を、必要状態のVRTと保存後の実会話表示へ置換。ARIA・focus・公開保存形式・仕様化されたWebGL資源数/HTTP取得数は維持した。
- 成長関数に渡していない値の不変比較、未使用payloadの自己比較、健康なstateをJSONコピーするだけの回復検証を削除。実保存、負傷・症状・時計を伴う公開操作で保証する。
- 地面倍率だけの重複した負例を、全設定項目の独立した境界入力表へ統合。値域期待は実装定数から再計算しない。
- 録画専用caseを品質testのskipから切り離し、専用evidence設定へ移動。動画・撮影・overlayの生成を自動テストの成功として数えない。

### 旧整備時のレビュー修正

- 品質scriptの引数転送に対し、古い成功JSONを残して`--grep built --reporter=list`と`--list --reporter=list`を実CLIで実行すると、部分実行／未実行が古い結果で成功する経路を再現した。実行前にdiscovery/resultを削除し今回のJSON新規生成を必須にした後、全4project成功経路は通り、後2条件は拒否された。ブラウザを使わない実runnerの回帰としてVitestで実行する。
- Vitestのstock JSONだけでは個別retryや `test.fails` を判別しきれないため、公開Reporter APIで `options.fails`・retry回数・残存errorを検査する。実CLIで通常成功／retry成功／期待失敗／suite期待失敗の4条件を検証し、後3条件を非ゼロ終了にした。
- ブラウザcoverageは終了済みの追加contextも共有fixtureで検出する。分離した実行で通常pageは成功し、browserだけを要求して追加contextを閉じたcaseは拒否された。namespaceから素のrunnerをimportする負例もBiomeが拒否した。遷移前の回収を追加し、ケース別の収集annotationを結果照合に含めた。
- 両保存APIは4096 bytesのUTF-8入力が「あ」の途中でHTTP chunkへ分割されると旧実装で413となった。raw Bufferで上限を数え、最後にdecodeする修正後は実HTTP回帰が成功した。
- 構図20項目のcontrol同期・draft・JSON exportは実エディターと描画代替の接続に移した。同じ入力・逆方向同期・export全値・reload全値のassertionを維持して2.3秒で成功した。実地面、設定反映VRT、資源、HMRの保証は実rendererに残す。
- 背景404の早期失敗後、モデルimportが資源を確保する競合を修正した。同時読込のsettlement後に失敗を通知し、保留モデルを解放するcaseも含む4つの素材失敗caseで資源0のassertionが成功した。全projectのcoverage付きrunとは区別する。
- 攻撃／回復の固定時計VRTはPlaywright locatorと同じ整数矩形をpage screenshotへ渡し、paused rAFの安定待ちを避けた。既存画像・許容差を変えず両caseが成功した。
- 初回症状によるカード拡大でHPが上へ動く不具合は、既存の上端を保って情報を下へ展開する修正へ進めた。通常／文字200%の公開座標、説明のキーボード展開・到達性を検証し、初期画面は通常・文字200%・320px幅で修正前との全体pixel diffが0だった。最終CI結果とは区別する。
- 以前の解析buildでJavaScript sourcemap設定によりCSS minificationも無効になっていたため、CSSは通常buildと同じminificationを明示した。現在は下記の通常build＋hidden mapへ統合し、JS/CSSともViteの通常minificationを維持する。ルートVRTの基準・許容差は変更しない。
- 品質scriptへのPlaywright引数が末尾の結果検査へ渡る問題を修正した。3モードで`--update-snapshots`等がrunnerへ届き、全件の発見・結果照合は維持されることを確認した。
- 長い通常campaign通しと10状態VRTを `tests/long/` の明示実行へ移した。テスト本文と基準bytesは保持し、既定CIの短い通常配布・UI・settings・renderer境界は継続する。

### 旧E2E段階の開発者用途見直し

ユーザーの用途見直しに従い、低頻度の開発者専用エディターは通常検証を代表的なbattle/adventure設定の標準保存・通常起動・エディター再読込へ絞った。このbridgeは保存値の読込を確認し、新構図のpixelsが期待通りであることまで保証しない。全control・詳細編集VRT・draft・Storage例外・保存失敗時UI・画面組合せ、開発server限定HMR、任意の5control構図VRTは `tests/editor/` と `test:editor` で必要時に確認する。既存本文・基準bytes・許容差を保ち、通常結果へskipとして混ぜない。これは常時保証範囲の用途判断であり、全旧保証が通常CIに残る等価移動ではない。

値の解析と両APIの実HTTP保存・旧bytes保持・固定書込先は通常Nodeテストに残す。browser側の不正値／foreign originだけのAPIケースはこの実HTTP契約と重複するため取り除いた。ユーザー向けキャラ詳細はUIへ移し、本編VRT・実投影・通常モーション・資源解放・pagehide・非root配布・素材境界は通常検証を継続する。本編cameraは保存値で固定し、ユーザーのcamera移動操作がないため、任意のculling四隅・内部／編集previewも必要時へ分けた。通常PC／mobileと未検証環境・別bytes・照合不可の材質fallbackは継続する。上記の追加当時の検証記録を、現在の通常suite範囲へ読み替えない。

### 旧headの期待値監査

ローカルhead `183bf5a` の単体45ファイル・685ケースと、browserのspec・補助fixtureを全文確認した。件数自体を過剰さの根拠にせず、公開仕様と観測結果から採否を判断した。一時保存名を固定した故障注入は公開の保存ディレクトリへの実I/O障害へ、再保存のJSON字句一致は値比較へ置き換えた。flagsは配列をsortして完全比較し、重複・欠落・余分を検出して非仕様の順序だけを解除した。任意の健康省略は有効状態の比較にし、連続量だけの浮動小数点差と出荷catalogの配列位置への依存も除いた。失敗時の旧保存bytes、仕様の順序・RNG・整数境界は維持する。

入力を期待値に使い回して破壊更新を見逃す箇所は呼出前snapshotと返却・元入力の比較にし、保存形式の必須field負例はserializerから列を生成せず小さい独立v5入力に置き換えた。定義拒否の負例は正常baselineと無関係な違反のない入力を用い、非仕様の診断文言・検査順を固定しない。公開reason codeと利用者に必要な理由は残す。

browserの未使用`data-replaying`や私的なphase属性は、省略ボタン・入力可否・各着弾のHP・可視結果・期限直前直後の勝敗へ置き換えた。マーカーはSVGのpolygon構造ではなく実pixelsで四分の一周の変化・六秒後の一致・reduced-motion時の静止を比較する。入力の同期選択、focus、コピー、実描画VRTと基準bytes・許容差は保持し、設定controlは既存のgroup・公開ラベルで取得する。

背景失敗では保留中のstatusを固定せず、モデル完了を待った上で退出後の資源0を確認する。遅着素材の画像`src` setterと必要なBabylon plugin完了観測は留保した。公開`ready`は取消とのraceを含み、実HTTP完了も画像decode完了を意味しないため、単に撮影・資源比較へ置換すると遅着後の回帰を先に成功判定する可能性がある。同保証の簡潔な代替を確立できておらず、画像・loader経路への実装依存は未解消とする。既存同期も一画像のloadとモデルを観測する範囲であり、全遅着処理の完了証明とは扱わない。

製品ソースを変更しない分離コピーでは、保存JSONの宣言順交換、未使用replaying属性の削除、CSSとphase属性の同時renameで旧テストが失敗し、変更後の対応テストが成功した。保存値の反転と拒否入力のRNG破壊更新は変更後も失敗することを確認した。この診断と部分trialを最終全件成功・正式な独立レビューへ読み替えず、最終の`check`・既定全project・editor・longの実行と区別する。

### 旧headの破壊・修正前比較

| 対象 | 観測した失敗と復元 |
| --- | --- |
| 見た目proxyの置換 | ボタンのRGBを保ったまま文字を隠す一時変更でVRTが1510pixelの差を検出。変更を復元し更新なしの比較が成功 |
| 確率境界 | 命中・発症・帰還保持の厳密比較を等値も通す比較へ一時変更すると、境界の具体結果assertionが失敗。全変更を復元 |
| 成長の保証技 | 保証技の存在検証を無効にすると追加した定義検証が失敗。復元後の対象テストが成功 |
| 最大安全整数の保存 | 分離コピーで保存側だけ旧`< Number.MAX_SAFE_INTEGER`判定へ戻すと、公開APIが受理した数量/金額のroundtripが`invalid-data`で失敗。修正を戻すと同caseが成功 |
| エディターの一時保存失敗 | localStorage拒否時に警告が通常の保存済みメッセージへ上書きされることを追加caseで再現。警告を保持する修正後に成功 |
| 実行結果 | 実レポートに含まれたNaN/Infinity由来の重複case名をゲートが拒否。パラメータ行を識別できる名前へ修正 |
| focused test禁止 | 分離した負例でVitestの`allowOnly: false`、公式コンテナ内Playwrightの`forbidOnly: true`が`.only`を実際に拒否し非ゼロ終了。品質testへ負例を残していない |

この記録は最終headの全実行を代替しない。PRのCIで最終head＋baseを統合したcommitの`verify`・`browser`とアップロードされた実レポートを確認する。残件はPRに不足・未監査・矛盾を区別して記載し、未実装の将来計画へ逃がさない。権限とレビューの境界は [別表](review-controls.md) に示す。

### 旧headの固定監査照合

固定監査の各行を現在の仕様、具体的なassertion、担当runnerへ照合した。以下は領域ごとの変更と例外の要約であり、関連するtest名や成功件数だけから全仕様の保証を宣言しない。監査当時のファイル位置は、当時の `tests/e2e/{built,debug,ui,settings}/` と必要時の `tests/editor/`・`tests/long/` と照合する。

| 固定監査の領域 | 具体的な不足への対応 | 残る区別・限界 |
| --- | --- | --- |
| UI（UI-C/P/D/B/E/V） | 通常保存・取消・focus、クイック編成の各入力結果、各着弾、実コアのRNG、routeの狭幅、全設定control、実font使用、必要状態VRT。入口は `tests/e2e/built/campaign.spec.ts` と `tests/e2e/{debug,ui,settings}/` | UI-B23の通常幅・文字200%は修正と回帰テストを追加。狭幅のdocument座標固定は分離承認済みIssue #103へ残す。UI-V04の自作plate検証は旧headでの試行として現行テストから除去し、画像上の編成名・halo・重要非文字を含むコントラスト調査は独立品質改善Issue #104へ分離する。全画面タイポグラフィの仕上げは承認済みIssue #99へ分けるが、現在のfont読込・実使用と狭幅操作の保証を混同しない |
| 進行・保存（ADV/DUN/EXP/GROW/REC/SAVE等） | `definitionContracts.test.ts` のDAG/条件分岐負例、`growthRuntime.test.ts` の保証技/習得境界、`multidayAcceptance.test.ts` と `save.test.ts` の公開状態の引継ぎ・拒否 | 公開数量・金額の保存不一致は修正。将来コンテンツや未確定バランスを実装済み保証へ含めない |
| 物品・装備（ITEM/EQUIP/SAVEITEM） | `items.test.ts` の各回優先消費と成功合算、`itemUse.test.ts` の古い入力拒否、`inventoryIntegration.test.ts` の購入→探索→帰還→保存と実戦闘の回復後被弾、装備＋育成＋疲労 | SAVEITEM-03で監査者が推定したversionの包括上限は公開仕様にない。通常版数の保持・不正値拒否は検証するが、version枯渇時の方針は未定義・未検証 |
| 戦闘（BAT-T/A/S/F/L等） | `battleContracts.test.ts` の独立した入力/HP/時刻/出来事/確率等値境界、`skills.test.ts` 等の対象と拒否、Playwrightの途中表示と速度・省略・退出後の論理結果 | BAT-D01〜04の途中速度変更・割込・SP・戦略AI・本編へのmulti/all技提供・最終バランスは未実装計画。実装済みmulti/all runtimeの不足へ読み替えない |
| renderer・tooling・工程（WF-R/C/A/B） | 実WebGL資源/HTTP/cullingの既存契約を維持しDPR・非root・entry寿命・独立設定を追加。両APIの実HTTP拒否・原保存保持、全asset検査、全project実行と生成レポート照合 | WF-B05の手書きID/catalog案は後続の明示指示で不採用。標準coverageと具体的な仕様差分レビューへ置換し、自動で自然言語仕様の完全性を判定したとは扱わない。承認・main保護は別表の工程責任 |

### 分離承認済みの残件

- **UI-V04：画像背景との絶対コントラスト。** 限定したPlayerカードの自作plate計測も現行の通常仕様テストから取り除いた。編成名や見出しの画像／pseudo背景・blur halo、重要非文字を含むコントラスト調査は独立した品質改善として、ユーザーが分離を承認した [Issue #104](https://github.com/karin0624/endfield_rpg/issues/104) へ残す。標準axeのincompleteは不適合の証明でも成功でもない。試作画素解析器はhaloの既知条件で誤判定したため採用しない。VRT・違反0・目視を絶対コントラストの保証へ読み替えない。
ユーザー向けの実装仕様のテスト保証は維持する。開発者ツールの詳細は上記の用途別検証範囲に従う。狭幅HPと上のコントラスト残件はユーザーが別Issueへの分離を承認した。デザインガイドラインは設計指針であり、`specs/`への配置だけで実装仕様・必須テスト・マージ条件に昇格させない。コントラスト改善を未達の実装仕様として完了条件へ置かず、WCAG適合・VRTの視覚回帰・テストの有無を区別する。分離承認をWCAG適合や自動テストの成功へ読み替えない。

### HP位置の修正前後の検証

初期画面は通常・文字200%・320px幅の同じ条件で修正前と全体pixel diffが0だった。通常のdocument上のHP行は`817.03125→801.421875`だったものが`817.03125→817.03125`となり、文字200%では`697.828125→557.421875`が`697.828125→697.828125`となった。320px幅はステージ下へ縦積みするため、上の行動結果パネルの拡大で修正前後とも`737.78125→826.5625`となる。狭幅の後続3カードでは症状行の拡大も加わりHPが126.78125px移動する。仕様は900px以下の縦積みとHP不動を同じ節で規定し、後者に明示的なviewport除外はないため、全幅解決やPC専用条件とは扱わない。狭幅のdocument座標まで固定する受入範囲と追加情報のflow配置は、ユーザーが分離を承認した [Issue #103](https://github.com/karin0624/endfield_rpg/issues/103) へ残す。基準画像を更新せず、初期構図を維持する修正の範囲と別のflow変化をレビューで照合する。

### 旧headの自作contrast試行と分離

旧head [abd6f7c](https://github.com/karin0624/endfield_rpg/tree/abd6f7c8bdcbd073469cd7f0c99347beb556ce9f) では、このPRで追加した [比率計算](https://github.com/karin0624/endfield_rpg/blob/abd6f7c8bdcbd073469cd7f0c99347beb556ce9f/tests/contrast.ts) と [plate前提検証](https://github.com/karin0624/endfield_rpg/blob/abd6f7c8bdcbd073469cd7f0c99347beb556ce9f/tests/e2e/plateContrast.ts) を通常CIで実行していた。限定条件での4.5:1と専用負例を確認した試行であり、画像背景・halo・重要非文字まで含むWCAG適合を示していない。

設計指針から実装仕様の合否条件へ持ち込んでいたため、ユーザーの分離承認に従い、自作計算・plate helper・専用単体テストを削除した。混在していたHP位置ケースからもcontrast前後計測・DOM/CSSを壊す専用負例・contrast添付だけを除き、HP座標・症状表示・キーボード操作・スクリーンショットとHP添付は維持した。optional経路は追加せず、今後の方法・範囲の調査は [独立品質改善Issue #104](https://github.com/karin0624/endfield_rpg/issues/104) で行う。

現在の通常仕様テストはこの試行によるcontrast保証を含まない。基準画像・UI外観を変更せず、既存VRTは承認された画面の構図と視覚回帰を担う。旧headの結果を現在のテスト保証やWCAG適合へ読み替えない。

除去後の`npm run check`は45ファイル・685ケースの発見／全実行／成功を照合した。固定Playwrightコンテナでは通常文字・文字200%のHP位置2ケースが5.7秒で成功し、症状表示・キーボード展開・HP添付と前後スクリーンショットも維持した。この件数は検証時点の観測結果であり、不変要件ではない。対象ケースの撮影をVRT成功として数えず、既存VRTは最終CIで別途確認する。

### 未定義の設計境界

旧SAVEITEM-03のversion一致・更新・保存は当時のテストで検証した。現行ではゲーム意味のないversion入力を除去した。数量・金額の最大安全整数roundtripも公開APIの契約として保証した。versionの枯渇時の最大値・次操作方針は公開仕様にないため、別の設計境界として残す。未定義の極端値から通常契約全体を未テストとしたり、独自の上限・wrap方針を加えたりしない。

## 標準coverage方式の調査と小規模実証

- Vitest 5の標準V8 providerで同じ `battle.test.ts` を実行すると、import済みだけでは8ファイル・行171/395、game全体をincludeすると27ファイル・行170/1512となった。未読込の `time.ts` は後者だけに8行未到達で現れる。全体の品質率としてこの小試験の数字を使わない。
- Playwright native V8＋Monocartで `x < 0.5` と誤った `x <= 0.5` を比較し、入力0.25/0.75だけをassertすると、両方とも行3/3・文4/4・関数1/1・分岐2/2の100%だった。0.5の期待結果は異なる。今回追加した実コアの等値境界テストはこの種類の誤りを検出する。
- 同一originのreloadで `resetOnNavigation: false` にもかかわらずreload前の関数命中が0、後が1になった。遷移前の回収を追加する根拠とした。
- Playwright公式のaxe-core統合も試したが、画像背景上の編成・戦闘コントラストはincompleteだった。違反0を成功保証と読み替えず、独自画素解析器は採用しなかった。

参考: [Vitest coverage](https://vitest.dev/guide/coverage.html)、[Playwright coverage](https://playwright.dev/docs/api/class-coverage)、[Monocart](https://github.com/cenfun/monocart-coverage-reports)、[Googleのcoverage運用](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)。

## 通常ブラウザ実行とV8 coverageの統合

旧CIは同じ170ケースを通常browserで25.2分、専用解析buildのbrowser-coverageで30.3分実行していた。全件discovery・実行結果・VRTの保証を維持し、通常配布と同じminificationのbuildへhidden sourcemapだけを付加して、一回のbrowser実行から合否とproject別coverageを得る構成に統合した。browser内の先行buildも除き、通常・debugをそれぞれ一度生成する。当時はverifyの通常buildと`test:coverage`別名を残していた。現在は上記の同一normal artifact再利用へ整理し、旧コマンドを廃止した。

[Viteのhidden map](https://vite.dev/config/build-options.html#build-sourcemap)は外部mapを生成し、実行JSへmap参照コメントを付加しない。Playwrightのnative V8データに、そのchunkの隣接mapをMonocart標準APIの`sourceMap`として渡す。dev fixtureは既存のinline mapを使う。未読込srcの分母、project別report、追加page/contextの拒否、遷移前回収、各case annotationと全件照合は維持する。minified V8からの再mappingによりcounterや率は旧非minify解析buildと一致するとは限らず、旧率の単純比較を合格条件にしない。

分岐指標は生成JSから対応づけられた範囲であり、元TSの全分岐分母を保証しない。[Monocart 2.13の変換処理](https://github.com/cenfun/monocart-coverage-reports/blob/v2.13.0/lib/converter/converter.js#L620-L672)はmapping不能な分岐群を除き、`all`も未収集ファイルの追加だけで読込済みTSのtree shaking削除分や未mapping分岐を埋めない。下記の69src集合一致はsource欠落の確認であり、全分岐維持の証明ではない。

- 単一coverage統合時点の`npm run check`は46ファイル・686ケースを発見し、全実行・成功を照合した。通常・hidden map付き通常・hidden map付きdebugの各buildも実LFS素材で成功した。
- 通常とhidden map付き通常buildのJS/CSS/HTMLは129ファイルすべてSHA-256が一致した。debug同士も151ファイルすべて一致した。通常buildは外部map122個だけが付加され、実行ファイルのbytesは変わらなかった。
- 固定Playwrightコンテナで全4projectの代表6ケースが1.3分で成功した。通常配布の公開境界、debugの実描画VRT、保存reload、uiの選択VRT、settingsの実素材・非root独立buildと構図VRTを含む。6ケース全てにcoverage annotationがあり、global errorは0だった。
- 各projectのreportは69個のsrcを含み、旧CI artifactのsource集合と厳密に一致した。未読込ファイルの0-hitも残った。全件discoveryも従来と同じ170件（built20・debug25・ui80・settings45）だった。この件数一致は今回の実行漏れ比較の観測事実であり、170件や既存ケース構造の不変を要件としない。
- 全件discoveryに上の部分結果を渡すと、未実行caseをゲートが拒否した。通常配布chunkのmapを一時的に外した実ブラウザ実行も共有fixtureが拒否し、mapを復元した。実CLIのVitest回帰では古いJSONによる部分実行／list-onlyの偽成功とcase annotation欠落を拒否した。

この小規模確認を最終headの全件CI成功や5分目標達成と扱わない。最終の統合commitでverify/browserの全実行結果・VRT・coverage artifactを確認する。

[性能改善Issue #102](https://github.com/karin0624/endfield_rpg/issues/102) の診断には工程別・ケース別の時間を含む既存report/logを引き継ぐ。品質維持の判定は実装仕様がテストで担保されていることで行い、同じ仕様保証を実証できる統合・移動・書換え・削除を認める。assertion・ケースの件数や構造を固定せず、保証の対応はテストコードと変更の証拠で説明し、巨大な手書き台帳を追加しない。


## #102：cold／warmの資源寿命と反復描画

現head `a2b1ee2` の実canvasの `WEBGL_debug_renderer_info` とブラウザ標準CDP `SystemInfo.getInfo` の双方は、ANGLE／VulkanのSwiftShader（Subzero、SwANGLE 5.0.0）を返した。launch flagだけからbackendを推定していない。地面は78 mesh、1,085,243 vertex、5,832,240 index、1つのPBR materialと4096×4096 base color textureで、代表構図の実frameは58 draw、4,695,861 active index、1440×810 backbufferだった。Sceneのpublic instrumentation・active mesh/indexと実contextを読む隔離fixtureの観測であり、GPU elapsedは取得していない。

### 同じengineで何を再利用しているか

同じbrowser process内の2つのfresh contextで、初期化→同じBattleSceneへの同設定適用→同じrendererの次BattleScene→同pageでrendererを再生成、を順に観測した。各段階で元の承認済み初期画像へ完全一致し、計8比較が成功した。stock Playwright traceはoff、native V8はon、既定1worker、実素材とproduction minifierを保持した。診断のCDP trace／process CPU checkpointを加えた部分実行なので正式全体時間へ混ぜない。

| 段階 | API〜実capture2回のwall（2context） | 地面／engineと新しいNative資源 |
| --- | --- | --- |
| fresh contextの初期化 | 8.429／8.814秒 | GLB実取得、新しいengine／Sceneと363 Buffer・7 Texture・8 Program生成 |
| 同じBattleSceneへの同設定適用 | 3.213／3.552秒 | engine／Scene同一。新規GLB・Buffer・Texture・Programは0 |
| 同じengine・同環境の次BattleScene | 3.207／3.187秒 | 地面とTexture／Programを保持。戦闘者の40 Bufferだけを作り直し、live数は不変 |
| 同pageの新しいengine | 7.966／7.231秒 | engine／Sceneが変わり、GLBを再取得・再import。Texture／Programも再生成 |

APIだけなら同BattleSceneは約4ms、同engineの次BattleSceneは39〜42msだった。地面mesh／material／texture、GPU buffer、environmentの準備promiseと接地cacheが保持されることは `createBattleRenderer`／`createEnvironment` の所有境界と、実生成数・HTTP・同一engine／Sceneから確認できる。これはHTTP bytesの再利用だけを根拠にした描画cacheの推定ではない。同pageの新engineでは約58.79MBの実transferを再観測した。browser／driver shader cacheの独立した命中率やGLB純decode時間は測っておらず、保持と再生成の範囲へ混ぜない。

warmでも地面を更新するとfull native drawが必要で、first captureまでGPU processの累積CPU消費は9.12〜9.67秒増えた。複数threadのCPU消費であり、3秒のwallやGPU elapsedと同一ではない。ReadPixels待ちは約2.31〜2.43秒だった。同じbackbuffer／geometry／材質を保持し、標準engine scissorを診断用に1×1へ制限するとReadPixelsは2.337→0.472秒、GPU process CPU増分は9.18→1.91秒だった。fragment／raster側の費用が大きいことを支持するが、vertex／fragment exclusive時間やreadback純転送時間は測っていない。画像が異なるscissorは製品・品質テストへ採用しない。

### 重複初期化を除く範囲

変更前のVRTのうち3Dを使う14caseは、code上で17回renderer／engineを生成し、既知→未検証→既知の環境切替を含め21回正常GLB importを開始していた。前回正式実行の3Dを使うVRT case合計は191.610秒、資源／HMR caseは70.420秒、合計262.030秒だった。全case304.655秒、Browser314.896秒、host wrapper389.228秒の一部分であり、代表の初回3秒だけを全体389秒の説明にしない。全Native frame数・各stageのGPU時間の合計は未取得で、このcase集計へ小規模対照の数字を掛けて説明済みとしない。

四隅caseは同pageでもrendererを4回作り直していた。単純な同BattleScene applyはHUD投影が残り、3枚で36,573／25,137／37,917pixel差となったため不採用。同じ実地形へ構図を適用して通常の次BattleScene／UIを生成する対照は4枚とも元の基準に一致し、GLB取得は4→1回、2〜4枚目の準備APIは29〜34msとなった。対照のcase時間はfresh-each31.2秒、次BattleScene19.9秒（各一回、cold変動を含む）。静的な四隅の構図／材質VRTをこの経路へ移し、caseごとのpage/context分離、初期control設定5caseのfresh constructorとdefault引継ぎ、退出・HMR・遅着／失敗・資源不増加の独立検証は保つ。VRTの正常importは21→18回となる。

描画側はBabylonのpublic `Scene.setRenderingOrder` と標準 `RenderingGroup.frontToBackSortCompare` でopaqueを近い順にする最小候補を追加した。透明／alpha-testの標準順序、GLB／PBR／viewport／DPR／culling条件は変えない。単一warm対照で元の初期画像と再描画の4比較は成功し、ReadPixels2.949→2.375秒、span3.824→3.416秒だった。一回の小規模差を正式全体の短縮と断定せず、以下の全project検証で外観と資源保証を確認する。


### 四隅・opaque順序の全体検証と追加のfixture整理

`4e76143a7df729205b6f6267988e8439d3342bff` の `npm run test:all` は2026-10-05 07:10:33〜07:16:57 UTC、起動〜shutdownの直列384.619秒、Browser312.161秒、exit0だった。800単体／33browser／54unique基準画像・62assertion／4coverage project・全実行gateが成功し、failure／skip／retry／flaky／global error0、source451の前後変化0、保護162の変化0、三buildのmap原文不一致0だった。四隅caseは25.504→15.197秒となったが、他caseと工程のcold変動があり、全体の約4.6秒差をopaque順序の効果と断定しない。既定1workerと公開停止を保つ。

さらにFXのattack／healは同じ地形なのに別pageでrendererを初期化していたため、1caseの同じrendererから公開 `beginBattle` で独立した実コアsnapshot・BattleScene・UIを用意する形へ統合した。攻撃の4枚と回復の2枚、各GPU／DOM表示時刻、sampleと基準画像、通常motion、HP transition抑制、stage clipと許容差は変えない。ゲーム操作を前段に実行せず、戦闘コアのcommitとsnapshotは効果ごとに新しく作る。地面／材質／texture／shader準備だけを同環境で保持する。資源／HMR／初期controlの独立contextは共有しない。正常VRT importは18→17回となる。

editor fixtureの初期2対2は、同じ設定と全4戦闘者をconstructorで準備した直後に同じsettings／actor frameを適用して再描画していた。初期表示は準備済みcanvasと投影したeditor UIを使い、後の1対1→2対2とmobile resizeの実描画は保つ。これはfixtureの明示した重複drawを除く変更であり、Native browserによるviewport変更時の再描画を止めない。

この追加のlint／型／800単体・実collection照合は成功した。固定コンテナでNative V8と同じminificationの2caseを実行し、元のFX6枚とeditor3枚の全9画像が完全一致した。部分実行34.9秒は最終sourceの全品質・全coverage project・5分達成を示さない。追加差分を含む全体検証を次に記録する。


### 追加の地面再利用の全体検証とopaque候補の取り下げ

`bfa9b1855f527ca9993407489ec170215707e311` の `npm run test:all` は2026-10-05 07:23:53〜07:30:48 UTC、起動〜shutdownの直列414.359秒、Browser338.133秒、exit0だった。800単体／32browser／54unique基準画像・62assertion／4coverage project・全実行gateが成功し、failure／skip／retry／flaky／global error0、source451の前後変化0、保護162の変化0、三buildのmap原文不一致0だった。FXを1caseへ統合したためcase数だけ33→32となり、6枚のFXを含む画像と意味の保証は保持した。

一回のwarm対照でopaque順序の減少は見られたが、二つの正式全体実行では全体高速化を実証できなかった。速度改善が未確定の製品変更を残さず、public opaque順序の候補3行を元に戻す。成功／失敗／速度の生記録は保持し、隔離診断を製品設定として採用しない。四隅・FXの地形再利用とeditor fixtureの重複draw除去だけを残し、復元した製品sourceで最終の全体検証を行う。
