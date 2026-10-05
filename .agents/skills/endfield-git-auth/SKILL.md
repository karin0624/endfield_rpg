---
name: endfield-git-auth
description: "karin0624/endfield_rpgのCodex workspaceでGitの取得・同期・HTTPS認証、credential helper接続、Git LFS取得を扱うときに使う。既存認証を再利用し、GitHub API・公開はconnectorへ振り分ける。"
---

# Codex workspaceのGit認証と同期

このskillは既存の正規認証をGitへ接続する手順を定める。現在の依頼の許可範囲・ネットワーク制限・停止条件を優先し、認証確認や取得を許可されていない作業では実行しない。通常の環境構築は[README](../../../README.md#セットアップと実行)を参照する。

## 操作の経路を選ぶ

| 目的 | 経路 |
| --- | --- |
| GitHubサービスのAPI read/write、コード公開、branch・PR・Issue・Actions操作 | GitHub connector。対応actionがなければ不足を報告する |
| 開発workspaceのclone・fetch・checkout・安全なpull | 選択済み環境の標準checkoutと公式Git、既存remote・認証 |
| Git LFS実体の取得・展開 | 公式Git LFS、対象ref・pathに必要な範囲 |

connectorのAPI fetchはGitのfetchではなく、LFS pointerは素材実体ではない。connectorでrepository全体を復元したり、公開action不足を`gh`・`git push`・shell HTTPで迂回したりしない。

## 既存の認証を再利用する

1. 同じ環境・host・認証経路について、引継ぎや当該作業で確認済みの設定・成功結果を再利用する。設定済みなら、各Git commandやsessionの前に`gh auth status`・`gh auth setup-git`を繰り返さない。環境・remote・credential設定の変更や新しい失敗があるときだけ、実行判断に必要な情報を確認する。
2. 未確認の場合だけ、対象remoteがHTTPSかSSHか、HTTPSなら対象URLに適用されるcredential helperがあるかをローカル設定から確認する。system/global/local・URL別設定と汎用`credential.helper`、空値によるhelper列のresetを考慮する。credentialを取得する操作や設定全体のdumpは使わず、秘密値をログへ出さない。
3. 適切な既存helperやSSH認証経路があるならそれを維持する。helperがgh以外という理由だけで置き換えず、remoteを無断でHTTPS／SSHへ変更しない。SSHのGit認証からHTTPSのLFS認証成功を推定しない。
4. HTTPSで有効なhelperが未接続かつ既存のgh認証を使う場合、確認済みの認証成功があれば次の設定へ進む。未確認で認証確認が許可されている場合だけ、一度実行する。

   ```sh
   gh auth status --hostname github.com
   ```

   終了コードに加え、対象hostの使用するアカウントの認証成功表示と認証エラーの有無を確認する。終了コード0だけを成功条件にせず、不明・エラーなら設定へ進まない。`--active`など新しい版のoptionには依存しない。`--json`は認証問題があっても0を返す場合があり、終了コードだけの判定に使わない。`GH_TOKEN`／`GITHUB_TOKEN`の存在や、connector接続はgh・Gitの有効認証の証拠ではない。
5. 既存gh認証が有効で、適切なhelperが未接続と確認できた場合の標準設定は、公式commandを一度使う。

   ```sh
   gh auth setup-git --hostname github.com
   ```

   これはhost別のglobal Git設定を変更し、既存helper列をresetしてghを接続するため、既存の適切な設定がある環境では実行しない。対応するgist hostにも設定する。`--force`を加えず、一時的な`git -c credential.helper=...`や自作helper設定を通常手順にしない。設定成功を引き継ぎ、必要な場合だけ有効な設定をローカルで確認する。設定変更の権限が不足・拒否されたら止める。
6. 準備が揃えば、許可された本来の取得・同期へ進む。成功確認だけの`ls-remote`やLFS再取得を前置せず、本来の操作結果を証拠にする。新token生成、secret読出し、token値の抽出・転用・保存、`--show-token`、権限拡大を行わない。

## 同期・LFS取得の結果を分ける

- 既知のref・作業tree状態を使い、既存作業を守って同期する。単純追従には`git pull --ff-only`を使い、履歴が分岐していれば停止する。reset・clean・forceや未承認のmerge／rebaseで通さない。
- LFSは必要なref・pathを`git lfs fetch`でcacheへ取得し、対象refがcheckout済みの作業treeで`git lfs checkout`により展開する。現在refなら`git lfs pull`も使える。別refの取得だけでは作業treeのrefは変わらない。通常取得に`--all`を加えず、実体をpointerのSHA-256 oid・sizeと照合する。
- gh認証成功、helper設定成功、Git同期成功、LFS download／展開成功を別々に報告する。helper設定成功はLFS成功を保証しない。未接続による失敗と、認証付きrequestへの401／403等のサーバ拒否、upload／lockとdownloadの失敗を混同しない。
- 認証確認・設定の失敗やサーバ拒否が残る場合は、同じ失敗を連打せず、別credential・protocol・取得経路で迂回しない。LFSの保存済みaccess学習値に根拠がある場合だけ、下記の条件付き診断を行う。対象host／ref／path、command、終了コード、安全に秘匿したerror、確認済み事項と未確認事項を返す。LFS実体がない検証を完了扱いにしない。

## LFSのaccess学習値を条件付きで診断・復旧する

`lfs.<url>.access=basic`は、通常LFSが401応答から保存するURL別の認証学習値で、batch request前にcredentialを要求する。helper未設定とは別の設定であり、gh認証・helper設定が成功していても初期requestの送信タイミングへ影響する。既知の正常系で毎回確認・初期化せず、失敗した対象endpointと実環境versionについて必要な場合だけ調べる。

1. 既存の正式な認証経路を保持し、失敗がbatch POSTかobject GETか、helper呼出しとclient Authorization送信が初回からあったか、HTTP statusを確認する。引継ぎ済みの安全な記録を再利用し、header値・token・credentialのdumpや新しい認証probeを行わない。通常Gitの200だけでLFSの認証経路を判断しない。
2. 対象LFS API endpointに適用されるaccess値・origin・scopeをローカルで確認する。以下は実際のendpointに置換した、該当キーだけの確認例。Git LFSのURL matchingに適用される別のaccessキーや`.lfsconfig`がある場合も、その関係する設定だけを確認する。

   ```sh
   lfs_endpoint='https://github.com/<owner>/<repo>.git/info/lfs'
   lfs_access_key="lfs.${lfs_endpoint}.access"
   git config --show-origin --show-scope --get-all "$lfs_access_key"
   ```

3. 保存済み`basic`が初回のcredential要求につながった証拠と、[公式根拠](#公式根拠)・[このrepoの検証記録](../../../docs/testing/git-lfs-auth-evidence.md)のような原因対照の根拠があり、取得が許可されている場合だけ、同じendpoint・ref・path・既存認証のままaccess値だけをcommand scopeの空値へ戻して一度対照する。以下の変数は許可済みの対象に設定する。

   ```sh
   git -c "$lfs_access_key=" lfs fetch --include="$target_path" "$target_remote" "$target_ref"
   ```

   これは標準の初期交渉へ戻す対照で、認証を常時無効化する設定ではない。401 challengeならLFSが既存認証を使って交渉できる。既存Authorizationや別の認証設定がある場合のheader未送信を保証しない。失敗を繰り返さず、明確なアクセス拒否・上限を別credential・host・経路で迂回しない。
4. 対照が成功し、保存値が不要だったと確認できた場合だけ、その値を保存したscope・fileの該当キーをunsetする。localに単一の`basic`がある場合の例は次のとおり。global／worktree／include先等なら確認した保存元と変更権限を使い、scope不明・複数値・unset失敗を無視して削除範囲を広げない。

   ```sh
   git config --local --unset "$lfs_access_key" '^basic$'
   ```

   対象設定の除去後、必要なら空のLFS object cacheを持つ隔離checkoutで、access上書きなしの標準取得・展開とpointerのoid／size一致を確認してから恒久復旧と報告する。既存cache・作業treeを削除して検証せず、学習値が再設定される場合はその応答・理由を確認する。全面的なcredential削除、常時`access=none`固定、hookからの自動reset、すべての403への自動適用を行わない。
5. client Authorization未送信で取得できた観測は、その条件の結果として記録する。匿名公開やproxy側の認証の有無は断定せず、command対照成功と、保存値除去後の標準取得成功を区別する。

## startup hookとの関係

[startup hook](../../../.codex/hooks.json)は`git pull --ff-only`の成功後に`npm ci`を実行し、認証setupを行わない。初回の必要な認証準備には上記手順を使い、hookからglobal credential設定を毎回書き換えたり、認証probe・LFS再試行を自動追加したりしない。hook失敗時は許可された範囲の原因確認を行い、自動再試行で押し通さない。

## 公式根拠

- [gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git): ghをGit credential helperへ接続し、`--hostname`で対象hostを指定する。
- [gh auth status](https://cli.github.com/manual/gh_auth_status): 認証状態の確認と、JSON出力の終了コードの制限。
- [Git credentials](https://git-scm.com/docs/gitcredentials): URL別credential設定、helperの連鎖と空値reset。
- [GitHub CLI helper設定の実装](https://github.com/cli/cli/blob/trunk/pkg/cmd/auth/shared/gitcredentials/helper_config.go): host別global設定の置換と対応gist hostの設定。
- [Git LFS fetch](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-fetch.adoc)、[checkout](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-checkout.adoc)、[pull](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-pull.adoc): 取得・展開・現在refへの適用。
- [Git LFS 3.8.0 config](https://github.com/git-lfs/git-lfs/blob/v3.8.0/docs/man/git-lfs-config.adoc): `lfs.<url>.access`の学習と初回のcredential要求。
- [3.8.0 endpoint finder](https://github.com/git-lfs/git-lfs/blob/v3.8.0/lfsapi/endpoint_finder.go)、[auth](https://github.com/git-lfs/git-lfs/blob/v3.8.0/lfsapi/auth.go): access値の読出し・local保存、初期交渉と既存認証の利用。
- [maintainerの初期交渉の確認例](https://github.com/git-lfs/git-lfs/issues/6358#issuecomment-5977233607): lock endpointでaccess未設定時に最初のrequest、401 challenge、既存認証付きrequestを確認。batchへの適用は上記config・実装とrepoの対照結果で判断する。
- [Git config](https://git-scm.com/docs/git-config): 設定origin／scopeの確認と該当キーのunset。
