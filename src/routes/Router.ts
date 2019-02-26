import express = require('express');
import { CreateProjectRequest } from '../types/CreateProjectRequest';
import { OnboardServiceRequest } from '../types/OnboardServiceRequest';
import { SourceOperator } from '../services/SourceOperator';
import { GitHubService } from '../services/GitHubService';
import { EventHandler } from '../services/EventHandler';

const router = express.Router();

router.post('/', async (request: express.Request, response: express.Response) => {

  // TODO: check request body - CloudEvent

  const eventtype : string = 'create';

  if (eventtype === 'webhook') {

    // logic to handle a push or pull request event
    const eventHandler : EventHandler = await GitHubService.getInstance();
    eventHandler.handleEvent('', '');

  } else if (eventtype === 'create') {
    const gitHubOrgName = 'keptn-test';
    const payload : CreateProjectRequest = {
      data : {
        project: 'sockshop18',
        stages: [
          {
            name: 'dev',
            deployment_strategy: 'direct',
          },
          {
            name: 'staging',
            deployment_strategy: 'blue_green_service',
          },
          {
            name: 'production',
            deployment_strategy: 'blue_green_service',
          },
        ],
      },
    };

    const gitHub : SourceOperator = await GitHubService.getInstance();
    await gitHub.createProject(gitHubOrgName, payload);

  } else if (eventtype === 'onboard') {

    const gitHubOrgName = 'keptn-test';
    const payload : OnboardServiceRequest = {
      data : {
        project: 'sockshop17',
        file: '',
      },
    };

    const gitHub : SourceOperator = await GitHubService.getInstance();
    await gitHub.onboardService(gitHubOrgName, payload);

  }

  const result = {
    result: 'success',
  };

  response.send(result);
});

router.get('/', (request: express.Request, response: express.Response) => {

  const result = {
    result: 'success',
  };

  response.send(result);
});

router.delete('/', async (request: express.Request, response: express.Response) => {

  const result = {
    result: 'success',
  };

  response.send(result);
});

export = router;
