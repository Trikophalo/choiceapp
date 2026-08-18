import type { SyncAdapter } from './types'
import { LocalSync } from './local'
import { FirebaseSync } from './firebase'
import { isFirebaseConfigured } from './firebaseConfig'

let adapter: SyncAdapter | null = null

/**
 * Firebase when configured, same-device demo sync otherwise. Screens never
 * branch on this — they read `isCrossDevice` only to show an honest notice.
 */
export function getSync(): SyncAdapter {
  if (!adapter) {
    adapter = isFirebaseConfigured() ? new FirebaseSync() : new LocalSync()
  }
  return adapter
}

export { isFirebaseConfigured }
export type { SyncAdapter } from './types'
