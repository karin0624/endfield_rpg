# 出撃準備・キャラクター選択のコンセプト

対象は編成の資料であり、新しいホーム・街の構成や承認の基準ではない。新規成果の保存先は[制作手順](../ui-asset-production.md#制作依頼と保存)に従う。以下のLibrary記録は既存原出力の所在として保持する。

このフォルダーは承認済みの配置・余白・色調の参照画像を保持する。ゲームの実行時に画像を読み込んだり、完成UIとして表示したりしない。文字・キャラクター・HP・操作状態は別途実装する。実行用背景と参照元・利用条件は[素材メモ](../../art-src/README.md#出撃準備の生成背景)を参照する。

この配置・色調の参照承認だけで、HP・状態・操作差分を含む完成画面の実装承認とはしない。実装前に[必須ゲート](../ui-asset-production.md#ui開発の必須ゲート)に従い、必要情報を反映した完成画像の固定版・寸法・hash・承認元・比較fixtureを記録する。既存の実画面記録を承認済み画像へ読み替えない。

画像はいずれも1672×941。元PNGを変更せず無劣化WebPへ形式変換し、RGBAへ復号した全画素が元画像と完全一致することを検証済み。拡大、色変更、内容変更は行っていない。元PNGは以下のChatGPT Libraryファイルに保持する。

| リポジトリの参照画像 | 元PNG・Library | 元PNGのSHA-256 | WebPのSHA-256 |
| --- | --- | --- | --- |
| `endfield-departure-preparation-refined-concept.webp` | `endfield-departure-preparation-refined-concept.png`、`libfile_54f1dec8131c8191990392016882378f` version 3 | `70296dbd6b0008b76f68a25dcf9076c872c972c568b2eafd8802f6c3af56cee0` | `2703a1d36ac9af8176e274b66d7acc6b5457f626931b4f6e3c7ab09061ad69f9` |
| `endfield-character-selection-concept.webp` | `endfield-character-selection-concept.png`、`libfile_43405c6c10ac81918341ebfd589250e5` | `0c8de091b7a96a0709706e109f79056f1f3802ebdfffe3c1b3e7ef8a55290c80` | `77933965e398f02f6c611a81d93a2faa42d9a851092b6435df7182e568586845` |

承認された生成コンセプトの参照用派生データであり、第三者の参照画像自体は同梱していない。生成物であることは第三者の権利や利用許諾の保証を意味しない。
