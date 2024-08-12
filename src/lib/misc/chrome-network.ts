import {nanoid} from "nanoid";

export function backgroundListen() {
  const clients: {[k: string]: any[]} = {}

  chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
    switch(msg.__connType) {
      case "connect":
      {
        clients[msg.senderId] ||= []
      }
        break
      case "pull":
      {
        sendResponse(clients[msg.senderId])

        clients[msg.senderId] = []
      }
        break
      case "disconnect":
      {
        delete clients[msg.senderId]
      }
        break
    }
  })

  return {
    postMessage(msg: any) {
      for (const k in clients) {
        clients[k].push(msg)
      }
    }
  }
}

type Listener = (msg: any) => void

export function contentScriptListen({pullInterval = 1000}) {
  const peerId = nanoid()

  chrome.runtime.sendMessage({__connType: 'connect', senderId: peerId})

  let listeners: Listener[] = [];

  setTimeout(async function tick() {
    const msgs = await chrome.runtime.sendMessage({__connType: 'pull', senderId: peerId})

    for (const msg of msgs || []) {
      for (const l of listeners) {
        l(msg)
      }
    }

    setTimeout(tick, pullInterval)
  }, pullInterval)

  return {
    addListener(listener: Listener) {
      listeners.push(listener)
    },

    removeListener(listener: Listener) {
      listeners = listeners.filter(x => x !== listener)
    },

    disconnect() {
      chrome.runtime.sendMessage({__connType: 'disconnect', senderId: peerId})
    }
  }
}
