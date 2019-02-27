import express = require('express');
import { CreateProjectRequest } from '../types/CreateProjectRequest';
import { OnboardServiceRequest } from '../types/OnboardServiceRequest';
import { SourceOperator } from '../services/SourceOperator';
import { GitHubService } from '../services/GitHubService';

const router = express.Router();

router.post('/', async (request: express.Request, response: express.Response) => {

  console.log('DEBUG: in POST / from github-operator. BODY:');
  console.log(request.body);

  const eventtype : string = 'create';

  if (eventtype === 'webhook') {

    // logic to handle a push or pull request event

  } else if (eventtype === 'create') {
    const gitHubOrgName = 'keptn-test';
    const payload : CreateProjectRequest = {
      data : {
        project: 'sockshop99',
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

    console.log('DEBUG: Start project creation.');

    const gitHub : SourceOperator = await GitHubService.getInstance();
    await gitHub.createProject(gitHubOrgName, payload);

  } else if (eventtype === 'onboard') {

    const gitHubOrgName = 'keptn-test';
    const payload : OnboardServiceRequest = {
      data : {
        project: 'sockshop99',
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
