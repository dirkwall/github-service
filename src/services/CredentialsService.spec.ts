import 'reflect-metadata';
import * as express from 'express';
import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import { cleanUpMetadata } from 'inversify-express-utils';
import { CredentialsService } from './CredentialsService';
import { CredentialsModel } from '../types/CredentialsModel';

describe('CredentialsService', () => {
  let credService: CredentialsService;

  beforeEach(() => {
    cleanUpMetadata();
    credService = CredentialsService.getInstance();
  });

  it('Should return the credentials from a K8s secret', async () => {
    const gitCreds : CredentialsModel = await credService.getGithubCredentials();
    expect(gitCreds.org).to.be.a('string');
    expect(gitCreds.user).to.be.a('string');
    expect(gitCreds.token).to.be.a('string');
  }).timeout(5000);

  it('Should not create a K8s secret - credentials undefined', async () => {
    const newGitCreds : CredentialsModel = undefined;
    const updated : boolean = await credService.updateGithubConfig(newGitCreds);
    expect(updated).to.be.false;
  }).timeout(5000);

  it('Should not create a K8s secret - missing parameter', async () => {
    const newGitCreds = new CredentialsModel();
    newGitCreds.org = 'keptn-org';
    const updated = await credService.updateGithubConfig(newGitCreds);
    expect(updated).to.be.false;
  }).timeout(5000);

  it('Should create a K8s secret', async () => {
    const gitCreds : CredentialsModel = await credService.getGithubCredentials();
    const newGitCreds = new CredentialsModel();
    newGitCreds.org = 'keptn-org';
    newGitCreds.user = 'keptn';
    //newGitCreds.token='abc123';
    const updated = await credService.updateGithubConfig(newGitCreds);
    expect(updated).to.be.false;

    if (updated) {
      await credService.updateGithubConfig(gitCreds);
    }
  });
});
