import { CredentialsModel } from '../types/CredentialsModel';
import { CredentialsSecret } from '../types/CredentialsSecret';

import base64url from "base64url";

export class KeptnConfigSecretFactory {

  constructor() { }

  createKeptnConfigSecret(creds: CredentialsModel): CredentialsSecret {
    creds.token = base64url(creds.token);
    creds.user = base64url(creds.user);
    creds.org = base64url(creds.org);

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
