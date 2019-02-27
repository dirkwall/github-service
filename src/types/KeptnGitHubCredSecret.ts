import { GitHubCredentials } from './GitHubCredentials';

export interface KeptnGitHubCredSecret {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  type: string;
  data: GitHubCredentials;
}

interface Metadata {
  name: string;
  namespace: string;
}
