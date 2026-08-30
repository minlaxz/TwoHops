import React, { createContext, useContext, useSyncExternalStore } from 'react';
import { VpnClient } from '../services/vpn';
import {
  createTunnelSession,
  type SessionSnapshot,
  type TunnelSession,
} from '../services/tunnelSession';

type TunnelSessionContextValue = {
  snapshot: SessionSnapshot;
  session: TunnelSession;
};

const TunnelSessionContext = createContext<
  TunnelSessionContextValue | undefined
>(undefined);

// The Session is the only reader of the native module; the wrapper is its port.
let realSession: TunnelSession | undefined;
const defaultSession = () => (realSession ??= createTunnelSession(VpnClient));

type Props = {
  children: React.ReactNode;
  /** Injected for tests; defaults to the real native adapter. */
  session?: TunnelSession;
};

export function TunnelSessionProvider({
  children,
  session = defaultSession(),
}: Props) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return (
    <TunnelSessionContext.Provider value={{ snapshot, session }}>
      {children}
    </TunnelSessionContext.Provider>
  );
}

export function useTunnelSession(): TunnelSessionContextValue {
  const value = useContext(TunnelSessionContext);
  if (!value) {
    throw new Error(
      'useTunnelSession must be used inside TunnelSessionProvider.',
    );
  }
  return value;
}
