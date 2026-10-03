import { rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { type AdventureSettings, parseAdventureSettings } from "../src/web/adventureSettings.ts";

// 開発サーバー専用。保存先を会話画面の標準設定に固定する。
export function adventureSettingsPlugin(): Plugin {
  let settingsPath: string;
  return {
    name: "adventure-settings",
    apply: "serve",
    configResolved(config) {
      settingsPath = resolve(config.root, "src/web/adventure-settings.json");
    },
    hotUpdate({ file, modules }) {
      if (file !== settingsPath) return;
      for (const module of modules) this.environment.moduleGraph.invalidateModule(module);
      return [];
    },
    configureServer(server) {
      let saving = false;
      server.middlewares.use("/__dev/adventure-settings", async (request, response) => {
        const reply = (status: number, message: string) => {
          response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ message }));
        };
        if (request.method !== "POST") return reply(405, "POSTのみ使用できます。");
        if (
          !["http://", "https://"].some((scheme) => request.headers.origin === `${scheme}${request.headers.host}`) ||
          request.headers["content-type"] !== "application/json"
        ) {
          return reply(403, "設定画面から保存してください。");
        }
        if (saving) return reply(409, "保存中です。少し待ってから再度保存してください。");
        saving = true;
        try {
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of request) {
            const buffer = Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > 4096) return reply(413, "設定が大きすぎます。");
            chunks.push(buffer);
          }
          const body = Buffer.concat(chunks, bytes).toString("utf8");
          let settings: AdventureSettings;
          try {
            settings = parseAdventureSettings(JSON.parse(body));
          } catch (error) {
            return reply(400, error instanceof Error ? error.message : "設定を読み取れません。");
          }
          const temporaryPath = `${settingsPath}.tmp`;
          await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`);
          await rename(temporaryPath, settingsPath);
          reply(200, "標準として保存しました。通常表示と次回ビルドに反映されます。");
        } catch (error) {
          server.config.logger.error(String(error));
          reply(500, "保存できませんでした。ファイルの書き込み権限を確認してください。");
        } finally {
          saving = false;
        }
      });
    },
  };
}
