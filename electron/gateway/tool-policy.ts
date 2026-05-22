// Tools that can mutate the local machine. Stripped from externally-triggered
// gateway runs unless the gateway explicitly opts in (allowDangerousTools).
const DANGEROUS_TOOLS = new Set(['exec_shell', 'write_file']);

/**
 * Build the tool allow-predicate for a gateway run. When dangerous tools are
 * not allowed, exec_shell / write_file are hidden from the model entirely so a
 * remote IM user cannot drive the local shell or filesystem.
 */
export function gatewayToolFilter(allowDangerous: boolean | undefined): (name: string) => boolean {
  if (allowDangerous) return () => true;
  return (name: string) => !DANGEROUS_TOOLS.has(name);
}
