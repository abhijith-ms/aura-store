// Pure parsing helpers for XDG .desktop files — no filesystem/process access,
// so this module can be unit-tested without a live Arch system.

export function stripFieldCodes(execStr) {
  return execStr.replace(/%[fFuUidDnNickvm]/g, '').replace(/\s+/g, ' ').trim();
}

export function parseDesktopFile(content, filename) {
  const isTerminal = /^Terminal\s*=\s*true/im.test(content);
  const isNoDisplay = /^NoDisplay\s*=\s*true/im.test(content);
  const isGui = !isTerminal && !isNoDisplay;

  const nameMatch = content.match(/^Name\s*=\s*(.+)$/m);
  const execMatch = content.match(/^Exec\s*=\s*(.+)$/m);
  const baseKey = filename.replace(/\.desktop$/, '').toLowerCase();

  const actionsMatch = content.match(/^Actions\s*=\s*(.+)$/m);
  const actionIds = actionsMatch
    ? actionsMatch[1].split(';').map((s) => s.trim()).filter(Boolean)
    : [];

  const actions = actionIds.map((id) => {
    const sectionRegex = new RegExp(`\\[Desktop Action ${id}\\]([\\s\\S]*?)(?=\\n\\[|$)`);
    const sectionMatch = content.match(sectionRegex);
    const section = sectionMatch ? sectionMatch[1] : '';
    const actionNameMatch = section.match(/^Name\s*=\s*(.+)$/m);
    const actionExecMatch = section.match(/^Exec\s*=\s*(.+)$/m);
    return {
      id,
      name: actionNameMatch ? actionNameMatch[1].trim() : id,
      exec: actionExecMatch ? actionExecMatch[1].trim() : '',
    };
  });

  return {
    filename,
    name: nameMatch ? nameMatch[1].trim() : baseKey,
    exec: execMatch ? execMatch[1].trim().split(' ')[0] : baseKey,
    isGui,
    actions,
  };
}
