import 'reflect-metadata';
import * as express from 'express';
import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import { cleanUpMetadata } from 'inversify-express-utils';
import { CredentialsService } from './CredentialsService';
import { GitHubCredentials } from '../types/GitHubCredentials';

describe('CredentialsService', () => {
  let credService: CredentialsService;
  beforeEach(() => {
    cleanUpMetadata();
    credService = CredentialsService.getInstance();
  });
  it('Should return the credentials from a K8s secret', async () => {
    const gitCreds : GitHubCredentials = await credService.getGithubCredentials();
    expect(gitCreds.org).to.be.a('string');
    expect(gitCreds.user).to.be.a('string');
    expect(gitCreds.token).to.be.a('string');
  });
  it('Should update a K8s secret', async () => {
    const gitCreds : GitHubCredentials = await credService.getGithubCredentials();

    let newGitCreds : GitHubCredentials = undefined;
    await credService.updateGithubConfig(newGitCreds);

    newGitCreds = new GitHubCredentials();
    newGitCreds.org='keptn-org';
    credService.updateGithubConfig(newGitCreds);

    newGitCreds.user='keptn';
    newGitCreds.user='abc123';
    let updated : boolean = await credService.updateGithubConfig(newGitCreds);

    if(updated) {
      await credService.updateGithubConfig(gitCreds);
    }
  });
});
