// A local development switch, not authentication. Production is always closed.
export function localExplorerEnabled(env: { NODE_ENV?: string; ENABLE_LOCAL_EXPLORER?: string }) {
  return env.NODE_ENV === 'development' && env.ENABLE_LOCAL_EXPLORER === 'true';
}
