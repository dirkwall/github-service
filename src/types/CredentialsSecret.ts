import { CredentialsModel } from './CredentialsModel';

export interface CredentialsSecret {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  type: string;
  data: CredentialsModel;
}

interface Metadata {
  name: string;
  namespace: string;
}
