# Git LFSのaccess学習値を診断する条件

診断手順は[endfield-git-auth skill](../../.agents/skills/endfield-git-auth/SKILL.md#lfsのaccess学習値を条件付きで診断復旧する)を参照する。自動setupは、以下の既知条件に一致する状態だけを対象にする。認証・取得権限を変更する手順ではない。

## 対象と整合確認

| 対象 | 条件 |
| --- | --- |
| endpoint | `https://github.com/karin0624/endfield_rpg.git/info/lfs` |
| 素材 | [ground1.glb](../../public/assets/ground/ground1.glb)。pointerのoidとsizeを取得対象に照合する |
| 既知の実体 | 58,790,396 bytes、SHA-256 `0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9` |
| 使用中LFS | Git LFS 3.6系／3.8系 |
| 保存状態 | 単一のlocal `.git/config`にある対象endpointの`access=basic`。fetch前から存在し、失敗後も同じorigin／scope／値で残る |
| 対象の失敗 | batchのlogin-attempt失敗、batch403、先行credential不足。エラー文だけでは修復を判断しない |

初回challengeが新規保存した値、明示的な権限拒否・quota、未知／共有設定では対照を追加しない。別credential・host・remote・helperへ変更して拒否を回避しない。

## 原因対照と修復の境界

保存済み`basic`による先行credential要求と、access未設定時の初期交渉を区別する。同一endpoint・ref・path・既存認証のまま、空storageとcommand scopeの空access値を使った取得・展開・oid／size照合が成功した場合だけ、対象の単一学習値を修復する。その後、空storageからaccess上書きなしの標準取得・展開・照合が成功することを確認する。command対照成功だけを恒久復旧と報告しない。

対象キーだけをunsetし、`none`の固定、credential・helper・remoteの変更、既存cacheの削除を行わない。対照失敗・別の拒否・複数値・別保存元・未知の条件では停止し、後続の品質検査を実行しない。Git LFS 3.8の成功を3.8必須性の証明にせず、3.6系への一般的な復旧保証も主張しない。

helper呼出しがないことだけでは、client Authorization未送信を直接観測したことにならない。取得成功を匿名公開、proxy認証方式、最初の拒否原因の確定へ広げない。

## 複数worktree

Gitのlocal configはworktree間で共有される。`extensions.worktreeConfig`が有効ならGitの`--worktree`は固有の`config.worktree`を扱うが、LFSのaccess学習はlocal configへ保存される。setupはLFS操作前に停止して共通・固有設定を保持する。自動setup用の拡張有効化・設定移行は行わず、独立checkoutを使う。

## 参照

- [対象repositoryの復旧記録](https://github.com/karin0624/endfield_rpg/pull/108)
- [Git LFS 3.8.0 config](https://github.com/git-lfs/git-lfs/blob/v3.8.0/docs/man/git-lfs-config.adoc)、[endpoint finder](https://github.com/git-lfs/git-lfs/blob/v3.8.0/lfsapi/endpoint_finder.go)、[auth](https://github.com/git-lfs/git-lfs/blob/v3.8.0/lfsapi/auth.go)
- [Git worktree設定](https://git-scm.com/docs/git-worktree#_configuration_file)、[Git LFS 3.6.1のSetAccess](https://github.com/git-lfs/git-lfs/blob/v3.6.1/lfsapi/endpoint_finder.go)
