export interface CreateConfig {
  image: string;
  region?: string;
  guest?: { cpus?: number; memory_mb?: number; cpu_kind?: string };
  extraEnv?: Record<string, string>;
}

export interface CreateResult {
  flyMachineId: string;
  flyAppName: string;
  region: string;
  config: Record<string, any>;
  healthCheckUrl: string;
}

export interface StoredMachine {
  flyAppName: string;
  flyMachineId: string;
  config: unknown;
}

export interface MachineProvider {
  create(userId: string, env: Record<string, string>, config: CreateConfig): Promise<CreateResult>;
  getState(machine: StoredMachine): Promise<string>;
  start(machine: StoredMachine): Promise<{ config?: Record<string, any> }>;
  stop(machine: StoredMachine): Promise<void>;
  delete(machine: StoredMachine): Promise<void>;
  cleanupApp(appName: string): Promise<void>;
  connectUrl(machine: StoredMachine): string;
}
