# Track800

Expo SDK 57 (React Native 0.86 / React 19.2)。
コードを書く前に https://docs.expo.dev/versions/v57.0.0/ の該当ページを確認すること。
Expo は API がよく変わるので、記憶で書かずに必ずそのバージョンのドキュメントを見る。

## SDK は最新に追従し続けること

**Expo Go は最新 SDK 版しか動かない。** iOS では App Store の制約で
古いバージョンの Expo Go を入れられないため、SDK が1つ古くなるだけで
実機から開けなくなる（2026-07 に SDK 56 のまま放置してこの問題が起きた）。

新しい SDK が出たら追従する:

```bash
npx expo install expo@^<新SDK>.0.0 --fix
npx expo-doctor@latest
npx tsc --noEmit
```

## 構成の前提

- **サーバーを使わない。** データは端末内(AsyncStorage)にのみ保存する
- **認証・ログインはない。** 追加しないこと
- メニュー共有はサーバーではなく文字列の共有コード（`lib/shareCode.ts`）
- 保存まわりは `lib/storage.ts` と `lib/AppContext.tsx` に閉じる

設計の詳細と推定エンジンの根拠は README.md を参照。
