import { Client } from '@xhayper/discord-rpc'

const CLIENT_ID = '1527376861485858957'

let client: Client | null = null
let connectPromise: Promise<void> | null = null

async function ensureConnected(): Promise<void> {
  if (client?.user) return

  if (connectPromise) {
    await connectPromise
    return
  }

  connectPromise = connect()

  try {
    await connectPromise
  } finally {
    connectPromise = null
  }
}

async function connect(): Promise<void> {
  try {
    const newClient = new Client({
      clientId: CLIENT_ID
    })

    newClient.on('disconnected', () => {
      if (client === newClient) {
        client = null
      }
    })

    await newClient.connect()

    client = newClient
  } catch {
    client = null
  }
}

export async function updatePresence(data: {
  trackName: string
  artist?: string
  currentTime: number
  duration: number
  artworkUrl?: string
}): Promise<void> {
  try {
    if (
      !data.trackName ||
      !Number.isFinite(data.currentTime) ||
      !Number.isFinite(data.duration) ||
      data.duration <= 0
    ) {
      return
    }

    await ensureConnected()

    if (!client?.user) return

    const currentTime = Math.max(0, Math.min(data.currentTime, data.duration))
    const duration = Math.max(1, data.duration)

    const now = Date.now()
    const startTimestamp = now - currentTime * 1000
    const endTimestamp = startTimestamp + duration * 1000

    await client.user.setActivity({
      details: data.trackName,
      state: data.artist || 'Playing music',
      startTimestamp,
      endTimestamp,
      largeImageKey: data.artworkUrl || 'logo',
      largeImageText: data.trackName
    })
  } catch {
    client = null
  }
}

export async function clearPresence(): Promise<void> {
  try {
    await ensureConnected()

    if (!client?.user) return

    await client.user.setActivity({})
  } catch {
    client = null
  }
}

export function destroy(): void {
  if (!client) return

  client.destroy()
  client = null
  connectPromise = null
}
