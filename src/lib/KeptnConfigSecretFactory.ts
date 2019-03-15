import { CredentialsModel } from '../types/CredentialsModel';
import { CredentialsSecret } from '../types/CredentialsSecret';

import base64url from "base64url";

export class KeptnConfigSecretFactory {

  constructor() { }

  createKeptnConfigSecret(creds: CredentialsModel): CredentialsSecret {
    creds.token = "OGUwMGI1NTNiMGY5NzE1NjU5MGJlYWU5ZTVjNDgxMmI5MDhjNWU1YQo="; //base64url(creds.token);
    creds.user = "am9oYW5uZXMtYg=="; //base64url(creds.user);
    creds.org = "a2VwdG4tdGlnZXI=";// base64url(creds.org);

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
