import 'reflect-metadata';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
  interfaces,
} from 'inversify-express-utils';
import {
  ApiOperationGet,
  ApiOperationPost,
  ApiPath,
  SwaggerDefinitionConstant,
} from 'swagger-express-ts';

import { CreateProjectModel } from './CreateProjectModel';
import { OnboardServiceModel } from './OnboardServiceModel';
import { GitHubService } from '../services/GitHubService';

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
    console.log('DEBUG: in POST / from github-operator');
    console.log(request.body);
  
    if (request.body.eventType === 'webhook') {
  
      // logic to handle a push or pull request event
  
    } else if (request.body.eventType === 'project') {
  
      const payload : CreateProjectModel = request.body;
      const gitHub : GitHubService = await GitHubService.getInstance();
      await gitHub.createProject(GitHubService.gitHubOrg , payload);
  
    } else if (request.body.eventType === 'service') {
  
      const payload : OnboardServiceModel = request.body;
      const gitHub : GitHubService = await GitHubService.getInstance();
      await gitHub.onboardService(GitHubService.gitHubOrg, payload);
  
    }
  
    const result = {
      result: 'success',
    };
  
    response.send(result);
  }

}

