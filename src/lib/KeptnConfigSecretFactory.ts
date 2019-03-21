import { CredentialsModel } from '../types/CredentialsModel';
import { CredentialsSecret } from '../types/CredentialsSecret';
import { base64encode } from 'nodejs-base64';

export class KeptnConfigSecretFactory {

  constructor() { }

  createKeptnConfigSecret(creds: CredentialsModel): CredentialsSecret {
    const secretInput : CredentialsModel = {} as CredentialsModel

    secretInput.token = base64encode(creds.token);
    secretInput.user = base64encode(creds.user);
    secretInput.org = base64encode(creds.org);

    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      type: 'Opaque',
      data: secretInput,
      metadata: {
        name: 'github-credentials',
        namespace: 'keptn',
      },
    };

    return secret;
  }
}
