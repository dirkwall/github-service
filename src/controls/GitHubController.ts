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

      console.log('[git-service]: Start project creation.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      await gitHubSvc.createProject(GitHubService.gitHubOrg , cloudEvent.data);

      console.log('[git-service]: Project created.');

    } else if (request.body.eventType == 'onboard.service') {

      console.log('[git-service]: Start service onboarding.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      await gitHubSvc.onboardService(GitHubService.gitHubOrg, cloudEvent.data);

      console.log('[git-service]: Service onboarded.');

    } else if (request.body.eventType == 'configure') {

      console.log('[git-service]: Start secret creation.');

      const cloudEvent : CloudEvent = request.body;
      const credSvc: CredentialsService = CredentialsService.getInstance();
      //await credSvc.updateGithubConfig(cloudEvent.data);

      console.log('[git-service]: Secret created.');

    } else if (request.body.eventType == 'sh.keptn.events.new-artefact') {

      console.log('[git-service]: Change configuration.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      await gitHubSvc.updateConfiguration(GitHubService.gitHubOrg, cloudEvent.data);

      console.log('[git-service]: Configuration changed.');

    } else {
      console.log(`[git-service]: This service does not handle the event type ${request.body.eventType}.`);
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
