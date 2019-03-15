import { CredentialsModel } from '../types/CredentialsModel';
import { CredentialsSecret } from '../types/CredentialsSecret';

import base64url from "base64url";

export class KeptnConfigSecretFactory {

  constructor() { }

  createKeptnConfigSecret(creds: CredentialsModel): CredentialsSecret {
    creds.token = '8e00b553b0f97156590beae9e5c4812b908c5e5a'; //base64url(creds.token);
    creds.user = 'johannes-b'; //base64url(creds.user);
    creds.org = 'keptn-tiger';// base64url(creds.org);

    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      type: 'Opaque',
      stringData: creds,
      metadata: {
        name: 'github-credentials',
        namespace: 'keptn',
      },
    };

    return secret;
  }
}