import { SourceOperator } from './SourceOperator';
import { EventHandler } from './EventHandler';
import { CredentialsService } from './CredentialsService';

import { CreateProjectRequest, Stage } from '../types/CreateProjectRequest';
import { KeptnGithubCredentials } from '../types/KeptnGithubCredentials';
import { OnboardServiceRequest } from '../types/OnboardServiceRequest';

import { Utils } from '../lib/utils';
import { base64encode, base64decode } from 'nodejs-base64';

const decamelize = require('decamelize');
const GitHub = require('github-api');
const Mustache = require('mustache');
const YAML = require('yamljs');

// Util class
const utils = new Utils();

// Basic authentication
let gh;

export class GitHubService implements SourceOperator, EventHandler {

  private static instance: GitHubService;

  private gitHubOrg: string;

  private constructor() {
  }

  static async getInstance() {
    if (GitHubService.instance === undefined) {
      GitHubService.instance = new GitHubService();

      // Initialize github api with user and token
      const credService: CredentialsService = CredentialsService.getInstance();
      //const githubCreds: KeptnGithubCredentials = await credService.getGithubCredentials();
      //gh.username = githubCreds.user;
      //gh.password = githubCreds.token;
      //GitHubService.instance.gitHubOrg = githubCreds.org;

      gh = new GitHub({
        username: '**',
        password: '**',
        auth: 'basic',
      });
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
    const created: boolean = await this.createRepository(gitHubOrgName, payload);
    if (created) {
      await this.initialCommit(gitHubOrgName, payload);
      await this.createBranchesForEachStages(gitHubOrgName, payload);
      await this.addShipyardToMaster(gitHubOrgName, payload);
      await this.setHook(gitHubOrgName, payload);
    }
  }

  private async createRepository(gitHubOrgName : string,
                                 payload : CreateProjectRequest) : Promise<boolean> {
    const repository = {
      name : payload.data.project,
    };

    try {
      const org = await gh.getOrganization(gitHubOrgName);
      await org.createRepo(repository);
    } catch (e) {
      if (e.response.statusText === 'Not Found') {
        console.log(`[keptn] Could not find organziation ${gitHubOrgName}.`);
        console.log(e.message);
      } else if (e.response.statusText === 'Unprocessable Entity'){
        console.log(`[keptn] Repository ${payload.data.project} already available.`);
        console.log(e.message);
      }
      return false;
    }
    return true;
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
      const chart = {
        apiVersion: 'v1',
        description: 'A Helm chart for Kubernetes',
        name: 'mean-k8s',
        version: '0.1.0'
      };

      const repo = await gh.getRepo(gitHubOrgName, payload.data.project);

      payload.data.stages.forEach(async stage => {
        await repo.createBranch('master', stage.name);

        await repo.writeFile(stage.name,
                             'helm-chart/Chart.yml',
                             YAML.stringify(chart),
                             '[keptn]: Added helm-chart Chart.yml file.',
                             { encode: true });

        await repo.writeFile(stage.name,
                             'helm-chart/values.yml',
                             '',
                             '[keptn]: Added helm-chart values.yml file.',
                             { encode: true });

        if (stage.deployment_strategy === 'blue_green_service') {
          // add istio gateway to stage
          let gatewaySpec = await utils.readFileContent(
            'keptn/github-operator/templates/istio-manifests/gateway.tpl');
          gatewaySpec = Mustache.render(gatewaySpec, { application: payload.data.project, stage: stage.name });

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
    try {
      const repo = await gh.getRepo(gitHubOrgName, payload.data.project);

      const shipyardYaml = await repo.getContents('master', 'shipyard.yml');
      const shipyardlObj = YAML.parse(base64decode(shipyardYaml.data.content));

      const serviceName = 'test1'; // get service name from payload

      shipyardlObj.stages.forEach(async stage => {

        const valuesYaml = await repo.getContents(stage.name, `helm-chart/values.yml`);
        let valuesObj = YAML.parse(base64decode(valuesYaml.data.content));
        if (valuesObj == null) { valuesObj = {}; }

        const chartYaml = await repo.getContents(stage.name, 'helm-chart/Chart.yml');
        const chartObj = YAML.parse(base64decode(chartYaml.data.content));
        const chartName = chartObj.name;

        // microservice already defined in helm chart
        if (valuesObj[serviceName] !== undefined) {
          console.log('[keptn] Service already available in this stage.')
        } else {
          await this.addArtifactsToBranch(repo, serviceName, stage, valuesObj);
        }

      });

    } catch (e) {
      console.log('[keptn] Onboarding service failed.');
      console.log(e.message);
    }
  }

  private async addArtifactsToBranch(repo: any, serviceName: string, stage: Stage, valuesObj: any) {
    let valuesTpl = await utils.readFileContent('keptn/github-operator/templates/service-template/values.tpl');
    const valuesStr = Mustache.render(valuesTpl, { serviceName: serviceName });

    // update values file
    valuesObj[serviceName] = YAML.parse(valuesStr);
    await repo.writeFile(stage.name, 'helm-chart/values.yml', YAML.stringify(valuesObj, 100), `[keptn]: Added entry for new app in values.yaml`, { encode: true });

    // add deployment and service template
    await this.addDeploymentServiceTemplates(repo, serviceName, stage.name);

    if (stage.deployment_strategy === 'blue_green_service') {
      const blueGreenValues = {};

      // update values file
      blueGreenValues[`${serviceName}Blue`] = YAML.parse(valuesStr);
      blueGreenValues[`${serviceName}Green`] = YAML.parse(YAML.stringify(valuesObj[serviceName], 100));
      blueGreenValues[`${serviceName}Blue`].image.tag = `${stage.name}-stable`;

      if (blueGreenValues[`${serviceName}Blue`].service) {
          blueGreenValues[`${serviceName}Blue`].service.name = blueGreenValues[`${serviceName}Blue`].service.name + '-blue';
      }
      if (blueGreenValues[`${serviceName}Green`].service) {
          blueGreenValues[`${serviceName}Green`].service.name = blueGreenValues[`${serviceName}Green`].service.name + '-green';
      }
      await repo.writeFile(stage.name, `helm-chart/values.yaml`, YAML.stringify(blueGreenValues, 100), `[keptn]: added blue/green values`, {encode: true});
    
      // get templates for the service
      const serviceTemplates = this.getServiceTemplates(repo, stage.name, serviceName);

      // create blue/green yamls for each deployment/service
      /*
      for (let j = 0; j < serviceTemplates.length; j++) {
        let template = serviceTemplates[j];
        let decamelizedserviceName = decamelize(serviceName, '-');

        let templateContentB64Enc = await repo.getContents(stage.name, `helm-chart/templates/${template.path}`);
        let templateContent = base64decode(templateContentB64Enc.data.content);

        if (template.path.indexOf('-service.yaml') > 0) {
          await this.createIstioEntry(decamelizedserviceName, serviceName);
        } else {
          await this.createBlueGreenDeployment(serviceName, decamelizedserviceName, templateContent, template);
        }
      } */
    }
  }

  private async addDeploymentServiceTemplates(repo: any, serviceName: string, branch: string) {
    const cAppNameRegex = new RegExp('SERVICE_PLACEHOLDER_C', 'g');
    const decAppNameRegex = new RegExp('SERVICE_PLACEHOLDER_DEC', 'g');

    let deploymentTemplate = await utils.readFileContent('keptn/github-operator/templates/service-template/deployment.tpl');
    deploymentTemplate = deploymentTemplate.replace(cAppNameRegex, serviceName);
    deploymentTemplate = deploymentTemplate.replace(decAppNameRegex, decamelize(serviceName, '-'));
    await repo.writeFile(branch, `helm-chart/templates/${serviceName}-deployment.yaml`, deploymentTemplate, `[keptn]: Added deployment yaml template for new app: ${serviceName}`, { encode: true });

    let serviceTemplate = await utils.readFileContent('keptn/github-operator/templates/service-template/service.tpl');
    serviceTemplate = serviceTemplate.replace(cAppNameRegex, serviceName);
    serviceTemplate = serviceTemplate.replace(decAppNameRegex, decamelize(serviceName, '-'));
    await repo.writeFile(branch, `helm-chart/templates/${serviceName}-service.yaml`, serviceTemplate, `[keptn]: Added service yaml template for new app: ${serviceName}`, { encode: true }); 
  }

  async createIstioEntry(decamelizedAppKey : string, appKey : string) {
    /*
    let destinationRuleTemplate = await utils.readFileContent('istio-manifests/destination_rule.tpl');
    destinationRuleTemplate = mustache.render(destinationRuleTemplate, {
        serviceName: decamelizedAppKey,
        chartName,
        environment: branchName
    });
    await configRepo.writeFile(branchName, `helm-chart/templates/istio-destination-rule-${appKey}.yaml`, destinationRuleTemplate, `[keptn-onboard]: added istio destination rule for ${appKey}`, { encode: true });

    // create istio virtual service
    let virtualServiceTemplate = await utils.readFileContent('istio-manifests/virtual_service.tpl');
    virtualServiceTemplate = mustache.render(virtualServiceTemplate, {
        gitHubOrg: gitHubOrgName,
        serviceName: decamelizedAppKey,
        chartName,
        environment: branchName,
        ingressGatewayIP: istioIngressGatewayService.ip
    });
    await configRepo.writeFile(branchName, `helm-chart/templates/istio-virtual-service-${appKey}.yaml`, virtualServiceTemplate, `[keptn-onboard]: added istio virtual service for ${appKey}`, { encode: true });
    */
  }

  async createBlueGreenDeployment(appKey, decamelizedAppKey, templateContent, template) {
    /*
    let replaceRegex = new RegExp(appKey, 'g');
    let tmpRegex = new RegExp('selector-' + decamelizedAppKey, 'g');
    let decamelizedAppNameRegex = new RegExp(decamelizedAppKey, 'g');
    let templateContentBlue = templateContent.replace(replaceRegex, `${appKey}Blue`);
    let tmpString = uuidv1();
    templateContentBlue = templateContentBlue.replace(tmpRegex, tmpString);
    templateContentBlue = templateContentBlue.replace(decamelizedAppNameRegex, `${decamelizedAppKey}-blue`);
    templateContentBlue = templateContentBlue.replace(new RegExp(tmpString, 'g'), 'selector-' + decamelizedAppKey);
    let templateContentGreen = templateContent.replace(replaceRegex, `${appKey}Green`);
    templateContentGreen = templateContentGreen.replace(tmpRegex, tmpString);
    templateContentGreen = templateContentGreen.replace(decamelizedAppNameRegex, `${decamelizedAppKey}-green`);
    templateContentGreen = templateContentGreen.replace(new RegExp(tmpString, 'g'), 'selector-' + decamelizedAppKey);
    let templateBluePathName = template.path.replace(replaceRegex, `${appKey}Blue`);
    let templateGreenPathName = template.path.replace(replaceRegex, `${appKey}Green`);
    await configRepo.writeFile(branchName, `helm-chart/templates/${templateBluePathName}`, templateContentBlue, `[keptn-onboard]: added blue version of ${appKey}`, { encode: true });
    await configRepo.writeFile(branchName, `helm-chart/templates/${templateGreenPathName}`, templateContentGreen, `[keptn-onboard]: added green version of ${appKey}`, { encode: true });
    // delete the original template
    await configRepo.deleteFile(branchName, `helm-chart/templates/${template.path}`);
    */
  }

  private async getServiceTemplates(repo: any, branchName: string, serviceName: string) : Promise<void> {

    const branch = await repo.getBranch(branchName);
    const tree = await repo.getTree(branch.data.commit.sha);

    // Get the content of helm-chart/templates
    const helmChartTree = await repo.getTree(tree.data.tree.filter(item => item.path === 'helm-chart')[0].sha);
    let templateTree = await repo.getTree(helmChartTree.data.tree.filter(item => item.path === 'templates')[0].sha);

    return templateTree.data.tree.filter(item => item.path.indexOf(serviceName) === 0 &&
        (item.path.indexOf('yml') > -1 || item.path.indexOf('yaml') > -1) &&
        (item.path.indexOf('Blue') < 0) && (item.path.indexOf('Green') < 0));
  }
}
