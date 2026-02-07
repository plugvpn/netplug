import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCommand(cmd: string) {
  try {
    const { stdout, stderr } = await execAsync(cmd);
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || '',
      code: error.code,
    };
  }
}

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check if wg is installed
  diagnostics.checks.wgInstalled = await runCommand('which wg');

  // Check if wg-quick is installed
  diagnostics.checks.wgQuickInstalled = await runCommand('which wg-quick');

  // Check current user
  diagnostics.checks.currentUser = await runCommand('whoami');

  // Check if running as root
  diagnostics.checks.userId = await runCommand('id -u');

  // List WireGuard interfaces
  diagnostics.checks.interfaces = await runCommand('wg show interfaces');

  // Try to show first interface if any exist
  if (diagnostics.checks.interfaces.success && diagnostics.checks.interfaces.stdout) {
    const firstInterface = diagnostics.checks.interfaces.stdout.split(/\s+/)[0];
    if (firstInterface) {
      diagnostics.checks.firstInterfaceDetails = await runCommand(`wg show ${firstInterface}`);
      diagnostics.checks.firstInterfaceDump = await runCommand(`wg show ${firstInterface} dump`);
    }
  }

  // Check environment variables
  diagnostics.environment = {
    DATA_DIR: process.env.DATA_DIR,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Check if config file exists
  if (process.env.DATA_DIR) {
    diagnostics.checks.configExists = await runCommand(`ls -la ${process.env.DATA_DIR}/wg0.conf`);
  }

  return NextResponse.json(diagnostics);
}
