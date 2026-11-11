const gitHash = typeof __APP_GIT_HASH__ === 'string' ? __APP_GIT_HASH__ : '';
const modified = typeof __APP_GIT_MODIFIED__ === 'boolean' && __APP_GIT_MODIFIED__;

export const APP_VERSION = gitHash
  ? `${gitHash.slice(0, 12)}${modified ? ' (modified)' : ''}`
  : 'Unknown build';
