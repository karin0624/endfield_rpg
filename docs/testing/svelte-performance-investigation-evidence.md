# Svelte表示負荷の追加調査

## 結果の範囲

Svelte移行前、最終移行版、PR109後を同じ診断workloadで比較した。実画面のNative pointer入力では、街のfocused buttonを会話へ置き換える際の`state_unsafe_mutation`を再現し、Adventureのfocusin／focusoutを標準`on`へ変更した。PR110後の統合Native操作ではDungeonのfocusoutにも別の再現stackを得て、同じfocusin／out boundaryを標準`on`へ変更した。モデルへの同期入力とAbortSignalによる解除は保つ。

描画待機の主因をSvelte CPUと混同しないよう、main task wall、thread CPU、Native API issue、固定clockの描画対照とcompletion fenceを分けた。残るSvelte側の割当は主にbranchの生成にあり、observer、anchor、command list、2種類のshell再利用を試しても安定した全体latency改善は得られなかった。これらの変更は残さない。移行前の性能を全経路で回復したとは結論しない。

## Sourceと固定条件

| 比較対象 | commit |
| --- | --- |
| 移行前 | `c08a065e2965e0ee76a12e72dc5bb4e7abe62682` |
| 最終移行merge | `53dc488fa5f7bc4e4322f2865238c07c14936de6` |
| PR109後のbase | `ca02d8380983098f92be1ff48f9167a4ce9675d9` |

PR106の最終headは`316af7cce2d22e494ce7fd531b393199886765c3`で、mergeと同じtree `6dae34cd7dd76323f3e416027529c6f09bb94e9d`を持つ。旧計測candidate `5b7e99b2e9278cb5ebc23b5ae269c6b8eb230a1d`には、その後のBranchRecovery／Dungeon等の修正が含まれず、今回の移行直後の比較対象ではない。

固定Docker `mcr.microsoft.com/playwright:v1.63.0-noble`、digest `sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`。Chromium153.0.8010.12、Node24.20、headless、1440×1080、DPR1、SwiftShader、標準minifierを使用。他の品質実行・buildとは同時実行しない。各workloadはfresh context。browser process／OS／配信server／素材cacheの完全coldは保証しない。

3つの独立worktreeで同じharnessをbuildした。旧viewのimport名だけを合わせ、旧版は同じモデルのframeを投影してpaint、Svelteは実経路のrenderModelを使う。hidden mapを隣接mapとして保存し、初期通常buildへのmap追加前後で実行JSのSHA-256一致も確認した。実GLBは`public/assets/ground/ground1.glb`、58,790,396 bytes、SHA-256 `0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9`で3版共通。

初回LFS取得は保存済みlocal `access=basic`で認証再試行上限に達した。認証skillの公式手順でhelperを設定し、文書化されたcommand-scoped access overrideでこの1pathだけ取得・照合した後、原因のlocal basic設定を解除した。tokenの取得・APIによる素材取得は行っていない。

## 区間と計測値

直接viewは実素材・shader・font・画像を準備し、20rAFを経てから180frameを測る。`battle-skills`はrules／itemsを有効にしたHUDの選択更新で、initialBattleのcombatantにはlearned skillがない。実skill選択／使用、party／詳細、dialog、return／save／resumeは通常配布の別診断で通す。

| 観測 | 区間と読み方 |
| --- | --- |
| apply wall | model、Native submit、view更新、settled、root layout readまで。Svelteの遅延flushを含む |
| sparse transition | 30frameごとの6入力の`switches[].applyWallMs`。最初のempty→home、最初のtown、再入場を分ける。全frame p95はidleなので使わない |
| V8 CPU sample／allocation | Profiler／HeapProfilerの開始〜終了。workload、cue時のcompletion drain、dispose、退出後1rAFとbrowser内の結果生成・serializeを含む。Node／Playwright driver自体のCPUをV8 profileで測っているわけではない。1ms／16KiBの推定値であり、退出を除いた割当や厳密なCPU占有ではない |
| trace | workload mark間だけ。RunTaskのwallとthread timeを分ける。Commit／rAFはRunTask内の重なる内訳で、合計へ加算しない |
| Native API | JavaScript呼出の同期wall。issueとその呼出内のstallを含むが、GPU elapsedではない |
| fence | SYNC_GPU_COMMANDS_COMPLETEをflush後、clientWaitSync timeout0でpoll。schedule gapも含むcompletion-wait wall。elapsed GPU timerへ置き換えない |

Svelteの[effect](https://svelte.dev/docs/svelte/$effect)はDOM更新後のmicrotaskで同期に読んだ依存を追跡し、rerun前にcleanupする。Native診断のpost-clickに置く2 microtaskは定義した観測窓であり、全非同期処理・描画完了の保証ではない。[rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)はrepaint前のcallbackで、GPU完了そのものではない。

## 比較

最終45runのCPU raw profileはすべて負の`timeDeltas`を含む（各170–346個、最小−5,020µs）。[CDPのProfile](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/#type-Profile)では隣接sampleのintervalなので、この値を重みとする時間別集計を使用しない。harnessはintervalが有限・非負でsample数と一致する場合だけ集計し、それ以外は`valid: false`、理由・件数とnullの時間値を返してraw profileを保存する。負値をclamp／絶対値化しない。以下のapply wall・allocation表はこの無効なCPU集計に依存せず、traceのwall／利用可能なthread timeと明示phaseも別の観測である。raw stackの出現情報は残すが、時間別の帰属へ読み替えない。

3反復の最終セットは`perf-final-matched-{0,1,2}`。同じ5負荷を順序を入れ替えて実行した45runは、すべてbrowser error0、退出後Buffer／Texture／Program0だった。以下は各反復の値で、信頼区間や統計的な同等性判定ではない。HUD等は180frameのapply合計、sparseだけは実際の6切替を合計し、idle frameを除く。

| 負荷／apply wall (ms) | 移行前 | 最終移行版 | PR109後 base ca02（未変更） |
| --- | ---: | ---: | ---: |
| battle | 122.0／117.4／110.6 | 115.3／105.5／113.2 | 116.8／109.9／102.7 |
| marker | 95.9／101.7／104.7 | 94.2／82.1／78.0 | 85.1／85.1／88.5 |
| battle-skills | 123.6／136.8／136.2 | 111.3／109.8／101.8 | 108.7／99.9／112.4 |
| switch | 321.7／269.1／306.9 | 370.4／329.2／301.6 | 341.5／305.4／291.6 |
| switch-paced | 19.5／20.8／21.5 | 24.6／24.9／22.5 | 25.0／25.0／27.3 |

| 負荷／sampled allocation (MiB) | 移行前 | 最終移行版 | PR109後 base ca02（未変更） |
| --- | ---: | ---: | ---: |
| battle | 9.004／8.652／8.397 | 8.055／8.364／9.280 | 9.219／8.698／8.865 |
| marker | 6.741／7.244／6.619 | 6.592／7.167／6.982 | 6.597／6.699／6.736 |
| battle-skills | 9.803／9.630／9.531 | 9.103／7.858／8.671 | 8.814／8.746／9.164 |
| switch | 3.196／3.200／3.285 | 7.363／7.008／7.321 | 6.700／7.582／6.412 |
| switch-paced | 0.995／0.775／0.816 | 1.150／0.771／0.736 | 0.973／1.090／1.069 |

疎な切替の合計は移行前19.5–21.5msに対し現在25.0–27.3msだった。連続切替のwallには反復の揺れがあるが、割当は移行前約3.2MiBに対し現在6.4–7.6MiBと増えた。HUD／marker／rules更新が一律に遅くなったという結果ではない。候補focus修正を含む先行`perf-matched-*`はこの未変更3版の主比較に混ぜない。


PR109の[既存記録](view-switch-performance-evidence.md)と同じく、CSS反映のCPU改善だけから疎な操作のwall改善・割当改善を主張しない。今回も初回移行比較と、最終移行版・現在版・候補の新しい同条件測定を区別する。

## 描画待機の分解

移行前の通常操作の初回traceは10,437.528ms。区間内に完全に含まれるmain RunTaskはwall7,676.621msで、thread CPUがあるsliceの合計は1,504.355ms。2,136sliceでthread timeが欠けるため、これはCPUの下限で、差を正確なoff-CPU時間と扱わない。入れ子のCommitはwall5,989.492ms／CPU46.210ms。最長task1,861msの中のCommitは1,765.6ms／CPU10.1ms、rAF callback92.1msだった。初回V8 profileの`(program)`6.76秒という集計は、負の`timeDeltas`を重みに使用していたため無効で、撤回する。そのprofileにも285個の負のinterval（最小−2,674µs）があった。

初回scene準備待機2,774.8msに対し、texImage2D6呼出の同期wall213ms、bufferData343呼出20.1ms。readPixels／finish呼出は観測しなかった。短いAPI issue合計から残りをGPU時間と仮定せず、main taskのoff-CPUとqueue完了を別対照で確かめた。

固定36cueframeで同じclock／モデルを通す一要因対照:

| 対照 | apply総wall | Native submit総wall | main task総wall | rAF間隔総wall | fence completion wait | mark後drain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 通常表示 | 939.6ms | 78.0ms | 25,704.7ms | 25,848.9ms | 2,146.5ms | 0.1ms |
| 同じNative描画でcanvas非表示 | 103.6ms | 65.5ms | 128.6ms | 583.4ms | 23,942.9ms | 23,878.2ms |
| 初回構図後のNative更新のみ省略 | 36.6ms | 0.6ms | 61.5ms | 583.4ms | 1.5ms | 0.0ms |

この初回fenceはframe32までのprefixを覆い、後続frameの全command完了までは保証しない。非表示のframe loopが速くてもprefixのdrain込みで約24.46秒かかり、待機の主要部分がframe外に移る。この値を全command完了のspeedupと扱わず、下記の最終fenceで確認する。fence waitはframe loopとdrainにまたがる同じ待機なので、fenceとdrainの数値は足さない。Native更新省略で待機がほぼ消えたことから、この固定環境の大きな費用はsubmitしたcanvasのbackend処理・同期境界にある。品質・描画を省く対照は製品へ採用しない。これは移行前にも存在し、Svelte移行により発生したGPU退行とは扱わない。

最終submissionを覆うfenceを追加して再確認した。`paintBattleFrame`は各更新で`scene.render`を同期実行し、最後の通常rAFの後にfenceを発行する。可視／非表示とも36×16.6667ms（供給clock600ms）でdrawElements1,512呼出、初期準備は別64呼出だった。Native-staticは追加draw0。

| 再確認 | trace mark内wall | rAF間隔合計 | prefix fence wait | 最終fence／drain |
| --- | ---: | ---: | ---: | ---: |
| 可視 | 25,946.826ms | 25,915.6ms | 2,092.3ms | 1.2ms |
| 非表示 | 673.670ms | 650.0ms | 24,428.7ms | 26,631.0ms |
| Native-static | 605.233ms | 583.4ms | 1.2ms | 1.2ms |

全fenceのstatusはcomplete。非表示ではframe loop後にも26.631秒を要し、同じdraw数の処理をqueueへ押し出す効果を確認した。最終fenceとdrainは同じ区間、prefix fenceは途中から重なるため加算しない。rAF間隔の合計は初回／終了callbackを含まないので、全wallにはtrace markのspanとmark後drainを用いる。

この環境は`EXT_disjoint_timer_query_webgl2`利用不能で、GPU elapsedはnull。能力判定だけを待機の説明に使っていない。[timer query](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)は結果利用可能かつ非disjointを要し、[finish](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/finish)や[fence](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/clientWaitSync)のwallをGPU elapsedに代用できない。[blocking API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#avoid_blocking_api_calls)のissue／stallとqueue completionを分ける。physical GPUのfps・elapsedは未確認。

## Svelte費用と不採用の対照

初回現在版stressは7,229,088B（6.894MiB）のsampled allocation。Svelte batch inclusive5,402,152B、Campaign3,925,252B、Adventure2,151,844Bは重なる。最も近いcomponentに一度だけ帰属させるとCampaign1,921,116B、Adventure1,626,760B、Conversation262,552B、ItemShop229,660B、その他3,189,000B。その他にはfixture、browser内の結果生成・serialize、Native退出もある。create_effect祖先を持つstack3,594,968B、destroy_effect系395,960B、その他3,238,160Bの構造的帰属は呼出数や厳密なeffect割当量ではない。projectionの明示phaseは180入力で約8msで、主要費用はbranch生成・flushの側だった。

| 対照案 | 観測 | 判断 |
| --- | --- | --- |
| command eachを位置更新 | 初回反復の追加／削除mutation302／659→122／479、attribute／text122／120→362／300。stress／sparse wallと割当の安定改善なし | 不採用。少ないDOM生成だけで速いとは判断しない |
| ROをally ID membershipへ固定 | 作成36→18、Layout305→269。apply97.8／102.2／121.7→108.9／121.4／112.2ms、割当も重なる | 不採用。target churn削減をwhole latency改善と扱わない |
| semantic anchor applyのclearを削減 | Layout305で同じ。anchor span平均10.80→9.86ms、自然measure callback平均5.03→5.65ms。apply105.1／96.3／107.3→101.1／95.4／107.7ms | 不採用。anchorとmeasureは入れ子で加算しない。製品のperformance markも除去 |
| Adventure shellをnull frameで再利用 | stress301.0／313.0／289.5→291.6／304.2／344.5ms。割当7.229／7.222／7.335→6.055／6.192／6.226MiB。sparse24.1／24.6／27.0→25.3／23.7／25.2ms | 割当は約15%減るがlatency改善なし。再利用は不採用 |
| 通常Campaign shellをnull menuで再利用 | stress303.4／333.6／277.3→312.4／305.0／308.5ms。割当7.177／7.153／7.072→6.696／6.710／6.473MiB。sparse30.8／26.4／25.1→35.5／26.4／34.8ms | 約7%の割当減と引換えにsparse悪化。再利用は不採用 |

commandの初回対照はfocus listener修正も含み、位置更新単独の因果効果は主張しない。残る4案は各pairでfocus listenerを揃え、observer membership、anchorのclear、Adventure shell、通常Campaign shellをそれぞれ一要因として比較した。

Conversation／ItemShopの直近component帰属の合計は約0.47MiBで、既存PR109の不安定だったまとめた遅延生成案を、新しい支配的原因として繰り返さない。2種類の再利用は、投影のlast-frame cacheを作らずnullへ戻して試した。Adventure対照ではoff-townのbackground srcなし、focusin／out0、keydownはCampaignの1のみ、town時に2／1／1、全disposeで0を確認した。ただしinactiveで24element増え、GC後heapは初期+41,976B、homeへ戻った時+24,960Bだった。初期生成・live DOMとsampled割当は異なる費用であり、割当減だけで採用しない。

## Native focus退行と採用した修正

通常配布のnative clickでtown→marketへ進むと、Svelte eachがfocused buttonを除去する`clear_text_content`内でNative focusoutが同期発火する。Adventureのraw window listenerがCampaign→campaignUi.render→campaignViewのframeへ書き込み、active BLOCK_EFFECT中のstate setとして例外になる。移行前のadapterはこのSvelte reactive contextを持たない。

ca02の元stackは`campaignUi-D97tunqW.js`のsources.js158、campaignView.svelte.ts18、campaignUi.ts39／57、Campaign.svelte50、Adventure.svelte64、operations.js237、each.js116／645へ隣接mapで対応した。単なる例外名による推測ではなく、Native eventの発火時点と実callback経路を確認した。

標準[svelte/events on](https://svelte.dev/docs/svelte/svelte-events)は内部`create_event`で`without_reactive_context`を通す。Adventureのfocusin／out2本だけを変更すると同じNative操作で例外が消え、同期model dispatchとabort cleanupは維持された。[state_unsafe_mutation](https://svelte.dev/docs/svelte/runtime-errors#state_unsafe_mutation)を抑止・非同期化して隠していない。ca02のこの再現からはDungeon変更の根拠が得られず、その段階では変更しなかった。後の統合版で得た別の再現と修正は、下の統合範囲に分ける。

同じ拡張経路でA→B→A、marketのshop dialog開閉、party／人物詳細、growth、skill戦闘、return、save／resumeを通した。実clockで戦闘終了を待つため39–40入力、描画回数にも揺れがある。例外を出した元版は成功runへ数えず、その全journey wallを正常候補との速度比較へ使わない。

| source | 回数／入力数 | title＋font＋画像まで (ms) | journey mark span (ms) | browser error |
| --- | --- | ---: | ---: | --- |
| 移行前 | 2／40・39 | 167.0／171.2 | 10,814.723／11,585.987 | 0／0 |
| 最終移行版 | 1／39 | 213.9 | 11,094.204 | state_unsafe_mutation 1 |
| PR109後 base ca02・未変更 | 1／39 | 198.4 | 11,070.219 | state_unsafe_mutation 1 |
| ca02＋focus修正 | 2／39・39 | 196.0／189.2 | 11,336.977／12,158.819 | 0／0 |

全runで最終home／2日目・昼／読み込み成功、退出後GL資源0。正常な移行前2runのdrawElementsは294／353、修正後も294／353だった。title readinessの時間はsetup観測で、CPU profileはその後に始めている。bootのCPU原因や完全cold performanceをこの数値だけで特定しない。

正常な移行前の入れ子Commitはwall5,816.366／6,673.441ms、含まれるthread CPU60.727／63.076ms。修正後はwall6,448.081／7,279.456ms、CPU86.941／66.838ms。全RunTaskのCPUは欠落sliceがあり、既知下限は移行前1,736.205／1,677.145ms、修正後1,678.710／1,658.927ms（欠落1,593／2,354／2,006／2,680slice）。これらは入れ子で加算しない。非重複のaction readiness、scene準備、cue待機のouter windowで全wallを分け、未帰属は移行前199.854／205.198ms、修正後195.684／189.509msだった。action readinessにはPlaywright actionability、driver往復、font／画像decodeと2rAFも含まれる。click captureから2 microtask＋layoutまでの`inputToObservedDomWallMs`とも区別する。

profiling／trace／GL wall wrapperを外した候補1runは39入力、span10,762ms、error0、退出後GL0。資源のcreate／delete観測と入力markは残るため、完全無計測ではない。計測付き11.337／12.159秒との開きは計測負荷と実clock・queueの揺れを含み、一律に差し引く補正やspeedup根拠にはしない。直接viewにも`perf-view-plain`の対照を残す。実GPUと完全coldの初回費用、残る切替CPU／割当改善は未完了である。


Native診断はPlaywrightの通常locator.clickによるpointerとfocus、実adapter・core・保存bytesを通す性能実験。追加の製品E2E品質suiteにはしない。pure model、直接VRT、直接Native資源の既存保証を代替しない。

## PR110後への統合範囲

上の比較はPR109後のbase `ca02d8380983098f92be1ff48f9167a4ce9675d9`で固定した。後からmergeされたPR110のmain `ca4939433916f6dafe823de3a347b72ae371abd4`（tree `15287a13e816b1dee14bd0d60691979aab0d8d24`）のXState／保存検証変更を、過去45runのsourceへ混ぜない。focus修正と診断harnessの統合時は、PR110のcampaign snapshot生成を`profilerReady`より前に保ち、初回view描画だけをworkload内に残した。HUDのrules入力は同じ現行`campaignRules`を使う。

ca02上の修正commit `a0571de341b635696022c4abaaffcb48bc35d8b5`は、全game品質146.270秒（804 unit／13 view／10 renderer）、全editor品質129.023秒（10件）でそれぞれ成功した。wrapper時間はnpm ciからcontainer shutdownまでを含む。統合版の正確なtested head／tree、全game／editor結果とNative操作確認は、別worktreeの`test-results/perf-integrated-quality/`と提出記録で扱う。これは統合後の機能・資源確認であり、ca493を含む新たな性能同等性比較ではない。

統合版`61a053d649cf6b0b926f3b4e7e2cea77b908d0a2`（Adventure修正あり／Dungeon未変更）のplain Native journeyは39入力で、`growth-strike`による最後のGrowthChoice branch除去時に`state_unsafe_mutation`を1件再現した。保存した`campaignUi-DafC9aCM.js.map`ではDungeon.svelte136のraw focusout→campaignUi.ts21／28／57→dungeonView.svelte.ts144のmodel書込→sources.js159に対応し、effects.js582／526、branches.js149のdestroy／teardown中だった。全体journeyはhome／2日目・昼まで進みGL資源0になったが、例外のあるrunを正常結果として扱わない。

Dungeonのfocusin／outだけを標準`on`へ変更した一要因対照で、同じ39入力を通しbrowser error0、最終home／2日目・昼、save／resume成功、退出後Buffer／Texture／Program0を確認した。keydown／motion／ResizeObserver、同期dispatch、AbortSignal cleanupを変えていない。before／afterは`perf-integrated-native-before/`／`perf-integrated-native-after/`の結果と隣接mapへ保存した。real clockと描画回数の揺れがあるplain1runずつであり、速度の比較や移行前性能の回復の根拠にはしない。

## 証跡と必要な品質確認

| 内容 | local path |
| --- | --- |
| 初回3版比較 | 各worktreeの`test-results/perf-initial/` |
| 最終同条件比較 | 3基準worktreeの`test-results/perf-final-matched-{0,1,2}/`（候補先行測定は`perf-matched-*`） |
| Native操作の元例外／修正後 | `test-results/perf-play/`、`perf-focus-control/`、各worktreeの`perf-native-matched-*/` |
| profiling off対照 | `test-results/perf-native-plain/`、`perf-view-plain/` |
| 固定cue対照 | `test-results/perf-cue-visible/`、`perf-cue-hidden/`、`perf-cue-static/`、`perf-cue-confirm-*/` |
| allocation source／stack帰属 | `test-results/perf-initial/allocation-analysis.json`、`allocation-groups.json` |
| 不採用案 | 現在worktreeとcurrent-baseline worktreeの`perf-position-control/`、`perf-keyed-baseline/`、`perf-ro-*-*/`、`perf-anchor-*-*/`、`perf-reuse-*-*/`、`perf-menu-*-*/` |
| inactive DOM／listener／heap対照 | 2worktreeの`test-results/perf-retention-contract/results.json` |
| 対照source／map／結果のSHA-256 | `test-results/perf-final-quality/evidence-manifest.json`、`control-sources/`に抽出した各buildのsourcesContent |
| 全game／editor確認 | `test-results/perf-final-quality/`、`test-results/playwright*.json`、`coverage/` |

raw trace／CPU／allocationとそのbuild mapは各directoryに残す。`perf-reuse-invalid-preparation-*`はbuildと計測が重なった準備runとして比較から除いた。GLB・CSS・goldenを含むprotected bytesは`perf-final-quality/protected-bytes.json`でbaseと照合する。productの変更はAdventure／Dungeonのfocus event boundaryだけで、UI構造・見た目、測定した不採用案、golden／許容差・coverage閾値・worker設定は変更しない。

提出時は標準`npm run test:browser`と`npm run test:editor`を固定Dockerでそれぞれ全工程実行する。gameとeditorを別scopeで実行し、npm ci、check、必要build、全品質とshutdownの時間も記録する。この独立タスクへ#102のCI5分目標を追加しない。正確なtested head／tree、開始・終了・shutdownと層別時間は同directoryの`timing.json`と提出記録を参照する。sourceを固定した後の全件結果で判断し、部分成功やこの診断workloadを品質完了の代わりにしない。
