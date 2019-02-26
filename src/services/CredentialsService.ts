import { KeptnGithubCredentials } from '../types/KeptnGithubCredentials';
import { KeptnGithubCredentialsSecret } from '../types/KeptnGithubCredentialsSecret';
import { KeptnConfigSecretFactory } from '../lib/KeptnConfigSecretFactory';
import { K8sClientFactory } from '../lib/K8sClientFactory';

import * as K8sApi from 'kubernetes-client';

import { base64encode, base64decode } from 'nodejs-base64';

export class CredentialsService {

  private static instance: CredentialsService;

  private k8sClient: K8sApi.ApiRoot;
  private constructor() {
    this.k8sClient = new K8sClientFactory().createK8sClient();
  }

  static getInstance() {
    if (CredentialsService.instance === undefined) {
      CredentialsService.instance = new CredentialsService();
    }
    return CredentialsService.instance;
  }

  async updateGithubConfig(keptnConfig: KeptnGithubCredentials) {
    const secret = new KeptnConfigSecretFactory().createKeptnConfigSecret(keptnConfig);

    const created = await this.updateGithubCredentials(secret);
    console.log(created);
  }

  async getGithubCredentials(): Promise<KeptnGithubCredentials> {
    const gitHubCredentials: KeptnGithubCredentials = {
      org: '',
      user: '',
      token: '',
    };

    const secret = await this.k8sClient.api.v1
      .namespaces('keptn').secrets
      .get({ name: 'github-credentials', pretty: true, exact: true, export: true });

    if (secret.body.items && secret.body.items.length > 0) {
      const ghItem = secret.body.items.find(item => item.metadata.name === 'github-credentials');
      if (ghItem && ghItem.data !== undefined) {
        gitHubCredentials.org = base64decode(ghItem.data.gitorg);
        gitHubCredentials.user = base64decode(ghItem.data.gituser);
        gitHubCredentials.token = base64decode(ghItem.data.gittoken);
      }
    }

    return gitHubCredentials;
  }

  private async updateGithubCredentials(secret: KeptnGithubCredentialsSecret) {
    try {
      const deleteResult = await this.k8sClient.api.v1
        .namespaces('keptn').secrets('github-credentials').delete();
      console.log(deleteResult);
    } catch (e) {
      console.log('Can not delete credentials');
    }

    const created = await this.k8sClient.api.v1.namespaces('keptn').secrets.post({
      body: secret,
    });

    return created;
  }
}