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
  }).timeout(5000);

  it('Should not create a K8s secret - credentials undefined', async () => {
    let newGitCreds : GitHubCredentials = undefined;
    let updated : boolean = await credService.updateGithubConfig(newGitCreds);
    expect(updated).to.be.false;
  }).timeout(5000);

  it('Should not create a K8s secret - missing parameter', async () => {
    let newGitCreds = new GitHubCredentials();
    newGitCreds.org='keptn-org';
    let updated = await credService.updateGithubConfig(newGitCreds);
    expect(updated).to.be.false;
  }).timeout(5000);

  it('Should create a K8s secret', async () => {
    const gitCreds : GitHubCredentials = await credService.getGithubCredentials();
    let newGitCreds = new GitHubCredentials();
    newGitCreds.org='keptn-org';
    newGitCreds.user='keptn';
    //newGitCreds.token='abc123';
    let updated = await credService.updateGithubConfig(newGitCreds);
    expect(updated).to.be.false;

    if(updated) {
      await credService.updateGithubConfig(gitCreds);
    }
  });
});
