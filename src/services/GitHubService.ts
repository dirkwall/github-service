import { CredentialsService } from './CredentialsService';

import { ServiceModel } from '../types/ServiceModel';
import { Stage, ShipyardModel } from '../types/ShipyardModel';
import { CredentialsModel } from '../types/CredentialsModel';
import { ConfigurationModel } from '../types/ConfigurationModel';
import { KeptnCloudEvent } from '../types/KeptnCloudEvent';
import { KeptnRequestModel } from '../types/KeptnRequestModel';
import { TreeModel , TreeItem } from '../types/TreeModel';

import { Utils } from '../lib/Utils';
import { base64decode } from 'nodejs-base64';
import { v4 as uuid } from 'uuid';

import { WebSocketLogger } from './WebSocketLogger';

import axios  from 'axios';

const decamelize = require('decamelize');
const camelize = require('camelize');
const GitHub = require('github-api');
const Mustache = require('mustache');
const YAML = require('yamljs');

// Util class
const utils = Utils.getInstance();


// Basic authentication
let gh;

export class GitHubService {

  private static instance: GitHubService;

  public static gitHubOrg: string;

  private static gatewayTplFile: string = './templates/istio-manifests/gateway.tpl';
  private static destinationRuleTplFile: string = './templates/istio-manifests/destination_rule.tpl';
  private static virtualServiceTplFileDirect: string = './templates/istio-manifests/virtual_service_direct.tpl';
  private static virtualServiceTplFileBlueGreen: string = './templates/istio-manifests/virtual_service_blue_green.tpl';
  private static deploymentTplFile: string = './templates/service-template/deployment.tpl';
  private static serviceTplFile: string = './templates/service-template/service.tpl';

  private constructor() {
  }

  static async getInstance(): Promise<GitHubService> {
    if (GitHubService.instance === undefined) {
      GitHubService.instance = new GitHubService();
      await this.updateCredentials(undefined);
    }
    return GitHubService.instance;
  }

  static async updateCredentials(cloudEvent: KeptnCloudEvent) {
    const credService: CredentialsService = CredentialsService.getInstance();
    let keptnContext = 'undefined';
    if (cloudEvent) { keptnContext = cloudEvent.shkeptncontext; }

    const githubCreds: CredentialsModel = await credService.getGithubCredentials(keptnContext);
    GitHubService.gitHubOrg = githubCreds.org;

    gh = new GitHub({
      username: githubCreds.user,
      password: githubCreds.token,
      auth: 'basic',
    });
  }

  getCurrentStage(shipyardObj: any, stage: string): string {
    let currentStage: string = undefined;

    if (stage === undefined || stage === '' || stage === null) {
      currentStage = shipyardObj.stages[0].name;
    } else {
      for (let j = 0; j < shipyardObj.stages.length; j = j + 1) {
        if (shipyardObj.stages[j].name === stage && j + 1 < shipyardObj.stages.length) {
          currentStage = shipyardObj.stages[j + 1].name;
        }
      }
    }
    return currentStage;
  }

  async updateValuesFile(repo: any, valuesObj: any, config: ConfigurationModel, deploymentStrategy: string, keptnContext): Promise<boolean>{
    let switched: boolean = true;

    const repository: string = config.image;
    const tag: string = config.tag;

    const serviceName: string = camelize(config.service);

    if (deploymentStrategy === 'direct') {
      valuesObj[serviceName].image.repository = repository;
      valuesObj[serviceName].image.tag = tag;

    } else if (deploymentStrategy === 'blue_green_service') {
      valuesObj[`${serviceName}Blue`].image.repository = repository;
      valuesObj[`${serviceName}Green`].image.repository = repository;

      const virtualService = await this.getVirtualService(repo, config, serviceName, keptnContext);

      const freeColor: string = this.getFreeColor(virtualService, keptnContext);
      valuesObj[`${serviceName}${freeColor}`].image.tag = tag;

      const activeColor: string = this.getActiveColor(virtualService, keptnContext);
      if (valuesObj[`${serviceName}${activeColor}`].image.tag == null) {
        valuesObj[`${serviceName}${activeColor}`].image.tag = tag;
      }

      switched = await this.switchBlueGreen(repo, config, serviceName, virtualService, keptnContext);
    }

    const result = await repo.writeFile(
      config.stage, 'helm-chart/values.yaml',
      YAML.stringify(valuesObj, 100).replace(/\'/g, ''),
      `[keptn]:${serviceName}:${config.image}`,
      { encode: true });

    return (result.statusText === 'OK') && switched;
  }

  async updateConfiguration(orgName: string, cloudEvent: KeptnCloudEvent): Promise<boolean> {
    let updated: boolean = false;

    const config: ConfigurationModel = cloudEvent.data;
    const keptnContext: string = cloudEvent.shkeptncontext;

    try {
      if (config.project && config.tag) {
        const repo = await gh.getRepo(orgName, config.project);

        const shipyardYaml = await repo.getContents('master', 'shipyard.yaml');
        const shipyardObj = YAML.parse(base64decode(shipyardYaml.data.content));

        config.stage = this.getCurrentStage(shipyardObj, config.stage);

        if (config.stage) {
          utils.logInfoMessage(keptnContext, `Change configuration for ${config.service} in project ${config.project}, stage ${config.stage}.`);

          const valuesYaml = await repo.getContents(config.stage, 'helm-chart/values.yaml');

          let valuesObj = YAML.parse(base64decode(valuesYaml.data.content));
          if (valuesObj === undefined || valuesObj === null) { valuesObj = {}; }

          // service not availalbe in values file
          if (valuesObj[camelize(config.service)] === undefined) {
            utils.logInfoMessage(keptnContext, 'Service not available.');
          } else {
            for (let j = 0; j < shipyardObj.stages.length; j = j + 1) {
              const newConfig: ConfigurationModel = config;

              if (shipyardObj.stages[j].name === config.stage) {
                newConfig.githuborg = orgName;
                newConfig.teststrategy = shipyardObj.stages[j].test_strategy;
                newConfig.deploymentstrategy = shipyardObj.stages[j].deployment_strategy;

                updated = await this.updateValuesFile(
                  repo,
                  valuesObj,
                  config,
                  shipyardObj.stages[j].deployment_strategy,
                  keptnContext);

                if (updated) {
                  utils.logInfoMessage(keptnContext, `Configuration changed for ${config.service} in project ${config.project}, stage ${config.stage}.`);
                  utils.logInfoMessage(keptnContext, 'Send configuration changed event.');

                  await this.sendConfigChangedEvent(GitHubService.gitHubOrg, newConfig, keptnContext);

                  utils.logInfoMessage(keptnContext, 'Configuration changed event sent.');
                } else {
                  utils.logErrorMessage(keptnContext, `Updating the configuration failed - no configuration changed event sent.`);
                }
              }
            }
          }
        } else {
          utils.logInfoMessage(keptnContext, 'No stage to apply changes to.');
        }
      } else {
        utils.logInfoMessage(keptnContext, 'Project or tag not defined.');
      }
    } catch (e) {
      if (e.response && e.response.statusText === 'Not Found') {
        utils.logErrorMessage(keptnContext, `Could not find shipyard file for project ${config.project}.`);
        console.log(e.message);
      } else {
        console.log(e.message);
      }
    }
    return updated;
  }

  async sendConfigChangedEvent(orgName: string, config: ConfigurationModel, keptnContext: string): Promise<boolean> {
    const keptnEvent: KeptnRequestModel = new KeptnRequestModel();
    keptnEvent.data = config;
    keptnEvent.type = KeptnRequestModel.EVENT_TYPES.CONFIGURATION_CHANGED;
    keptnEvent.shkeptncontext = keptnContext;
    await axios.post('http://event-broker.keptn.svc.cluster.local/keptn', keptnEvent);
    return true;
  }

  getFreeColor(virtualService: any, keptnContext: string): string {
    let freeColor: string = 'Blue';

    if (virtualService.spec.http[0].route) {
      if (virtualService.spec.http[0].route[0].destination.subset === 'blue' &&
        virtualService.spec.http[0].route[0].weight === 0) {
        freeColor = 'Blue';
      } else if (virtualService.spec.http[0].route[0].destination.subset === 'green' &&
        virtualService.spec.http[0].route[0].weight === 0) {
        freeColor = 'Green';
      } else if (virtualService.spec.http[0].route[1].destination.subset === 'blue' &&
        virtualService.spec.http[0].route[1].weight === 0) {
        freeColor = 'Blue';
      } else if (virtualService.spec.http[0].route[1].destination.subset === 'green' &&
        virtualService.spec.http[0].route[1].weight === 0) {
        freeColor = 'Green';
      } else {
        utils.logInfoMessage(keptnContext, `Free color can't be determined. There is a wrong configuration in the virtual service configuration`);
      }
    }

    return freeColor;
  }

  getActiveColor(virtualService: any, keptnContext: string): string {
    let activeColor: string = 'Blue';

    if (virtualService.spec.http[0].route) {
      if (virtualService.spec.http[0].route[0].destination.subset === 'blue' &&
        virtualService.spec.http[0].route[0].weight === 100) {
        activeColor = 'Blue';
      } else if (virtualService.spec.http[0].route[0].destination.subset === 'green' &&
        virtualService.spec.http[0].route[0].weight === 100) {
        activeColor = 'Green';
      } else if (virtualService.spec.http[0].route[1].destination.subset === 'green' &&
        virtualService.spec.http[0].route[1].weight === 100) {
        activeColor = 'Green';
      } else if (virtualService.spec.http[0].route[1].destination.subset === 'blue' &&
        virtualService.spec.http[0].route[1].weight === 100) {
        activeColor = 'Blue';
      } else {
        utils.logInfoMessage(keptnContext, `Active color can't be determined. There is a wrong configuration in the virtual service configuration`);
      }
    }

    return activeColor;
  }

  async getVirtualService(repo: any, config: ConfigurationModel, serviceName: string, keptnContext: string): Promise<any> {
    try {
      const virtualSvcYaml = await repo.getContents(config.stage,
        `helm-chart/templates/istio-virtual-service-${serviceName}.yaml`);
      const virtualService = YAML.parse(base64decode(virtualSvcYaml.data.content));
      return virtualService;
    } catch (e) {
      if (e.response && e.response.statusText === 'Not Found') {
        utils.logErrorMessage(keptnContext, `Could not find istio-virtual-service for ${config.service} in project: ${config.project}, stage: ${config.stage}.`);
        console.log(e.message);
      } else {
        console.log(e.message);
      }
    }
    return undefined;
  }

  async switchBlueGreen(repo: any, config: ConfigurationModel, serviceName: string, virtualService: any, keptnContext: string): Promise<boolean> {
    if (virtualService.spec.http[0].route) {
      if (virtualService.spec.http[0].route[0].weight === 100) {
        virtualService.spec.http[0].route[0].weight = 0;
        virtualService.spec.http[0].route[1].weight = 100;
      } else if (virtualService.spec.http[0].route[1].weight === 100) {
        virtualService.spec.http[0].route[0].weight = 100;
        virtualService.spec.http[0].route[1].weight = 0;
      } else {
        utils.logInfoMessage(keptnContext, `The virtual service configuration does not support blue green.`);
        return false;
      }
    }

    const result = await repo.writeFile(
      config.stage,
      `helm-chart/templates/istio-virtual-service-${serviceName}.yaml`,
      YAML.stringify(virtualService, 100).replace(/\'/g, ''),
      `[keptn]: Switched blue green`,
      { encode: true });

    return (result.statusText === 'OK');
  }

  async createProject(orgName: string, cloudEvent: KeptnCloudEvent): Promise<boolean> {
    const shipyard: ShipyardModel = cloudEvent.data;
    shipyard.project = shipyard.project.toLowerCase();
    const keptnContext: string = cloudEvent.shkeptncontext;

    utils.logInfoMessage(keptnContext, `Start to create project ${shipyard.project}.`);

    const created: boolean = await this.createRepository(orgName, shipyard, keptnContext);
    if (created) {
      const repo = await gh.getRepo(orgName, shipyard.project);

      const credService: CredentialsService = CredentialsService.getInstance();
      await credService.addRegistryEntry(shipyard.registry, shipyard.project);

      await this.initialCommit(repo, shipyard, keptnContext);
      await this.createBranchesForEachStages(repo, shipyard, keptnContext);
      await this.addShipyardToMaster(repo, shipyard, keptnContext);

      utils.logInfoMessage(keptnContext, `Project ${shipyard.project} created.`, true);
    }
    return created;
  }

  async deleteProject(orgName: string, cloudEvent: KeptnCloudEvent): Promise<boolean> {
    let deleted: boolean = false;

    const shipyard: ShipyardModel = cloudEvent.data;
    const keptnContext: string = cloudEvent.shkeptncontext;

    try {
      const repo = await gh.getRepo(shipyard.project);
      deleted = await repo.deleteRepo();
    } catch (e) {
      if (e.response && e.response.statusText === 'Not Found') {
        utils.logErrorMessage(keptnContext, `Could not find repository ${shipyard.project}.`);
        console.log(e.message);
      }
    }
    return deleted;
  }

  private async createRepository(
    orgName: string,
    shipyard: ShipyardModel,
    keptnContext: string): Promise<boolean> {
    const repository = { name: shipyard.project };

    try {
      const org = await gh.getOrganization(orgName);
      await org.createRepo(repository);
    } catch (e) {
      if (e.response) {
        if (e.response.statusText === 'Not Found') {
          utils.logErrorMessage(keptnContext, `Could not find organziation ${orgName}.`);
        } else if (e.response.statusText === 'Unprocessable Entity') {
          utils.logInfoMessage(keptnContext, `Repository ${shipyard.project} already available.`);
        }
      }
      utils.logErrorMessage(keptnContext, `Error: ${e.message}`);
      return false;
    }
    return true;
  }

  private async initialCommit(
    repo: any,
    shipyard: ShipyardModel,
    keptnContext: string): Promise<any> {
    try {
      await repo.writeFile(
        'master',
        'README.md',
        `# keptn takes care of your ${shipyard.project}`,
        '[keptn]: Initial commit', { encode: true });
    } catch (e) {
      utils.logErrorMessage(keptnContext, `Initial commit failed.`);
      console.log(e.message);
    }
  }

  private async createBranchesForEachStages(
    repo: any,
    shipyard: ShipyardModel,
    keptnContext: string): Promise<any> {
    try {
      const chart = {
        apiVersion: 'v1',
        description: `A Helm chart for project ${shipyard.project}`,
        name: shipyard.project,
        version: '0.1.0',
      };

      shipyard.stages.forEach(async stage => {
        await repo.createBranch('master', stage.name );

        await repo.writeFile(
          stage.name,
          'helm-chart/Chart.yaml',
          YAML.stringify(chart, 100).replace(/\'/g, ''),
          '[keptn]: Added helm-chart Chart.yaml file.',
          { encode: true });

        await repo.writeFile(
          stage.name,
          'helm-chart/values.yaml',
          '',
          '[keptn]: Added helm-chart values.yaml file.',
          { encode: true });

        // add istio gateway to stage
        if ((stage.deployment_strategy === 'blue_green_service') ||
         (stage.deployment_strategy === 'direct')) {

          let gatewaySpec = await utils.readFileContent(GitHubService.gatewayTplFile);
          gatewaySpec = Mustache.render(
            gatewaySpec,
            { application: shipyard.project, stage: stage.name });

          await repo.writeFile(
            stage.name,
            'helm-chart/templates/istio-gateway.yaml',
            gatewaySpec,
            '[keptn]: Added istio gateway.',
            { encode: true });
        }
      });
    } catch (e) {
      utils.logErrorMessage(keptnContext, `Creating branches failed.`);
      console.log(e.message);
    }
  }

  private async addShipyardToMaster(
    repo: any,
    shipyard: ShipyardModel,
    keptnContext: string): Promise<any> {
    try {
      await repo.writeFile(
        'master',
        'shipyard.yaml',
        YAML.stringify(shipyard),
        '[keptn]: Added shipyard containing the definition of each stage.',
        { encode: true });

    } catch (e) {
      utils.logErrorMessage(keptnContext, `Adding shipyard to master failed.`);
      console.log(e.message);
    }
  }

  async onboardService(orgName: string, cloudEvent: KeptnCloudEvent): Promise<any> {
    const service: ServiceModel = cloudEvent.data;
    const keptnContext: string = cloudEvent.shkeptncontext;

    if ((service.values && service.values.service) || (service.manifest)) {
      let serviceName: string = undefined;

      if ((service.values && service.values.service)) {
        serviceName = camelize(service.values.service.name);
      } else if (service.manifest) {
        serviceName = service.manifest.applications[0].name;
      } else {
        utils.logInfoMessage(keptnContext, `Manifest type not implemented.`);
      }

      utils.logInfoMessage(keptnContext, `Start onboarding of service ${serviceName}.`);

      try {
        const repo = await gh.getRepo(orgName, service.project);
        //TODO: WEBHOOK - await this.updateWebHook(false, orgName, service.project);

        const shipyardYaml = await repo.getContents('master', 'shipyard.yaml');
        const shipyardlObj = YAML.parse(base64decode(shipyardYaml.data.content));

        // shipyardlObj.stages.forEach(async stage => {
        await Promise.all(shipyardlObj.stages.map(async (stage) => {
          const valuesYaml = await repo.getContents(stage.name, 'helm-chart/values.yaml');
          let valuesObj = YAML.parse(base64decode(valuesYaml.data.content));
          if (valuesObj === undefined || valuesObj === null) { valuesObj = {}; }

          const chartYaml = await repo.getContents(stage.name, 'helm-chart/Chart.yaml');
          const chartObj = YAML.parse(base64decode(chartYaml.data.content));
          const chartName = chartObj.name;

          // service already defined in helm chart
          if (valuesObj[serviceName] !== undefined) {
            utils.logInfoMessage(keptnContext, `Service already available in stage: ${stage.name}.`);
          } else {
            utils.logInfoMessage(keptnContext, `Adding artifacts to: ${stage.name}.`);
            await this.addArtifactsToBranch(repo, service, stage, valuesObj, chartName, keptnContext);
            utils.logInfoMessage(keptnContext, `Service onboarded to: ${stage.name}.`);
          }
        }));
        utils.logInfoMessage(keptnContext, `Service successfully onboarded`, true);
      } catch (e) {
        utils.logErrorMessage(keptnContext, `Onboarding service failed.`);
        console.log(e.message);
      }
    } else {
      utils.logInfoMessage(keptnContext, `CloudEvent does not contain data.values.`);
    }
  }

  private async addArtifactsToBranch(repo: any, service: ServiceModel, stage: Stage, valuesObj: any, chartName: string, keptnContext: string) {

    if (service.values) {
      // update values file
      const serviceName = camelize(service.values.service.name);
      valuesObj[serviceName] = service.values;

      await repo.writeFile(
        stage.name,
        'helm-chart/values.yaml',
        YAML.stringify(valuesObj, 100).replace(/\'/g, ''),
        `[keptn]: Added entry for ${serviceName} in values.yaml`,
        { encode: true });

      // add deployment and service template
      await this.addDeploymentServiceTemplates(repo, serviceName, stage.name, service);

      const istioIngressGatewayService = await utils.getK8sServiceUrl(
        'istio-ingressgateway', 'istio-system');

      if (stage.deployment_strategy === 'direct') {
        let virtualServiceTpl = await utils.readFileContent(GitHubService.virtualServiceTplFileDirect);
        await this.createVirtualService(
          repo,
          service.project,
          serviceName,
          stage.name,
          chartName,
          istioIngressGatewayService,
          virtualServiceTpl,
        );

      } else if (stage.deployment_strategy === 'blue_green_service') {
        await this.addBlueGreenValues(repo, valuesObj, serviceName, stage);

        // get templates for the service
        const branch = await repo.getBranch(stage.name);
        const gitHubRootTree: TreeModel = (await repo.getTree(branch.data.commit.sha)).data;

        // get the content of helm-chart/templates
        const helmTree: TreeModel = (
          await repo.getTree(gitHubRootTree.tree.filter(item => item.path === 'helm-chart')[0].sha)
          ).data;

        const templateTree: TreeModel = (
          await repo.getTree(helmTree.tree.filter(item => item.path === 'templates')[0].sha)
          ).data;

        // create blue/green yamls for each deployment/service
        for (let j = 0; j < templateTree.tree.length; j = j + 1) {

          const template: TreeItem = templateTree.tree[j];

          if (template.path.indexOf(serviceName) === 0 &&
             (template.path.indexOf('yml') > -1 || template.path.indexOf('yaml') > -1) &&
             (template.path.indexOf('Blue') < 0 && template.path.indexOf('Green') < 0)) {

            const templateContentB64Enc = await repo.getContents(
              stage.name,
              `helm-chart/templates/${template.path}`);
            const templateContent = base64decode(templateContentB64Enc.data.content);

            if (template.path.indexOf('-service.yaml') > 0) {
              await this.createDestinationRule(repo, serviceName, stage.name, chartName);

              let virtualServiceTpl = await utils.readFileContent(GitHubService.virtualServiceTplFileBlueGreen);
              await this.createVirtualService(
                repo,
                service.project,
                serviceName,
                stage.name,
                chartName,
                istioIngressGatewayService,
                virtualServiceTpl,
              );

            } else if (template.path.indexOf('-deployment.yaml') > 0) {
              await this.createBlueGreenDeployment(
                repo,
                serviceName,
                stage.name,
                templateContent,
                template,
              );
            }
          }
        }
      }

    } else if (service.manifest) {
      const serviceName = service.manifest.applications[0].name;

      await repo.writeFile(
        stage.name,
        `${serviceName}_manifest.yml`,
        YAML.stringify(service.manifest, 100),
        `[keptn]: Added manifest for ${serviceName}.`,
        { encode: true });

    } else {
      utils.logInfoMessage(keptnContext, `For onboarding a service, a values or manifest object must be available in the data block.`);
    }
  }

  private async addBlueGreenValues(repo: any, valuesObj: any, serviceName: string, stage: any) {
    const bgValues = valuesObj;

    // update values file
    bgValues[`${serviceName}Blue`] = YAML.parse(YAML.stringify(valuesObj[serviceName], 100));
    bgValues[`${serviceName}Green`] = YAML.parse(YAML.stringify(valuesObj[serviceName], 100));

    if (bgValues[`${serviceName}Blue`].service) {
      bgValues[`${serviceName}Blue`].service.name = bgValues[`${serviceName}Blue`].service.name + '-blue';
    }

    if (bgValues[`${serviceName}Green`].service) {
      bgValues[`${serviceName}Green`].service.name = bgValues[`${serviceName}Green`].service.name + '-green';
    }

    await repo.writeFile(
      stage.name,
      `helm-chart/values.yaml`,
      YAML.stringify(bgValues, 100).replace(/\'/g, ''),
      `[keptn]: Added blue/green values`,
      { encode: true });
  }

  private async addDeploymentServiceTemplates(repo: any, serviceName: string, branch: string, service: ServiceModel) {
    const cServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_C', 'g');
    const decServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_DEC', 'g');

    let deploymentTpl: string = undefined;

    if (service.templates && service.templates.deployment) {
      deploymentTpl = service.templates.deployment;
    } else {
      deploymentTpl = await utils.readFileContent(GitHubService.deploymentTplFile);
    }

    if (deploymentTpl !== undefined) {
      deploymentTpl = deploymentTpl.replace(cServiceNameRegex, serviceName);
      deploymentTpl = deploymentTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
      await repo.writeFile(
        branch,
        `helm-chart/templates/${serviceName}-deployment.yaml`,
        deploymentTpl,
        `[keptn]: Added deployment yml template for app: ${serviceName}.`,
        { encode: true });
    }

    let serviceTpl: string = undefined;

    if (service.templates && service.templates.service) {
      serviceTpl = service.templates.service;
    } else {
      serviceTpl = await utils.readFileContent(GitHubService.serviceTplFile);
    }

    if (serviceTpl !== undefined) {
      serviceTpl = serviceTpl.replace(cServiceNameRegex, serviceName);
      serviceTpl = serviceTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
      await repo.writeFile(
        branch,
        `helm-chart/templates/${serviceName}-service.yaml`,
        serviceTpl,
        `[keptn]: Added service yml template for app: ${serviceName}.`,
        { encode: true });
    }
  }

  async createDestinationRule(repo: any, serviceName: string, branch: string, chartName: string) {
    let destinationRuleTpl = await utils.readFileContent(GitHubService.destinationRuleTplFile);
    const serviceKey = decamelize(serviceName, '-');

    destinationRuleTpl = Mustache.render(destinationRuleTpl, {
      serviceName: serviceKey,
      chartName,
      environment: branch,
    });
    await repo.writeFile(
      branch,
      `helm-chart/templates/istio-destination-rule-${serviceName}.yaml`,
      destinationRuleTpl,
      `[keptn]: Added istio destination rule for ${serviceName}.`,
      { encode: true });
  }

  async createVirtualService(repo: any, project: string, serviceName: string, branch: string, chartName: string, gateway: any, virtualServiceTpl: any) {
    const serviceKey = decamelize(serviceName, '-');

    virtualServiceTpl = Mustache.render(virtualServiceTpl, {
      application: project,
      serviceName: serviceKey,
      chartName,
      environment: branch,
      ingressGatewayIP: gateway.body.status.loadBalancer.ingress[0].ip,
    });
    await repo.writeFile(
      branch,
      `helm-chart/templates/istio-virtual-service-${serviceName}.yaml`,
      virtualServiceTpl,
      `[keptn]: Added istio virtual service for ${serviceName}.`,
      { encode: true });
  }

  async createBlueGreenDeployment(repo: any, serviceName: string, branch: string, templateContent: any, template: any) {
    const decamelizedServiceName = decamelize(serviceName, '-');

    const serviceRegex = new RegExp(serviceName, 'g');
    const nameRegex = new RegExp(`name: ${decamelizedServiceName}`, 'g');
    const dplyRegex = new RegExp(`deployment: ${decamelizedServiceName}`, 'g');
    const claimName = new RegExp(`claimName: ${decamelizedServiceName}`, 'g');
    const valuesRegex = new RegExp(`.Values.${serviceName}`, 'g');

    // modify deployment template for blue
    let templateBlue = templateContent.replace(nameRegex, `name: ${decamelizedServiceName}-blue`);
    templateBlue = templateBlue.replace(dplyRegex, `deployment: ${decamelizedServiceName}-blue`);
    templateBlue = templateBlue.replace(claimName, `claimName: ${decamelizedServiceName}-blue`);
    templateBlue = templateBlue.replace(valuesRegex, `.Values.${serviceName}Blue`);

    // modify deployment template for gree
    let templateGreen = templateContent.replace(nameRegex, `name: ${decamelizedServiceName}-green`);
    templateGreen = templateGreen.replace(dplyRegex, `deployment: ${decamelizedServiceName}-green`);
    templateGreen = templateGreen.replace(claimName, `claimName: ${decamelizedServiceName}-green`);
    templateGreen = templateGreen.replace(valuesRegex, `.Values.${serviceName}Green`);

    const templateBluePathName = template.path.replace(serviceRegex, `${serviceName}Blue`);
    const templateGreenPathName = template.path.replace(serviceRegex, `${serviceName}Green`);

    await repo.writeFile(
      branch,
      `helm-chart/templates/${templateBluePathName}`,
      templateBlue,
      `[keptn]: Added blue version of ${serviceName}`,
      { encode: true });

    await repo.writeFile(
      branch,
      `helm-chart/templates/${templateGreenPathName}`,
      templateGreen,
      `[keptn]: Added green version of ${serviceName}`,
      { encode: true });

    // delete the original template
    await repo.deleteFile(branch, `helm-chart/templates/${template.path}`);
  }

  private async setHook(repo: any, shipyard: ShipyardModel, keptnContext: string): Promise<any> {
    try {
      const istioIngressGatewayService = await utils.getK8sServiceUrl(
        'istio-ingressgateway', 'istio-system');

      const eventBrokerUri = `event-broker-ext.keptn.` +
        `${istioIngressGatewayService.body.status.loadBalancer.ingress[0].ip}.xip.io`;

      const credService: CredentialsService = CredentialsService.getInstance();

      await repo.createHook({
        name: 'web',
        events: ['push'],
        config: {
          url: `https://${eventBrokerUri}/github`,
          content_type: 'json',
          secret: await credService.getKeptnApiToken(keptnContext),
          insecure_ssl: 1,
        },
      });
      utils.logInfoMessage(keptnContext, `Webhook http://${eventBrokerUri}/github activated.`);

    } catch (e) {
      utils.logErrorMessage(keptnContext, `Setting webhook failed.`);
      console.log(e.message);
    }
  }

  private async updateWebHook(
    active: boolean, orgName: string, project: string): Promise<void> {

    const repo = await gh.getRepo(orgName, project);
    const hooks = await repo.listHooks();
    const hook = hooks.data.find((item) => {
      return item.config !== undefined && item.config.url.indexOf('event-broker') >= 0;
    });
    repo.updateHook(hook.id, {
      active,
    });
  }
}
