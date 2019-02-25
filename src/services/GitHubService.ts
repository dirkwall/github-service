import { SourceOperator } from './SourceOperator';
import { CreateProjectRequest } from '../types/CreateProjectRequest';
import { Utils } from '../lib/utils';
import { EventHandler } from './EventHandler';
import { OnboardServiceRequest } from 'OnboardServiceRequest';

const GitHub = require('github-api');
const Mustache = require('mustache');
const YAML = require('yamljs');

// Util class
const utils = new Utils();

// Basic authentication
const gh = new GitHub({
  username: '**',
  password: '**',
  auth: 'basic',
});

export class GitHubService implements SourceOperator, EventHandler {

  private static instance: GitHubService;

  private constructor() {
  }

  static getInstance() {
    if (GitHubService.instance === undefined) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  handleEvent(gitHubOrgName : string, payload : string) {
    console.log(payload);

    if (payload === undefined) {
      //response.writeHeader(500); response.end();
      return;
    }

    //switch (githubEvent) {
    //  case 'push': handlePush(githubEventPayload, response); break;
    //  case 'pull_request': handlePullRequest(githubEventPayload, response); break;
    //  default: response.writeHeader(200); response.end();
    //}
  }

  /*
  function scanGithubBranchSourceProject(appName) {
    return new Promise(resolve => {
      jenkins.job.build({ name: `acmfabric/${appName}`, parameters: { } }, function(err) {
        if (err) console.log(err);
        resolve();
      });
    });  
  }

  function handlePullRequest(githubEventPayload, response) {
    console.log(`Github event action: ${githubEventPayload.action}`);
    var githubOrg = githubEventPayload.organization.login;

    // check if PR has been closed and merged
    if (githubEventPayload.pull_request &&
        githubEventPayload.pull_request.merged === true &&
        'closed' === githubEventPayload.action)
    {
      console.log(`Github event pull request: ${JSON.stringify(githubEventPayload.pull_request)}`);
      if (githubEventPayload.pull_request.merged === true) {
        console.log(`Starting job for ${githubEventPayload.repository.name}`);
        configChange(githubEventPayload.repository.name, `pr-${githubEventPayload.number}`, 'dev', githubOrg).then(() => {
          response.writeHeader(200); response.end();
          return;
        });
      }
    } else if (githubEventPayload.pull_request &&
      'opened' === githubEventPayload.action)
    {
      scanGithubBranchSourceProject(githubEventPayload.repository.name).then(() => {
        response.writeHeader(200); response.end();
        return;
      });
    } else {
      response.writeHeader(200); response.end();
      return;
    }
  }

  function handlePush(githubEventPayload, response) {
    const refSplit = githubEventPayload.ref.split('/');
    const environment = refSplit[refSplit.length - 1];
    const commitMessage = githubEventPayload.head_commit.message;
    const githubOrg = githubEventPayload.repository.owner.name;

    if (commitMessage.includes('[CI-UPDATECONFIG]')) {
      const commitMessageSplit = commitMessage.split(':');
      const appName = commitMessageSplit[commitMessageSplit.length - 1].trim();

      if (appName !== undefined && environment !== undefined) {
        applyConfig(environment, appName, githubOrg).then(() => {
          response.status(200).send('OK');
          return;
        });
      }
    }

    response.writeHeader(200); response.end();
    return;
  }
  */

  async createProject(gitHubOrgName : string, payload : CreateProjectRequest) : Promise<any> {
    await this.createRepository(gitHubOrgName, payload);
    await this.initialCommit(gitHubOrgName, payload);
    await this.createBranchesForEachStages(gitHubOrgName, payload);
    await this.addShipyardToMaster(gitHubOrgName, payload);
    await this.setHook(gitHubOrgName, payload);
  }

  private async createRepository(gitHubOrgName : string,
                                 payload : CreateProjectRequest) : Promise<any> {
    const repository = {
      name : payload.data.project,
    };

    try {
      const organization = await gh.getOrganization(gitHubOrgName);
      await organization.createRepo(repository);
    } catch (e) {
      if (e.response.statusText == 'Not Found') {
        console.log(`[keptn] Could not find organziation ${gitHubOrgName}.`);
        console.log(e.message);
      } else if (e.response.statusText == 'Unprocessable Entity'){
        console.log(`[keptn] Repository ${payload.data.project} already available.`);
        console.log(e.message);
      }
    }
  }

  private async setHook(gitHubOrgName : string, payload : CreateProjectRequest) : Promise<any> {
    try {
      const repo = await gh.getRepo(gitHubOrgName, payload.data.project);

      //const istioIngressGatewayService = await utils.getK8sServiceUrl('istio-ingressgateway', 'istio-system');
      //const eventBrokerUri = `event-broker.keptn.${istioIngressGatewayService.ip}.xip.io`;
      const eventBrokerUri = 'need-to-be-set';

      await repo.createHook({
        name: 'web',
        events: ['push'],
        config: {
          url: `http://${eventBrokerUri}/github`,
          content_type: 'json',
        },
      });
      console.log(`Webhook created: http://${eventBrokerUri}/github`);
    } catch (e) {
      console.log('Setting hook failed.');
      console.log(e.message);
    }
  }

  private async initialCommit(gitHubOrgName : string,
                              payload : CreateProjectRequest) : Promise<any> {
    try {
      const repo = await gh.getRepo(gitHubOrgName, payload.data.project);

      await repo.writeFile('master',
                           'README.md',
                           `# keptn takes care of your ${payload.data.project}`,
                           '[keptn]: Initial commit', { encode: true });
    } catch (e) {
      console.log('[keptn] Initial commit failed.');
      console.log(e.message);
    }
  }

  private async createBranchesForEachStages(gitHubOrgName : string,
                                            payload : CreateProjectRequest) : Promise<any> {
    try {
      const repo = await gh.getRepo(gitHubOrgName, payload.data.project);

      payload.data.stages.forEach(async stage => {
        await repo.createBranch('master', stage.name);

        const helmChart = await utils.readFileContent(
          'keptn/github-operator/templates/helm-chart/Chart.yml');

        await repo.writeFile(stage.name,
                             'helm-chart/Chart.yml',
                             YAML.stringify(helmChart),
                             '[keptn]: Added helm-chart Chart.yml file.',
                             { encode: true });

        await repo.writeFile(stage.name,
                             'helm-chart/values.yml',
                             '',
                             '[keptn]: Added helm-chart values.yml file.',
                             { encode: true });

        if (stage.deployment_strategy === 'blue_green_service') {
          // Add istio gateway to stage
          let gatewaySpec = await utils.readFileContent(
            'keptn/github-operator/templates/istio-manifests/gateway.tpl');
          gatewaySpec = Mustache.render(gatewaySpec,
                                        { 
                                          application: payload.data.project,
                                          stage: stage.name });

          await repo.writeFile(stage.name,
                               'helm-chart/templates/istio-gateway.yaml',
                               gatewaySpec,
                               '[keptn]: Added istio gateway.',
                               { encode: true });
        }
      });
    } catch (e) {
      console.log('[keptn] Creating branches failed.');
      console.log(e.message);
    }
  }

  private async addShipyardToMaster(gitHubOrgName : string,
                                    payload : CreateProjectRequest) : Promise<any> {
    try {
      const repo = await gh.getRepo(gitHubOrgName, payload.data.project);
      await repo.writeFile('master',
                           'shipyard.yml',
                           YAML.stringify(payload.data),
                           '[keptn]: Added shipyard containing the definition of each stage',
                           { encode: true });
    } catch (e) {
      console.log('[keptn] Adding shipyard to master failed.');
      console.log(e.message);
    }
  }

  async onboardService(gitHubOrgName : string, payload : OnboardServiceRequest) : Promise<any> {
    

  }
}
