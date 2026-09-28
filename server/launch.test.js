import { describe, it, expect } from 'vitest';
import { resumeCommand, newSessionCommand, sshCommand, openCommand } from './launch.js';

const ID = '66f4709a-29eb-470d-ad3a-19a1b0db5b72';

describe('launch commands', () => {
  it('resumes a session in Windows Terminal at its cwd', () => {
    expect(resumeCommand('C:\\Code\\App\\', ID)).toEqual({
      cmd: 'wt.exe',
      args: ['-d', 'C:\\Code\\App', 'powershell', '-NoExit', '-Command', 'claude', '--resume', ID],
    });
  });

  it('rejects session ids that are not UUIDs', () => {
    expect(() => resumeCommand('C:\\x', 'abc; calc')).toThrow();
  });

  it('starts a new session', () => {
    expect(newSessionCommand('C:\\x').args).toEqual(['-d', 'C:\\x', 'powershell', '-NoExit', '-Command', 'claude']);
  });

  it('opens ssh only for plain user@host targets', () => {
    expect(sshCommand('me@zeus.example.edu')).toEqual({ cmd: 'wt.exe', args: ['ssh', 'me@zeus.example.edu'] });
    expect(() => sshCommand('-oProxyCommand=calc host')).toThrow();
  });

  it('opens files and folders with explorer', () => {
    expect(openCommand('C:\\docs\\a.docx')).toEqual({ cmd: 'explorer.exe', args: ['C:\\docs\\a.docx'] });
  });
});
