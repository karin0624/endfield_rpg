import { flushSync, mount, unmount } from "svelte";
import BattleSurface from "./components/BattleSurface.svelte";
export function createBattleSurface(app: HTMLElement) {
  let ready = $state(false),
    error = $state(false),
    message = $state("戦闘画面を読み込んでいます…");
  const component = mount(BattleSurface, {
    target: app,
    props: {
      get ready() {
        return ready;
      },
      get error() {
        return error;
      },
      get message() {
        return message;
      },
    },
  });
  flushSync();
  return {
    render(next: { ready: boolean; error: boolean; text: string }) {
      ready = next.ready;
      error = next.error;
      message = next.text;
    },
    dispose() {
      void unmount(component);
    },
  };
}
