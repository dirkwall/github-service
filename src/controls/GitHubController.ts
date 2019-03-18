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
import { ConfigurationModel } from 'ConfigurationModel';

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

    if (request.body.eventType == 'create.project') {

      console.log('[github-service]: Start project creation.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      await gitHubSvc.createProject(GitHubService.gitHubOrg , cloudEvent.data);

    } else if (request.body.eventType == 'onboard.service') {

      console.log('[github-service]: Start service onboarding.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      console.log(cloudEvent.data);
      await gitHubSvc.onboardService(GitHubService.gitHubOrg, cloudEvent.data);

    } else if (request.body.eventType == 'configure') {

      console.log('[github-service]: Start secret creation.');

      const cloudEvent : CloudEvent = request.body;
      const credSvc: CredentialsService = CredentialsService.getInstance();
      const updated: boolean = await credSvc.updateGithubConfig(cloudEvent.data);

      if (updated) {
        await GitHubService.updateCredentials();
      }

    } else if (request.body.type == 'sh.keptn.events.new-artefact') {

      console.log('[github-service]: Change configuration.');

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      const updated: boolean = await gitHubSvc.updateConfiguration(
        GitHubService.gitHubOrg, cloudEvent.data);

    } else {
      console.log(`[github-service]: This service does not handle the event type ${request.body.eventType}.`);
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
