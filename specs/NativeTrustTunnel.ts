import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  start(serverName: string, config: string): Promise<void>;
  stop(): Promise<void>;
  updateConfiguration(serverName: string | null, config: string | null): Promise<void>;
  getCurrentState(): Promise<number>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeTrustTunnel');
