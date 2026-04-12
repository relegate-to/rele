import { userAppName } from "../../lib/app-name";
import type { MachineProvider, CreateConfig, CreateResult, StoredMachine } from "./interface";

async function runDocker(args: string[]): Promise<string> {
  const proc = Bun.spawn(["docker", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`docker ${args[0]} failed: ${stderr}`);
  }
  return stdout.trim();
}

async function getPort(name: string): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const output = await runDocker(["port", name, "80"]);
      const firstLine = output.split("\n")[0];
      const port = parseInt(firstLine.split(":").pop()!);
      if (!isNaN(port)) return port;
    } catch {
      if (attempt < 2) await Bun.sleep(500);
    }
  }
  throw new Error(`No published port 80 for container ${name}`);
}

export class DockerProvider implements MachineProvider {
  constructor(private readonly image: string) {}

  async create(userId: string, env: Record<string, string>, config: CreateConfig): Promise<CreateResult> {
    const containerName = userAppName(userId);
    const fullEnv = {
      ...env,
      ...(process.env.GATEWAY_REMOTE_URL ? { GATEWAY_REMOTE_URL: process.env.GATEWAY_REMOTE_URL } : {}),
    };
    const envArgs = Object.entries(fullEnv).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
    const id = await runDocker(["run", "-d", "--name", containerName, "-p", "18790:80", ...envArgs, this.image]);
    const port = 18790;
    return {
      flyMachineId: id,
      flyAppName: containerName,
      region: "local",
      config: { image: this.image, env: fullEnv, dockerPort: port },
      healthCheckUrl: `http://localhost:${port}`,
    };
  }

  async getState(machine: StoredMachine): Promise<string> {
    try {
      const status = await runDocker(["inspect", "--format", "{{.State.Status}}", machine.flyAppName]);
      if (status === "running") return "started";
      if (status === "exited" || status === "dead") return "stopped";
      return status;
    } catch {
      return "stopped";
    }
  }

  async start(machine: StoredMachine): Promise<{ config?: Record<string, any> }> {
    await runDocker(["start", machine.flyAppName]);
    const port = await getPort(machine.flyAppName);
    return { config: { ...(machine.config as any), dockerPort: port } };
  }

  async stop(machine: StoredMachine): Promise<void> {
    await runDocker(["stop", machine.flyAppName]);
  }

  async delete(machine: StoredMachine): Promise<void> {
    await runDocker(["rm", "-f", machine.flyAppName]);
  }

  async cleanupApp(_appName: string): Promise<void> {
    // no-op for Docker
  }

  connectUrl(machine: StoredMachine): string {
    const port = (machine.config as any)?.dockerPort;
    return `ws://localhost:${port}`;
  }
}
