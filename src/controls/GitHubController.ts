import 'reflect-metadata';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
  httpDelete,
  interfaces,
} from 'inversify-express-utils';
import {
  ApiOperationGet,
  ApiOperationPost,
  ApiOperationDelete,
  ApiPath,
  SwaggerDefinitionConstant,
} from 'swagger-express-ts';

import { GitHubService } from '../services/GitHubService';
import { CredentialsService } from '../services/CredentialsService';

import { CloudEvent } from 'cloudevent';

@ApiPath({
  name: 'GitHub',
  path: '/',
  security: { apiKeyHeader: [] },
})
@controller('/')
export class GitHubController implements interfaces.Controller {

  constructor() { }

  @ApiOperationPost({
    description: 'Handle channel events',
    parameters: {
      body: {
        description: 'Handle channel events',
        model: '',
        required: true,
      },
    },
    responses: {
      200: {
      },
    },
    summary: 'Handle channel events',
  })
  @httpPost('/')
  public async handleEvent(
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ): Promise<void> {

    console.log(request.body);

    if (request.body.eventType == 'create.project') {

      console.log('DEBUG: start project creation.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      await gitHubSvc.createProject(GitHubService.gitHubOrg , cloudEvent.data);

    } else if (request.body.eventType == 'onboard.service') {

      console.log('DEBUG: start service creation.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      await gitHubSvc.onboardService(GitHubService.gitHubOrg, cloudEvent.data);

    } else if (request.body.eventType == 'configure') {

      console.log('DEBUG: create secret.');

      const cloudEvent : CloudEvent = request.body;
      const credSvc: CredentialsService = CredentialsService.getInstance();
      //await credSvc.updateGithubConfig(cloudEvent.data);
    }

    const result = {
      result: 'success',
    };

    response.send(result);
  }

  @ApiOperationDelete({
    description: 'Delete elements',
    parameters: {
    },
    responses: {
      200: {
      },
    },
    summary: 'Delete elements',
  })
  @httpDelete('/')
  public async deleteElement(
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
 
    if (request.body.eventType === 'project') {
  
      const cloudEvent : CloudEvent = request.body;
      const gitHub : GitHubService = await GitHubService.getInstance();
      await gitHub.deleteProject(GitHubService.gitHubOrg , cloudEvent);
  
    } 
  
    const result = {
      result: 'success',
    };
  
    response.send(result);
  }

}
