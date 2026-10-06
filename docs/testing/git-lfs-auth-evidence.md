# Git LFSのaccess学習値の診断記録

2026-10-05、別の性能検証環境から報告されたこのrepoの取得結果を記録する。手順は[endfield-git-auth skill](../../.agents/skills/endfield-git-auth/SKILL.md#lfsのaccess学習値を条件付きで診断復旧する)を参照する。このdocs作業では認証probe・LFS再取得を実施していない。

| 条件 | 報告された結果 |
| --- | --- |
| 既存の`gh auth status`と公式`gh auth setup-git` | 成功。LFS取得成功とは別に確認 |
| 通常Gitの取得 | client Authorization未送信、helper呼出しなしで200 |
| Git LFS 3.6系／3.8系、保存済みの対象endpointの`access=basic` | credential fillとclient Authorization送信があり、batch POSTは403 |
| 対象access値だけをcommand scopeの空値へ戻す初期交渉の対照 | batch POST／asset GETはclient Authorization未送信、helper呼出しなしで200。実体のsize／SHA-256がpointerと一致 |
| 対象保存キーのunset後、Git LFS 3.8でaccess上書きなしの標準取得 | 隔離worktree・空storageで`git lfs pull`を一度実行し、batch POST／object GETとも200、exit0。helper呼出しなし、実体のsize／SHA-256がpointerと一致 |

対照で取得した実体は58,790,396 bytes、SHA-256は`0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9`。この観測は保存済み学習値と初回の認証送信タイミングを分ける根拠になるが、匿名公開・proxy認証の有無・すべての403の原因を確定しない。credential・helper・hostを変更した拒否回避や、常時認証無効化の成功として扱わない。

恒久復旧の最終検証では、性能環境のlocal `.git/config`にある対象endpointのaccessキーだけをunsetした。`none`の固定、helper・remoteの変更、既存cacheの削除は行っていない。元checkoutではキー未設定と初期accessモード`none`を確認し、Git LFS 3.8の隔離worktree・空storageでaccess上書きなしの標準pullを一度実行した。`github.com`へのbatch POSTと`github-cloud.githubusercontent.com`へのobject GETは200、exit0で、新規download・展開した実体は上記size／SHA-256と一致した。

この最終検証ではheader traceを無効にしていたため、helper呼出しがなかったことからclient Authorizationの有無を直接観測したとは扱わない。保存済みの先行Basic送信との差が取得を阻害したことと、この条件での恒久復旧を確認した範囲に限定する。proxyの認証方式・最初の拒否の原因は未確定。キーunset後の3.6系は未試験で、systemの3.6系も変更していないため、3.8の必須性は確定していない。

公式根拠は[3.8.0 config](https://github.com/git-lfs/git-lfs/blob/v3.8.0/docs/man/git-lfs-config.adoc)、[endpoint finder](https://github.com/git-lfs/git-lfs/blob/v3.8.0/lfsapi/endpoint_finder.go)、[auth](https://github.com/git-lfs/git-lfs/blob/v3.8.0/lfsapi/auth.go)。[maintainerの確認例](https://github.com/git-lfs/git-lfs/issues/6358#issuecomment-5977233607)はlock endpointの初期交渉を扱うもので、このrepoのbatch／object取得の実測とは区別する。

## 2026-10-06の再発報告と自動setupの条件

市場taskのGit LFS 3.6.1、接続済みofficial helper、対象endpointの単一local `access=basic`で、標準stderrは `batch response: Maximum number of login attempts exceeded. Please try again later.` だったと親から報告された。stderrにHTTP403の数字は含まれない。同endpoint／ref／pathで空access対照が成功し、対象キー修復後の空storage標準取得もbatch／object 200、上記oid／size一致だった。これはその条件の報告であり、この文書編集で再現した通信や一般的なlogin制限の解除を意味しない。

自動setupはfetch前から存在し、失敗後にも同じorigin／scope／値で残る既知の単一local学習状態だけを対照候補にする。初回challengeが新規保存した値、明示的な権限拒否・quota、未知／共有設定では対照を追加しない。エラー文だけでunsetせず、同一対象の対照取得・実体照合成功後に対象キーだけを修復し、空storage標準取得と照合が成功してから検査へ進む。

複数worktreeではGitのlocal configが共有される。`extensions.worktreeConfig` が有効ならGitの `--worktree` は固有の `config.worktree` を扱うが、使用中LFSのaccess学習はlocal configへ保存されるため、setupはLFS操作前に停止して共通・固有設定を保持する。自動setup用の拡張有効化・設定移行は行わず独立checkoutを使う。根拠は[Git worktree設定](https://git-scm.com/docs/git-worktree#_configuration_file)と[Git LFS 3.6.1のSetAccess](https://github.com/git-lfs/git-lfs/blob/v3.6.1/lfsapi/endpoint_finder.go)。
