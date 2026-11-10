/**
 * Project metadata read from the root package.json at build time, so links such as the
 * GitHub repository are not hard-coded in the UI. A fork only needs to change package.json.
 */
import pkg from '../../../../package.json';

type Repository = string | { url?: string } | undefined;

function repoUrl(repository: Repository): string | undefined {
  const raw = typeof repository === 'string' ? repository : repository?.url;
  if (!raw) return undefined;
  // 'git+https://github.com/x/y.git' → 'https://github.com/x/y'
  return raw.replace(/^git\+/, '').replace(/\.git$/, '');
}

/** Repository web URL, or undefined when package.json has no `repository` field */
export const REPO_URL = repoUrl((pkg as { repository?: Repository }).repository);
