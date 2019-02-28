import { GitHubCredentials } from '../types/GitHubCredentials';
import { KeptnGitHubCredSecret } from '../types/KeptnGitHubCredSecret';
import { KeptnConfigSecretFactory } from '../lib/KeptnConfigSecretFactory';
import { K8sClientFactory } from '../lib/K8sClientFactory';

import * as K8sApi from 'kubernetes-client';

import { base64decode } from 'nodejs-base64';

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

  async updateGithubConfig(gitCreds: GitHubCredentials) {
    if(gitCreds != undefined && gitCreds.areCredentialsDefined()) {
      const secret = new KeptnConfigSecretFactory().createKeptnConfigSecret(gitCreds);
      const created = await this.updateGithubCredentials(secret);
      console.log(created);
    }
  }

  async getGithubCredentials(): Promise<GitHubCredentials> {
    const gitHubCredentials: GitHubCredentials = new GitHubCredentials();

    const secret = await this.k8sClient.api.v1
      .namespaces('keptn').secrets
      .get({ name: 'github-credentials', pretty: true, exact: true, export: true });

    if (secret.body.items && secret.body.items.length > 0) {
      const ghItem = secret.body.items.find(item => item.metadata.name === 'github-credentials');
      if (ghItem && ghItem.data !== undefined) {
        gitHubCredentials.org = base64decode(ghItem.data.gitorg);
        gitHubCredentials.user = base64decode(ghItem.data.gituser);
        gitHubCredentials.token = base64decode(ghItem.data.gittoken);
      } else {
        console.log('[keptn] The secret does not contain the proper information.');
      }
    }

    return gitHubCredentials;
  }

  private async updateGithubCredentials(secret: KeptnGitHubCredSecret) {
    if(secret != undefined) {
      try {
        const deleteResult = await this.k8sClient.api.v1
          .namespaces('keptn').secrets('github-credentials').delete();
      } catch (e) {
        console.log('Can not delete credentials');
      }
  
      const created = await this.k8sClient.api.v1.namespaces('keptn').secrets.post({
        body: secret,
      });
    }
  }
}
