import 'reflect-metadata';
import * as express from 'express';
import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import { cleanUpMetadata } from 'inversify-express-utils';
import { GitHubService } from './GitHubService';
import { CreateProjectModel } from '../controls/CreateProjectModel';

describe('GitHubService', () => {
  let gitHubSvc : GitHubService;
  let request: express.Request;
  let response: express.Response;

  beforeEach(() => {
    cleanUpMetadata();
    request = {} as express.Request;
    response = {} as express.Response;
  });
  it('Should create a project on GitHub', async () => {
    gitHubSvc = await GitHubService.getInstance();
    
    request.body = {
      data : {
        project: 'sockshop54',
        stages: [ 
          {
              name: "dev",
              deployment_strategy: "direct"
          }, {
              name: "staging",
              deployment_strategy: "blue_green_service"
          }, {
              name: "production",
              deployment_strategy: "blue_green_service"
          }
        ]
      }      
    } 

    const payload : CreateProjectModel = request.body;
    const created = await gitHubSvc.createProject(GitHubService.gitHubOrg , payload);
    expect(created).to.be.true;
  }).timeout(10000);

});
