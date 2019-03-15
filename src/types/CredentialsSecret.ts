import { CredentialsModel } from './CredentialsModel';

export interface CredentialsSecret {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  type: string;
  stringData: CredentialsModel;
}

interface Metadata {
  name: string;
  namespace: string;
}
