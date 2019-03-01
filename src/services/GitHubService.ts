import { CredentialsService } from './CredentialsService';

import { CreateProjectModel } from '../controls/CreateProjectModel';
import { OnboardServiceModel } from '../controls/OnboardServiceModel';
import { Stage } from '../types/ShipyardModel';
import { GitHubCredentials } from '../types/GitHubCredentials';
import { GitHubTreeModel , TreeItem } from '../types/GitHubTreeModel';

import { Utils } from '../lib/Utils';
import { base64decode } from 'nodejs-base64';
import { v4 as uuid } from 'uuid';

const decamelize = require('decamelize');
const GitHub = require('github-api');
const Mustache = require('mustache');
const YAML = require('yamljs');

// Util class
const utils = new Utils();

// Basic authentication
let gh;

export class GitHubService {

  private static instance: GitHubService;

  public static gitHubOrg: string;

  private constructor() {
  }

  static async getInstance() {
    if (GitHubService.instance === undefined) {
      GitHubService.instance = new GitHubService();

      // initialize github api with user and token
      const credService: CredentialsService = CredentialsService.getInstance();
      const githubCreds: GitHubCredentials = await credService.getGithubCredentials();
      GitHubService.gitHubOrg = githubCreds.org;

      gh = new GitHub({
        username: githubCreds.user,
        password: githubCreds.token,
        auth: 'basic',
      });
    }
    return GitHubService.instance;
  }

  async createProject(gitHubOrgName : string, payload : CreateProjectModel) : Promise<boolean> {
    const created: boolean = await this.createRepository(gitHubOrgName, payload);
    if (created) {
      const repo = await gh.getRepo(gitHubOrgName, payload.data.project);

      await this.initialCommit(repo, payload);
      await this.createBranchesForEachStages(repo, payload);
      await this.addShipyardToMaster(repo, payload);
      await this.setHook(repo, payload);
    }
    return created;
  }

  async deleteProject(gitHubOrgName : string, payload : CreateProjectModel) : Promise<boolean> {
    let deleted = false;
    try {
      const repo = await gh.getRepo(payload.data.project);
      deleted = await repo.deleteRepo();
    } catch (e) {
      if (e.response.statusText != undefined) {
        if (e.response.statusText === 'Not Found') {
          console.log(`[keptn] Could not find repository ${payload.data.project}.`);
          console.log(e.message);
        }
      }
    }
    return deleted;
  }

  private async createRepository(gitHubOrgName : string,
                                 payload : CreateProjectModel) : Promise<boolean> {
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
      } else if (e.response.statusText === 'Unprocessable Entity') {
        console.log(`[keptn] Repository ${payload.data.project} already available.`);
        console.log(e.message);
      }
      return false;
    }
    return true;
  }

  private async setHook(repo : any, payload : CreateProjectModel) : Promise<any> {
    try {
      //TODO: const istioIngressGatewayService = await utils.getK8sServiceUrl('istio-ingressgateway', 'istio-system');
      //TODO: const eventBrokerUri = `event-broker.keptn.${istioIngressGatewayService.ip}.xip.io`;
      const eventBrokerUri = 'need-to-be-set';

      await repo.createHook({
        name: 'web',
        events: ['push'],
        config: {
          url: `http://${eventBrokerUri}/github`,
          content_type: 'json',
        },
      });
      console.log(`WebHook created: http://${eventBrokerUri}/github`);
    } catch (e) {
      console.log('[keptn] Setting hook failed.');
      console.log(e.message);
    }
  }

  private async initialCommit(repo : any, payload : CreateProjectModel) : Promise<any> {
    try {
      await repo.writeFile('master',
                           'README.md',
                           `# keptn takes care of your ${payload.data.project}`,
                           '[keptn]: Initial commit', { encode: true });
    } catch (e) {
      console.log('[keptn] Initial commit failed.');
      console.log(e.message);
    }
  }

  private async createBranchesForEachStages(repo : any, payload : CreateProjectModel) : Promise<any> {
    try {
      const chart = {
        apiVersion: 'v1',
        description: 'A Helm chart for Kubernetes',
        name: 'mean-k8s',
        version: '0.1.0'
      };

      payload.data.stages.forEach(async stage => {
        await repo.createBranch('master', stage.name );

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
          let gatewaySpec = await utils.readFileContent('keptn/github-operator/templates/istio-manifests/gateway.tpl');
          gatewaySpec = Mustache.render(gatewaySpec, { application: payload.data.project, stage: stage.name });

          await repo.writeFile(stage.name,
                               'helm-chart/templates/istio-gateway.yml',
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

  private async addShipyardToMaster(repo: any,
                                    payload : CreateProjectModel) : Promise<any> {
    try {
      await repo.writeFile('master',
                           'shipyard.yml',
                           YAML.stringify(payload.data),
                           '[keptn]: Added shipyard containing the definition of each stage.',
                           { encode: true });
    } catch (e) {
      console.log('[keptn] Adding shipyard to master failed.');
      console.log(e.message);
    }
  }

  async onboardService(gitHubOrgName : string, payload : OnboardServiceModel) : Promise<any> {
    
    if ( payload.data.values && payload.data.values.service ) {

      const serviceName = payload.data.values.service.name;
      try {
        const repo = await gh.getRepo(gitHubOrgName, payload.data.project);
  
        const shipyardYaml = await repo.getContents('master', 'shipyard.yml');
        const shipyardlObj = YAML.parse(base64decode(shipyardYaml.data.content));
  
        //shipyardlObj.stages.forEach(async stage => {     
        await Promise.all(shipyardlObj.stages.map(async (stage) => {
          const valuesYaml = await repo.getContents(stage.name, 'helm-chart/values.yml');
          let valuesObj = YAML.parse(base64decode(valuesYaml.data.content));
          if (valuesObj == undefined) { valuesObj = {}; }
  
          const chartYaml = await repo.getContents(stage.name, 'helm-chart/Chart.yml');
          const chartObj = YAML.parse(base64decode(chartYaml.data.content));
          const chartName = chartObj.name;
  
          // service already defined in helm chart
          if (valuesObj[serviceName] !== undefined) {
            console.log(`[keptn] Service already available in stage: ${stage.name}.`);
          } else {
            console.log(`[keptn] Adding artifacts to: ${stage.name}.`);
            await this.addArtifactsToBranch(gitHubOrgName, repo, serviceName, stage, valuesObj, chartName, payload );
          }
        }));
  
      } catch (e) {
        console.log('[keptn] Onboarding service failed.');
        console.log(e.message);
      }
    } else {
      console.log('[keptn] Payload does not contain data.values.');
    }
  }

  private async addArtifactsToBranch(gitHubOrgName: string, repo: any, serviceName: string, stage: Stage, valuesObj: any, chartName: string, payload: OnboardServiceModel) {
    // update values file
    valuesObj[serviceName] = payload.data.values;
    await repo.writeFile(stage.name, 'helm-chart/values.yml', YAML.stringify(valuesObj, 100), `[keptn]: Added entry for new app in values.yml`, { encode: true });

    // add deployment and service template
    await this.addDeploymentServiceTemplates(repo, serviceName, stage.name, payload);

    if (stage.deployment_strategy === 'blue_green_service') {
      const blueGreenValues = {};

      // update values file
      blueGreenValues[`${serviceName}Blue`] = payload.data.values;
      blueGreenValues[`${serviceName}Green`] = YAML.parse(YAML.stringify(valuesObj[serviceName], 100));
      blueGreenValues[`${serviceName}Blue`].image.tag = `${stage.name}-stable`;

      if (blueGreenValues[`${serviceName}Blue`].service) {
          blueGreenValues[`${serviceName}Blue`].service.name = blueGreenValues[`${serviceName}Blue`].service.name + '-blue';
      }
      if (blueGreenValues[`${serviceName}Green`].service) {
          blueGreenValues[`${serviceName}Green`].service.name = blueGreenValues[`${serviceName}Green`].service.name + '-green';
      }
      await repo.writeFile(stage.name, `helm-chart/values.yml`, YAML.stringify(blueGreenValues, 100), `[keptn]: Added blue/green values`, {encode: true});
    
      // get templates for the service
      const branch = await repo.getBranch(stage.name);
      const gitHubRootTree: GitHubTreeModel = (await repo.getTree(branch.data.commit.sha)).data;

      // get the content of helm-chart/templates
      const gitHubHelmTree : GitHubTreeModel = (await repo.getTree(gitHubRootTree.tree.filter(item => item.path === 'helm-chart')[0].sha)).data;
      let gitHubTemplateTree : GitHubTreeModel = (await repo.getTree(gitHubHelmTree.tree.filter(item => item.path === 'templates')[0].sha)).data;

      // create blue/green yamls for each deployment/service
      for (let j = 0; j < gitHubTemplateTree.tree.length; j++) {

        const template : TreeItem = gitHubTemplateTree.tree[j];

        if (template => template.path.indexOf(serviceName) === 0 &&
           (template.path.indexOf('yml') > -1 || template.path.indexOf('yaml') > -1) &&
           (template.path.indexOf('Blue') < 0) && (template.path.indexOf('Green') < 0)) {

          const decamelizedserviceName = decamelize(serviceName, '-');
          const templateContentB64Enc = await repo.getContents(stage.name, `helm-chart/templates/${template.path}`);
          const templateContent = base64decode(templateContentB64Enc.data.content);

          if (template.path.indexOf('-service.yml') > 0) {
            await this.createIstioEntry(gitHubOrgName, repo, decamelizedserviceName, serviceName, stage.name, chartName);
          } else {
            await this.createBlueGreenDeployment(repo, serviceName, decamelizedserviceName, stage.name, templateContent, template);
          }
        }
      }
    }
  }

  private async addDeploymentServiceTemplates(repo: any, serviceName: string, branch: string, payload: OnboardServiceModel) {
    const cServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_C', 'g');
    const decServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_DEC', 'g');

    let deploymentTpl = await utils.readFileContent('keptn/github-operator/templates/service-template/deployment.tpl');
    deploymentTpl = deploymentTpl.replace(cServiceNameRegex, serviceName);
    deploymentTpl = deploymentTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
    // TODO: let deploymentTpl = payload.data.templates.deployment
    await repo.writeFile(branch, `helm-chart/templates/${serviceName}-deployment.yml`, deploymentTpl, `[keptn]: Added deployment yml template for app: ${serviceName}.`, { encode: true });

    let serviceTpl = await utils.readFileContent('keptn/github-operator/templates/service-template/service.tpl');
    serviceTpl = serviceTpl.replace(cServiceNameRegex, serviceName);
    serviceTpl = serviceTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
    // TODO: let serviceTpl = payload.data.templates.service
    await repo.writeFile(branch, `helm-chart/templates/${serviceName}-service.yml`, serviceTpl, `[keptn]: Added service yml template for app: ${serviceName}.`, { encode: true }); 
  }

  async createIstioEntry(gitHubOrgName: string, repo: any, decamelizedServiceKey : string, serviceName : string, branch: string, chartName: string) {
    // create destination rule
    let destinationRuleTpl = await utils.readFileContent('keptn/github-operator/templates/istio-manifests/destination_rule.tpl');
    destinationRuleTpl = Mustache.render(destinationRuleTpl, {
      serviceName: decamelizedServiceKey,
      chartName,
      environment: branch,
    });
    await repo.writeFile(branch, `helm-chart/templates/istio-destination-rule-${serviceName}.yml`, destinationRuleTpl, `[keptn]: Added istio destination rule for ${serviceName}.`, { encode: true });

    // create istio virtual service
    let virtualServiceTpl = await utils.readFileContent('keptn/github-operator/templates/istio-manifests/virtual_service.tpl');
    virtualServiceTpl = Mustache.render(virtualServiceTpl, {
      gitHubOrg: gitHubOrgName,
      serviceName: decamelizedServiceKey,
      chartName,
      environment: branch,
      // TODO: ingressGatewayIP: istioIngressGatewayService.ip
    });
    await repo.writeFile(branch, `helm-chart/templates/istio-virtual-service-${serviceName}.yml`, virtualServiceTpl, `[keptn]: Added istio virtual service for ${serviceName}.`, { encode: true });
  }

  async createBlueGreenDeployment(repo: any, serviceName : string, decamelizedServiceName : string, branch: string, templateContent: any, template: any) {
    
    let replaceRegex = new RegExp(serviceName, 'g');
    let tmpRegex = new RegExp('selector-' + decamelizedServiceName, 'g');
    let decamelizedServiceNameRegex = new RegExp(decamelizedServiceName, 'g');
    let tmpString : string = uuid();

    let templateContentBlue = templateContent.replace(replaceRegex, `${serviceName}Blue`);
    templateContentBlue = templateContentBlue.replace(tmpRegex, tmpString);
    templateContentBlue = templateContentBlue.replace(decamelizedServiceNameRegex, `${decamelizedServiceName}-blue`);
    templateContentBlue = templateContentBlue.replace(new RegExp(tmpString, 'g'), 'selector-' + decamelizedServiceName);
    
    let templateContentGreen = templateContent.replace(replaceRegex, `${serviceName}Green`);
    templateContentGreen = templateContentGreen.replace(tmpRegex, tmpString);
    templateContentGreen = templateContentGreen.replace(decamelizedServiceNameRegex, `${decamelizedServiceName}-green`);
    templateContentGreen = templateContentGreen.replace(new RegExp(tmpString, 'g'), 'selector-' + decamelizedServiceName);
    
    let templateBluePathName = template.path.replace(replaceRegex, `${serviceName}Blue`);
    let templateGreenPathName = template.path.replace(replaceRegex, `${serviceName}Green`);

    await repo.writeFile(branch, `helm-chart/templates/${templateBluePathName}`, templateContentBlue, `[keptn]: Added blue version of ${serviceName}`, { encode: true });
    await repo.writeFile(branch, `helm-chart/templates/${templateGreenPathName}`, templateContentGreen, `[keptn]: Added green version of ${serviceName}`, { encode: true });
    
    // delete the original template
    await repo.deleteFile(branch, `helm-chart/templates/${template.path}`);
  }
}
