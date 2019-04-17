import 'reflect-metadata';
import * as express from 'express';
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

import { Utils } from '../lib/Utils';

// Util class
const utils = new Utils();

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

    const cloudEvent : CloudEvent = request.body;

    const gitHubSvc : GitHubService = await GitHubService.getInstance();
    const credSvc: CredentialsService = CredentialsService.getInstance();

    if (request.body.eventType == 'create.project' || request.body.type == 'create.project' ) {
      await gitHubSvc.createProject(GitHubService.gitHubOrg , cloudEvent);

    } else if (request.body.eventType == 'onboard.service' || request.body.type == 'onboard.service' ) {
      await gitHubSvc.onboardService(GitHubService.gitHubOrg, cloudEvent);

    } else if (request.body.eventType == 'configure' || request.body.type == 'configure' ) {
      const updated: boolean = await credSvc.updateGithubConfig(cloudEvent);

      if (updated) { await GitHubService.updateCredentials(cloudEvent); }

    } else if (request.body.type == 'sh.keptn.events.new-artefact') {
      await gitHubSvc.updateConfiguration(GitHubService.gitHubOrg, cloudEvent);

    } else {
      if (request.body.shkeptncontext ) {
        utils.logInfoMessage(request.body.shkeptncontext,
          `This service does not handle the event type ${request.body.eventType}.`);
      }
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
