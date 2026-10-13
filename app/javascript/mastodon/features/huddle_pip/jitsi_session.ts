// Singleton that holds the live Jitsi API and its persistent DOM container
// while a Huddle call is minimized to PiP. Lives outside any React component
// so it survives navigation (component unmount/remount).
//
// Both live/index.tsx and huddle_pip/index.tsx import from here — this file
// imports from neither, avoiding circular dependencies.

export interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, callback: () => void) => void;
  executeCommand: (command: string, ...args: string[]) => void;
  getNumberOfParticipants: () => number;
  _countInterval?: ReturnType<typeof setInterval>;
}

interface JitsiSession {
  api: JitsiApi;
  container: HTMLDivElement;
}

let session: JitsiSession | null = null;

export function setJitsiSession(s: JitsiSession | null): void {
  session = s;
}

export function getJitsiSession(): JitsiSession | null {
  return session;
}

export function disposeJitsiSession(): void {
  if (!session) return;
  if (session.api._countInterval) clearInterval(session.api._countInterval);
  session.api.dispose();
  session.container.remove();
  session = null;
}
