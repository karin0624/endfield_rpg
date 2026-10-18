---
name: git-auth
description: "karin0624/endfield_rpgのCodex workspaceでGit同期・HTTPS認証・Git LFS取得を扱う。現在の環境の正規経路と既存認証を使う。"
---

# Git認証と同期

現在の依頼の許可範囲とネットワーク制限に従う。環境構築の入口は[README](../../../README.md#セットアップと実行)。

## 操作の経路

| 目的 | 経路 |
| --- | --- |
| GitHub API、PR・Issue・Actions | 現在の環境で使えるGitHub connectorまたは認証済みCLI |
| コード公開、branch同期、clone・fetch・checkout・安全なpull | 対応するGitHub toolまたは公式Git、既存remote・認証 |
| LFS実体の取得・展開 | 公式Git LFSで必要なref・pathを取得する |

利用する経路は現在の環境と依頼の許可範囲で選ぶ。connectorのAPI取得だけでGit同期やLFS実体取得が済んだとは扱わない。

## 既存認証をGitへ接続する

同じ環境・host・認証経路で確認済みの設定と成功結果を再利用する。remote・credential設定が変わった場合や新しい失敗がある場合だけ再確認する。

1. remoteがHTTPSかSSHか確認する。HTTPSでは適用されるcredential helperをローカル設定から調べる。system／global／local、URL別設定、空値によるhelper列のresetを考慮する。設定全体やcredential値は出力しない。
2. 適切なhelperやSSH認証があれば維持する。remoteのprotocolを変えず、SSHの成功からHTTPSのLFS認証を推定しない。
3. HTTPSのhelperが未接続で既存gh認証を使う場合、認証状態が未確認なら次を一度実行する。

   ```sh
   gh auth status --hostname github.com
   ```

   対象アカウントの認証成功とエラーの有無を確認する。JSON出力は認証問題でも終了コード0の場合がある。環境変数の存在やconnector接続だけではgh・Gitの有効認証を確認できない。
4. gh認証が有効で、適切なhelperが未接続の場合だけ公式commandを使う。

   ```sh
   gh auth setup-git --hostname github.com
   ```

   host別global設定のhelper列をresetし、対応するgist hostも設定する。既存の適切な設定があれば実行せず、`--force`や自作helperを加えない。
5. 本来の取得・同期を実行する。成功確認だけの`ls-remote`やLFS再取得は前置しない。tokenの生成・抽出・転用・保存や`--show-token`は使わない。

## 同期とLFS取得

既存の作業treeを守り、単純追従には`git pull --ff-only`を使う。履歴分岐は停止して報告し、未承認のreset・clean・force・merge・rebaseは行わない。

LFSは`git lfs fetch`で必要なref・pathをcacheへ取得し、そのrefをcheckoutした作業treeで`git lfs checkout`により展開する。現在refには`git lfs pull`も使える。取得後はpointerのSHA-256 oid・sizeと照合する。

認証確認、helper設定、Git同期、LFS取得・展開の結果を区別する。失敗時はhost・ref・path、command、終了コード、秘密を除いたerrorと未確認事項を報告する。認証・権限の拒否を別credential・protocol・経路で回避しない。

## setupとの関係

[setup.mjs](../../../scripts/setup.mjs)は独立checkoutでLFSをlocal導入し、依存を導入する。HEADの`public/assets/`のLFS pointerと実体を照合し、不足だけを標準fetch・checkoutで取得して、再照合後に`check`を一度実行する。

共有worktreeではlocal設定も共有されるため、LFS操作前に停止する。setupはGit同期・helper変更・LFS access値の修復をせず、取得失敗時は後続検査へ進まない。

## 公式資料

- [gh auth status](https://cli.github.com/manual/gh_auth_status)、[setup-git](https://cli.github.com/manual/gh_auth_setup-git)
- [Git credentials](https://git-scm.com/docs/gitcredentials)、[worktree設定](https://git-scm.com/docs/git-worktree#_configuration_file)
- [Git LFS fetch](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-fetch.adoc)、[checkout](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-checkout.adoc)、[pull](https://github.com/git-lfs/git-lfs/blob/main/docs/man/git-lfs-pull.adoc)
