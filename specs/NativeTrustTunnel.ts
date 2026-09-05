import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  start(serverName: string, config: string): Promise<void>;
  stop(): Promise<void>;
  updateConfiguration(
    serverName: string | null,
    config: string | null,
  ): Promise<void>;
  getCurrentState(): Promise<number>;
  /** Core Logging gate + Core Log Level (issue #136). Level is one of
   * error/warn/info/debug/trace; OFF restores the native default (INFO). */
  setCoreLogging(enabled: boolean, level: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeTrustTunnel');
