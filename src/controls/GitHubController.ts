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
import { LoggingService } from '../services/LoggingService';

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
    console.log(JSON.stringify(request.body));
    const wsLogger = new LoggingService();
    const delay = (duration) => new Promise(resolve => setTimeout(resolve, duration));
    await delay(5000);
    if (request.body.data.channelInfo !== undefined) {
      console.log("Prop found")
      await wsLogger.connect(request.body.data.channelInfo);
    } else {
      console.log("Prop not found")
    }
    
    if (request.body.eventType == 'create.project') {

      const startMsg = '[github-service]: Start project creation.';
      console.log(startMsg);
      wsLogger.logMessage(startMsg, false);

      const cloudEvent : CloudEvent = request.body;
      const gitHubSvc : GitHubService = await GitHubService.getInstance();
      await gitHubSvc.createProject(GitHubService.gitHubOrg , cloudEvent.data, wsLogger);

      const endMsg = '[github-service]: Project created.'
      console.log(endMsg);
      wsLogger.logMessage(endMsg, true);

    // } else if (request.body.eventType == 'onboard.service') {

    //   console.log('[github-service]: Start service onboarding.');

    //   const cloudEvent : CloudEvent = request.body;
    //   const gitHubSvc : GitHubService = await GitHubService.getInstance();
    //   await gitHubSvc.onboardService(GitHubService.gitHubOrg, cloudEvent.data);

    //   console.log('[github-service]: Service onboarded.');

    // } else if (request.body.eventType == 'configure') {

    //   console.log('[github-service]: Start secret creation.');

    //   const cloudEvent : CloudEvent = request.body;
    //   const credSvc: CredentialsService = CredentialsService.getInstance();
    //   const updated: boolean = await credSvc.updateGithubConfig(cloudEvent.data);

    //   if (updated) {
    //     await GitHubService.updateCredentials();
    //   }

    // } else if (request.body.type == 'sh.keptn.events.new-artefact') {

    //   console.log('[github-service]: Change configuration.');

    //   const cloudEvent : CloudEvent = request.body;
    //   const gitHubSvc : GitHubService = await GitHubService.getInstance();
    //   const updated: boolean = await gitHubSvc.updateConfiguration(
    //     GitHubService.gitHubOrg, cloudEvent.data);

    //   console.log('[github-service]: Configuration changed.');

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
