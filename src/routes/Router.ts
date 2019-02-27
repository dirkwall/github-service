import express = require('express');
import { CreateProjectRequest } from '../types/CreateProjectRequest';
import { OnboardServiceRequest } from '../types/OnboardServiceRequest';
import { SourceOperator } from '../services/SourceOperator';
import { GitHubService } from '../services/GitHubService';

const router = express.Router();

router.post('/', async (request: express.Request, response: express.Response) => {

  console.log('DEBUG: in POST / from github-operator');
  console.log(request.body);

  if (request.body.eventtype === 'webhook') {

    // logic to handle a push or pull request event

  } else if (request.body.eventtype === 'project') {

/*
{
	"eventtype" : "project",
	"data" : {
      "project": "sockshop98",
      "stages": [
        {
            "name": "dev",
            "deployment_strategy": "direct"
        },
        {
            "name": "staging",
            "deployment_strategy": "blue_green_service"
        },
        {
            "name": "production",
            "deployment_strategy": "blue_green_service"
        }
	    ]
   }
}
*/

    const payload : CreateProjectRequest = request.body;
    const gitHub : SourceOperator = await GitHubService.getInstance();
    await gitHub.createProject('keptn-test' , payload);

  } else if (request.body.eventtype === 'service') {

/*
{
	"eventtype" : "service",
	"data" : {
      "project" : "sockshop99",
      "file" : ""
   }
}
*/
    const payload : OnboardServiceRequest = request.body;
    const gitHub : SourceOperator = await GitHubService.getInstance();
    await gitHub.onboardService('keptn-test', payload);

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
