import { CredentialsService } from './CredentialsService';

import { ServiceModel } from '../types/ServiceModel';
import { Stage, ShipyardModel } from '../types/ShipyardModel';
import { CredentialsModel } from '../types/CredentialsModel';
import { ConfigurationModel } from '../types/ConfigurationModel';
import { KeptnRequestModel } from '../types/KeptnRequestModel';
import { TreeModel , TreeItem } from '../types/TreeModel';

import { Utils } from '../lib/Utils';
import { base64decode } from 'nodejs-base64';
import { v4 as uuid } from 'uuid';

import axios  from 'axios';

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

  private static gatewayTplFile: string = 'keptn/github-service/templates/istio-manifests/gateway.tpl';
  private static destinationRuleTplFile: string = 'keptn/github-service/templates/istio-manifests/destination_rule.tpl';
  private static virtualServiceTplFile: string = 'keptn/github-service/templates/istio-manifests/virtual_service.tpl';
  private static deploymentTplFile: string = 'keptn/github-service/templates/service-template/deployment.tpl';
  private static serviceTplFile: string = 'keptn/github-service/templates/service-template/service.tpl';

  private constructor() {
  }

  static async getInstance() {
    if (GitHubService.instance === undefined) {
      GitHubService.instance = new GitHubService();

      // initialize github api with user and token
      const credService: CredentialsService = CredentialsService.getInstance();
      const githubCreds: CredentialsModel = await credService.getGithubCredentials();
      GitHubService.gitHubOrg = githubCreds.org;

      gh = new GitHub({
        username: githubCreds.user,
        password: githubCreds.token,
        auth: 'basic',
      });
    }
    return GitHubService.instance;
  }

  getCurrentStage(shipyardObj : any, stage : string) : string {
    let currentStage = undefined;

    if (stage === undefined || stage === '') {
      currentStage = shipyardObj.stages[0].name;
    } else {
      for (let j = 0; j < shipyardObj.stages.length; j = j + 1) {
        if (shipyardObj.stages[j].name === stage && j+1 < shipyardObj.stages.length) {
          currentStage = shipyardObj.stages[j+1].name;
        }
      }
    }

    return currentStage;
  }

  async updateValuesFile(repo : any, valuesObj : any, config : ConfigurationModel, deploymentStrategy: string) : Promise<boolean>{
    let updated = false;

    const repository : string = config.image;
    const tag : string = config.tag;
    if (config.tag == null) {
      config.tag = '0.6.0-1';
    }

    if (deploymentStrategy === 'direct') {
      valuesObj[config.service].image.repository = repository;
      valuesObj[config.service].image.tag = tag;

      const result = await repo.writeFile(
        config.stage, 'helm-chart/values.yaml',
        YAML.stringify(valuesObj, 100).replace(/\'/g, ''),
        `[keptn-config-change]:${config.service}:${config.image}`,
        { encode: true });
      if (result.statusText === 'OK') {
        updated = true;
      }
    } else if (deploymentStrategy === 'blue_green_service') {
      valuesObj[`${config.service}Blue`].image.repository = repository;
      valuesObj[`${config.service}Green`].image.repository = repository;
      valuesObj[`${config.service}Blue`].image.tag = tag;
      valuesObj[`${config.service}Green`].image.tag = tag;

      const result = await repo.writeFile(
        config.stage, 'helm-chart/values.yaml',
        YAML.stringify(valuesObj, 100).replace(/\'/g, ''),
        `[keptn-config-change]:${config.service}:${config.image}`,
        { encode: true });
      if (result.statusText === 'OK') {
        updated = true;
      }
    }
    return updated;
  }

  async sendConfigChangedEvent(orgName : string, config : ConfigurationModel) : Promise<boolean> {
    let sent : boolean = false;

    config.githuborg = orgName;

    const keptnEvent: KeptnRequestModel = new KeptnRequestModel();
    keptnEvent.data = config;
    keptnEvent.type = KeptnRequestModel.EVENT_TYPES.CONFIGURATION_CHANGED;
    console.log(`Data: ${keptnEvent}`);
    await axios.post('http://event-broker.keptn.svc.cluster.local/keptn', keptnEvent);

    return sent;
  }

  async updateConfiguration(orgName : string, config : ConfigurationModel) : Promise<boolean> {
    let updated: boolean = false;
    try {

      if (config.project) {
        const repo = await gh.getRepo(orgName, config.project);

        const shipyardYaml = await repo.getContents('master', 'shipyard.yaml');
        const shipyardObj = YAML.parse(base64decode(shipyardYaml.data.content));

        config.stage = this.getCurrentStage(shipyardObj, config.stage);

        console.log(`TAG: ${config.tag}`);

        if (config.stage && config.tag) {
          const valuesYaml = await repo.getContents(config.stage, 'helm-chart/values.yaml');
          let valuesObj = YAML.parse(base64decode(valuesYaml.data.content));
          if (valuesObj === undefined || valuesObj === null) { valuesObj = {}; }

          // service not availalbe in values file
          if (valuesObj[config.service] === undefined) {
            console.log('[git-service]: Service not available.');
          } else {
            for (let j = 0; j < shipyardObj.stages.length; j = j + 1) {
              const newConfig : ConfigurationModel = config;

              if (shipyardObj.stages[j].name === config.stage) {
                newConfig.teststategy = shipyardObj.stages[j].test_strategy;
                newConfig.deploymentstrategy = shipyardObj.stages[j].deployment_strategy;
                await this.updateValuesFile(
                  repo,
                  valuesObj,
                  config,
                  shipyardObj.stages[j].deployment_strategy);
              }

              updated = true;
              console.log('[git-service]: Send configuration changed event.');
              await this.sendConfigChangedEvent(GitHubService.gitHubOrg, newConfig);
              console.log('[git-service]: Configuration changed event sent.');
            }
          }
        } else {
          console.log(`[git-service]: Tag not defined.`);
        }
      } else {
        console.log(`[git-service]: Project not defined.`);
      }
    } catch (e) {
      if (e.response && e.response.statusText === 'Not Found') {
        console.log(`[git-service]: Could not find shipyard file.`);
        console.log(e.message);
      }
    }
    return updated;
  }

  async createProject(orgName : string, shipyard : ShipyardModel) : Promise<boolean> {
    const created: boolean = await this.createRepository(orgName, shipyard);
    if (created) {
      const repo = await gh.getRepo(orgName, shipyard.project);

      await this.initialCommit(repo, shipyard);
      await this.createBranchesForEachStages(repo, shipyard);
      await this.addShipyardToMaster(repo, shipyard);
      // TODO: WEBHOOK - await this.setHook(repo, shipyard);
    }
    return created;
  }

  async deleteProject(orgName : string, shipyard : ShipyardModel) : Promise<boolean> {
    let deleted = false;
    try {
      const repo = await gh.getRepo(shipyard.project);
      deleted = await repo.deleteRepo();
    } catch (e) {
      if (e.response && e.response.statusText === 'Not Found') {
        console.log(`[keptn] Could not find repository ${shipyard.project}.`);
        console.log(e.message);
      }
    }
    return deleted;
  }

  private async updateWebHook(
    active: boolean, orgName: string, project: string) : Promise<void> {
    console.log(`Setting WebHook for ${orgName}-${project} to ${active}`);
    const repo = await gh.getRepo(orgName, project);
    const hooks = await repo.listHooks();
    const hook = hooks.data.find((item) => {
      return item.config !== undefined && item.config.url.indexOf('event-broker') >= 0;
    });
    repo.updateHook(hook.id, {
      active,
    });
  }

  private async createRepository(orgName : string, shipyard : ShipyardModel) : Promise<boolean> {
    const repository = {
      name : shipyard.project,
    };

    try {
      const org = await gh.getOrganization(orgName);
      const result = await org.createRepo(repository);
    } catch (e) {
      if (e.response) {
        if (e.response.statusText === 'Not Found') {
          console.log(`[github-service] Could not find organziation ${orgName}.`);
        } else if (e.response.statusText === 'Unprocessable Entity') {
          console.log(`[github-service] Repository ${shipyard.project} already available.`);
        }
      }
      console.log(`Error: ${e.message}`);
      return false;
    }
    return true;
  }

  private async setHook(repo : any, shipyard : ShipyardModel) : Promise<any> {
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
          secret: await credService.getKeptnApiToken(),
          insecure_ssl: 1,
        },
      });
      console.log(`[git-service] Webhook http://${eventBrokerUri}/github activated.`);

    } catch (e) {
      console.log('[github-service] Setting webhook failed.');
      console.log(e.message);
    }
  }

  private async initialCommit(repo : any, shipyard : ShipyardModel) : Promise<any> {
    try {
      await repo.writeFile(
        'master',
        'README.md',
        `# keptn takes care of your ${shipyard.project}`,
        '[keptn]: Initial commit', { encode: true });
    } catch (e) {
      console.log('[github-service] Initial commit failed.');
      console.log(e.message);
    }
  }

  private async createBranchesForEachStages(repo : any, shipyard : ShipyardModel) : Promise<any> {
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

        if (stage.deployment_strategy === 'blue_green_service') {
          // add istio gateway to stage
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
      console.log('[github-service] Creating branches failed.');
      console.log(e.message);
    }
  }

  private async addShipyardToMaster(repo: any, shipyard : ShipyardModel) : Promise<any> {
    try {
      await repo.writeFile(
        'master',
        'shipyard.yaml',
        YAML.stringify(shipyard),
        '[keptn]: Added shipyard containing the definition of each stage.',
        { encode: true });

    } catch (e) {
      console.log('[github-service] Adding shipyard to master failed.');
      console.log(e.message);
    }
  }

  async onboardService(orgName : string, service : ServiceModel) : Promise<any> {
    if (service.values && service.values.service) {

      const serviceName = service.values.service.name;
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
            console.log(`[keptn] Service already available in stage: ${stage.name}.`);
          } else {
            console.log(`[keptn] Adding artifacts to: ${stage.name}.`);
            await this.addArtifactsToBranch(repo, orgName, service, stage, valuesObj, chartName);
          }
        }));
        // TODO: WEBHOOK - this.updateWebHook(true, orgName, service.project);
      } catch (e) {
        console.log('[github-service] Onboarding service failed.');
        console.log(e.message);
        // TODO: WEBHOOK - await this.updateWebHook(true, orgName, service.project);
      }
    } else {
      console.log('[github-service] CloudEvent does not contain data.values.');
    }
  }

  private async addArtifactsToBranch(repo: any, orgName: string, service : ServiceModel, stage: Stage, valuesObj: any, chartName: string) {
    if (service.values) {
      // update values file
      const serviceName = service.values.service.name;
      valuesObj[serviceName] = service.values;
      await repo.writeFile(
        stage.name,
        'helm-chart/values.yaml',
        YAML.stringify(valuesObj, 100),
        `[keptn]: Added entry for ${serviceName} in values.yaml`,
        { encode: true });

      // add deployment and service template
      await this.addDeploymentServiceTemplates(repo, serviceName, stage.name, service);

      const istioIngressGatewayService = await utils.getK8sServiceUrl(
        'istio-ingressgateway', 'istio-system');

      if (stage.deployment_strategy === 'blue_green_service') {
        const bgValues = valuesObj;

        // update values file
        bgValues[`${serviceName}Blue`] = YAML.parse(YAML.stringify(valuesObj[serviceName], 100));
        bgValues[`${serviceName}Green`] = YAML.parse(YAML.stringify(valuesObj[serviceName], 100));

        bgValues[`${serviceName}Blue`].image.tag = `${stage.name}-stable`;

        if (bgValues[`${serviceName}Blue`].service) {
          bgValues[`${serviceName}Blue`].service.name = bgValues[`${serviceName}Blue`].service.name + '-blue';
        }
        if (bgValues[`${serviceName}Green`].service) {
          bgValues[`${serviceName}Green`].service.name = bgValues[`${serviceName}Green`].service.name + '-green';
        }
        await repo.writeFile(
          stage.name,
          `helm-chart/values.yaml`,
          YAML.stringify(bgValues, 100),
          `[keptn]: Added blue/green values`,
          { encode: true });

        // get templates for the service
        const branch = await repo.getBranch(stage.name);
        const gitHubRootTree: TreeModel = (await repo.getTree(branch.data.commit.sha)).data;

        // get the content of helm-chart/templates
        const helmTree : TreeModel = (
          await repo.getTree(gitHubRootTree.tree.filter(item => item.path === 'helm-chart')[0].sha)
          ).data;
        const templateTree : TreeModel = (
          await repo.getTree(helmTree.tree.filter(item => item.path === 'templates')[0].sha)
          ).data;

        // create blue/green yamls for each deployment/service
        for (let j = 0; j < templateTree.tree.length; j = j + 1) {

          const template : TreeItem = templateTree.tree[j];

          if (template.path.indexOf(serviceName) === 0 &&
             (template.path.indexOf('yml') > -1 || template.path.indexOf('yaml') > -1) &&
             (template.path.indexOf('Blue') < 0 && template.path.indexOf('Green') < 0)) {

            const decamelizedserviceName = decamelize(serviceName, '-');
            const templateContentB64Enc = await repo.getContents(
              stage.name,
              `helm-chart/templates/${template.path}`);
            const templateContent = base64decode(templateContentB64Enc.data.content);

            if (template.path.indexOf('-service.yaml') > 0) {
              await this.createIstioEntry(
                orgName,
                repo,
                decamelizedserviceName,
                serviceName,
                stage.name,
                chartName,
                istioIngressGatewayService,
              );
            } else if (template.path.indexOf('-deployment.yaml') > 0) {
              await this.createBlueGreenDeployment(
                repo,
                serviceName,
                decamelizedserviceName,
                stage.name,
                templateContent,
                template,
              );
            }
          }
        }
      }
    } /*else if (cloudEvent.data.manifest) {
      await repo.writeFile(stage.name, `${serviceName}.yaml`, YAML.stringify(cloudEvent.data.manifest, 100), `[keptn]: Added manifest for ${serviceName}`, { encode: true });
    }*/ else {
      console.log('[github-service] For onboarding a service, a values or manifest object must be available in the data block.');
    }
  }

  private async addDeploymentServiceTemplates(repo: any, serviceName: string, branch: string, service : ServiceModel) {
    const cServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_C', 'g');
    const decServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_DEC', 'g');

    if (service.templates && service.templates.deployment) {
      // TODO: Read deployment from data.templates block.
      console.log('Reading deployment template from cloudEvent not impleted.');
    } else { // Use Template
      let deploymentTpl = await utils.readFileContent(GitHubService.deploymentTplFile);
      deploymentTpl = deploymentTpl.replace(cServiceNameRegex, serviceName);
      deploymentTpl = deploymentTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
      await repo.writeFile(
        branch,
        `helm-chart/templates/${serviceName}-deployment.yaml`,
        deploymentTpl,
        `[keptn]: Added deployment yml template for app: ${serviceName}.`,
        { encode: true });
    }

    if (service.templates && service.templates.service) {
      // TODO: Read deployment from data.templates block.
      console.log('Reading service template from cloudEvent not impleted.');
    } else { // Use Template
      let serviceTpl = await utils.readFileContent(GitHubService.serviceTplFile);
      serviceTpl = serviceTpl.replace(cServiceNameRegex, serviceName);
      serviceTpl = serviceTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
      await repo.writeFile(
        branch,
        `helm-chart/templates/${serviceName}-service.yaml`,
        serviceTpl,
        `[keptn]: Added service yml template for app: ${serviceName}.`,
        { encode: true } );
    }
  }

  async createIstioEntry(orgName: string, repo: any, serviceKey : string, serviceName : string, branch: string, chartName: string, istioIngressGatewayService: any) {
    // create destination rule
    let destinationRuleTpl = await utils.readFileContent(GitHubService.destinationRuleTplFile);
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

    // create istio virtual service
    let virtualServiceTpl = await utils.readFileContent(GitHubService.virtualServiceTplFile);
    virtualServiceTpl = Mustache.render(virtualServiceTpl, {
      gitHubOrg: orgName,
      serviceName: serviceKey,
      chartName,
      environment: branch,
      ingressGatewayIP: istioIngressGatewayService.body.status.loadBalancer.ingress[0].ip,
    });
    await repo.writeFile(
      branch,
      `helm-chart/templates/istio-virtual-service-${serviceName}.yaml`,
      virtualServiceTpl,
      `[keptn]: Added istio virtual service for ${serviceName}.`,
      { encode: true });
  }

  async createBlueGreenDeployment(repo: any, serviceName : string, decamelizedServiceName : string, branch: string, templateContent: any, template: any) {
    const serviceRegex = new RegExp(serviceName, 'g');
    const nameRegex = new RegExp(`name: {{ .Chart.Name }}-${decamelizedServiceName}`, 'g');
    const dplyRegex = new RegExp(`deployment: ${decamelizedServiceName}`, 'g');
    const valuesRegex = new RegExp(`.Values.${serviceName}`, 'g');

    // modify deployment template for blue
    let templateBlue = templateContent.replace(nameRegex, `name: ${decamelizedServiceName}-blue`);
    templateBlue = templateBlue.replace(dplyRegex, `deployment: ${decamelizedServiceName}-blue`);
    templateBlue = templateBlue.replace(valuesRegex, `.Values.${serviceName}Blue`);

    // modify deployment template for gree
    let templateGreen = templateContent.replace(nameRegex, `name: ${decamelizedServiceName}-green`);
    templateGreen = templateGreen.replace(dplyRegex, `deployment: ${decamelizedServiceName}-green`);
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
}
