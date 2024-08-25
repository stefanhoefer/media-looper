import {createIndexedDbPersister} from 'tinybase/persisters/persister-indexed-db';
import {setupLocalSettingsStore, setupStore} from "@/lib/stores/core";
import {
  hubServer,
  multiSender,
  runtimeOnMessageSender, runtimeOnMessageListener, channelListener, channelSender
} from "@/lib/misc/browser-network";

import {createWsSynchronizer} from "tinybase/synchronizers/synchronizer-ws-client";
import {MergeableStore} from "tinybase";

async function setupWebSocketSync(store: MergeableStore, settingsStore: MergeableStore) {
  let wsSync: ReturnType<typeof createWsSynchronizer> | null = null

  async function updateServer(connectionURL: string) {
    console.log('Updating server connection', connectionURL);

    if (wsSync) {
      console.log('Destroyed previous WS synchronizer');

      try {
        (await wsSync).destroy()
      } catch(e) {} finally {
        settingsStore.setValue('websocket-server-status', '');
        wsSync = null
      }
    }

    if (connectionURL) {
      settingsStore.setValue('websocket-server-status', 'connecting');

      try {
        const webSocket = new WebSocket(connectionURL as string);

        wsSync = createWsSynchronizer(
          store,
          webSocket,
        );

        await (await wsSync).startSync();

        webSocket.addEventListener('error', (e) => {
          console.log('got websocket error', e);
          settingsStore.setValue('websocket-server-status', 'error');
        })

        webSocket.addEventListener('close', (e) => {
          console.log('websocket disconnected', e);
          if (settingsStore.getValue('websocket-server-status') !== '')
            settingsStore.setValue('websocket-server-status', 'error');
        })

        console.log('Background store WS sync ready');

        settingsStore.setValue('websocket-server-status', 'connected');
      } catch(e) {
        console.log(`Failed to connect to ${connectionURL}`, e);

        settingsStore.setValue('websocket-server-status', 'error');
      }
    } else {
      settingsStore.setValue('websocket-server-status', '');
    }
  }

  await updateServer(settingsStore.getValue('websocket-server-url') as string)

  settingsStore.addValueListener('websocket-server-url', (store, valueId, newValue, oldValue, getValueChange) => {
    updateServer(newValue as string)
  }, true)
}

export default defineBackground({
  persistent: true,

  main() {
    const hub = hubServer()

    const ctx = setupStore({
      listener: channelListener(runtimeOnMessageListener, 'tiny-sync'),
      sender: channelSender(multiSender(hub, runtimeOnMessageSender), 'tiny-sync'),
      persister: (store) => createIndexedDbPersister(store, 'youtube-looper-tb'),
      localOptions: {
        listener: channelListener(runtimeOnMessageListener, 'tiny-sync-local-settings'),
        sender: channelSender(multiSender(hub, runtimeOnMessageSender), 'tiny-sync-local-settings'),
        persister: (store) => createIndexedDbPersister(store, 'youtube-looper-tb-local'),
      }
    })

    ctx.ready.then(async () => {
      console.log('Background store started');

      await setupWebSocketSync(ctx.store, ctx.localStore)
    })

    // @ts-ignore
    globalThis.store = ctx.store
  }
});
