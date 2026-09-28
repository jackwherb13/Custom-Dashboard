import { spawn } from 'node:child_process';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SSH_TARGET = /^[\w.-]+@[\w.-]+$/;
// claude is installed as claude.cmd, which wt.exe can't launch directly; run it through PowerShell.
const SHELL = ['powershell', '-NoExit', '-Command'];
// A trailing backslash would escape the closing quote Node adds around the -d argument.
const trim = (p) => p.replace(/[\\/]+$/, '');

export function resumeCommand(cwd, sessionId) {
  if (!UUID.test(sessionId)) throw new Error('invalid session id');
  return { cmd: 'wt.exe', args: ['-d', trim(cwd), ...SHELL, 'claude', '--resume', sessionId] };
}

export const newSessionCommand = (cwd) => ({ cmd: 'wt.exe', args: ['-d', trim(cwd), ...SHELL, 'claude'] });

export function sshCommand(target) {
  if (!SSH_TARGET.test(target)) throw new Error('invalid ssh target');
  return { cmd: 'wt.exe', args: ['ssh', target] };
}

// explorer.exe opens folders in File Explorer and files with their default app (Word, etc.).
export const openCommand = (target) => ({ cmd: 'explorer.exe', args: [target] });

export function run({ cmd, args }) {
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}
