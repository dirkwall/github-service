import express = require('express');
import { CreateProjectRequest } from '../types/CreateProjectRequest';
import { SourceOperator } from '../services/SourceOperator';
import { GitHubOperator } from '../services/GitHubOperator';

const router = express.Router();

router.post('/', async (request: express.Request, response: express.Response) => {

  const payload : CreateProjectRequest = {
    data : {
      application: 'sockshop16',
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

  const gitHubOrgName = 'keptn-test';

  let gitHub : SourceOperator = GitHubOperator.getInstance();

  await gitHub.createRepository(gitHubOrgName, payload); 

  await gitHub.initialCommit(gitHubOrgName, payload);

  await gitHub.createBranchesForEachStages(gitHubOrgName, payload);

  await gitHub.addShipyardToMaster(gitHubOrgName, payload);

  await gitHub.setHook(gitHubOrgName, payload);

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
