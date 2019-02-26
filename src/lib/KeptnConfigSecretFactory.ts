import { KeptnGithubCredentials } from '../types/KeptnGithubCredentials';
import { KeptnGithubCredentialsSecret } from '../types/KeptnGithubCredentialsSecret';

import { base64encode } from 'nodejs-base64';

export class KeptnConfigSecretFactory {

  constructor() { }

  createKeptnConfigSecret(creds: KeptnGithubCredentials): KeptnGithubCredentialsSecret {
    creds.token = base64encode(creds.token);
    creds.user = base64encode(creds.user);
    creds.org = base64encode(creds.org);

    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      type: 'Opaque',
      data: creds,
      metadata: {
        name: 'github-credentials',
        namespace: 'keptn',
      },
    };

    return secret;
  }
}
