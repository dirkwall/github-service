import { CredentialsModel } from '../types/CredentialsModel';
import { CredentialsSecret } from '../types/CredentialsSecret';
import { KeptnConfigSecretFactory } from '../lib/KeptnConfigSecretFactory';
import { K8sClientFactory } from '../lib/K8sClientFactory';
const YAML = require('yamljs');

import * as K8sApi from 'kubernetes-client';

import { base64decode } from 'nodejs-base64';
import { REPL_MODE_SLOPPY } from 'repl';

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

  async addRegistryEntry(registry: string, project: string) : Promise<boolean> {
    let updated: boolean = false;

    const configMap = await this.k8sClient.api.v1
      .namespaces('keptn').configmap
      .get({ name: 'keptn-orgs', pretty: true, exact: true, export: true });

    const body = configMap.body;

    for (let j = 0; j < configMap.body.items.length; j = j + 1) {
      if (body.items[j].data.orgsToRepos) {
        const mapping = JSON.parse(body.items[j].data.orgsToRepos);
        mapping[registry] = project;

        await this.k8sClient.api.v1.namespaces('keptn').configmaps('keptn-orgs').delete();

        const orgsToRepos = {
          orgsToRepos: JSON.stringify(mapping),
        };

        const conf = {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: 'keptn-orgs',
            namespace: 'keptn',
          },
          data: orgsToRepos,
        };

        const result = await this.k8sClient.api.v1.namespaces('keptn')
          .configmap.post({ body: conf });
        if (result.statusCode === 201) {
          updated = true;
        }
      }
    }

    return updated;
  }

  async updateGithubConfig(gitCreds: CredentialsModel): Promise<boolean> {
    let updated: boolean = false;
    
    console.log('[github-service]: Start secret creation.');

    if (gitCreds !== undefined && gitCreds.org && gitCreds.token && gitCreds.user) {
      const secret = new KeptnConfigSecretFactory().createKeptnConfigSecret(gitCreds);
      const updatedSecret: CredentialsSecret = await this.updateGithubCredentials(secret);
      if (updatedSecret !== undefined) {
        updated = true;
        console.log('[github-service]: Secret created.');
      }
    } else {
      console.log('[github-service]: Org, token or user not set.');
    }
    return updated;
  }

  async getKeptnApiToken(): Promise<string> {
    let token;
    const secret = await this.k8sClient.api.v1
      .namespaces('keptn').secrets
      .get({ name: 'keptn-api-token', pretty: true, exact: true, export: true });

    if (secret.body.items && secret.body.items.length > 0) {
      const apiToken = secret.body.items.find(item => item.metadata.name === 'keptn-api-token');
      if (apiToken && apiToken.data !== undefined) {
        token = base64decode(apiToken.data['keptn-api-token']);
      } else {
        console.log('[github-service]: The secret does not contain the proper information.');
      }
    }

    return token;
  }

  async getGithubCredentials(): Promise<CredentialsModel> {
    const gitHubCredentials: CredentialsModel = new CredentialsModel();

    const secret = await this.k8sClient.api.v1
      .namespaces('keptn').secrets
      .get({ name: 'github-credentials', pretty: true, exact: true, export: true });

    if (secret.body.items && secret.body.items.length > 0) {
      const ghItem = secret.body.items.find(item => item.metadata.name === 'github-credentials');
      if (ghItem && ghItem.data !== undefined) {
        gitHubCredentials.org = base64decode(ghItem.data.org);
        gitHubCredentials.user = base64decode(ghItem.data.user);
        gitHubCredentials.token = base64decode(ghItem.data.token);
      } else {
        console.log('[github-service]: The secret does not contain the proper information.');
      }
    }

    return gitHubCredentials;
  }

  private async updateGithubCredentials(secret: CredentialsSecret): Promise<CredentialsSecret> {
    let createdSecret: CredentialsSecret = undefined;
    if (secret !== undefined) {
      try {
        const deleteResult = await this.k8sClient.api.v1
          .namespaces('keptn').secrets('github-credentials').delete();
      } catch (e) {
        console.log('[github-service]: Can not delete credentials.');
        console.log(e.message);
      }
      createdSecret = await this.k8sClient.api.v1.namespaces('keptn').secret.post({ body: secret });
    }
    return createdSecret;
  }
}
