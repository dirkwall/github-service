import { CredentialsService } from './CredentialsService';

import { ServiceModel } from '../types/ServiceModel';
import { Stage, ShipyardModel } from '../types/ShipyardModel';
import { CredentialsModel } from '../types/CredentialsModel';
import { TreeModel , TreeItem } from '../types/TreeModel';

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

  private static gatewayTplFile: string = 'keptn/github-operator/templates/istio-manifests/gateway.tpl';
  private static destinationRuleTplFile: string = 'keptn/github-operator/templates/istio-manifests/destination_rule.tpl';
  private static virtualServiceTplFile: string = 'keptn/github-operator/templates/istio-manifests/virtual_service.tpl';
  private static deploymentTplFile: string = 'keptn/github-operator/templates/service-template/deployment.tpl';
  private static serviceTplFile: string = 'keptn/github-operator/templates/service-template/service.tpl';

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

  async createProject(orgName : string, shipyard : ShipyardModel) : Promise<boolean> {
    const created: boolean = await this.createRepository(orgName, shipyard);
    if (created) {
      const repo = await gh.getRepo(orgName, shipyard.project);

      await this.initialCommit(repo, shipyard);
      await this.createBranchesForEachStages(repo, shipyard);
      await this.addShipyardToMaster(repo, shipyard);
      await this.setHook(repo, shipyard);
    }
    return created;
  }

  async deleteProject(orgName : string, shipyard : ShipyardModel) : Promise<boolean> {
    let deleted = false;
    try {
      const repo = await gh.getRepo(shipyard.project);
      deleted = await repo.deleteRepo();
    } catch (e) {
      if (e.response.statusText !== undefined) {
        if (e.response.statusText === 'Not Found') {
          console.log(`[keptn] Could not find repository ${shipyard.project}.`);
          console.log(e.message);
        }
      }
    }
    return deleted;
  }

  private async createRepository(orgName : string, shipyard : ShipyardModel) : Promise<boolean> {
    const repository = {
      name : shipyard.project,
    };

    try {
      const org = await gh.getOrganization(orgName);
      console.log(orgName+' '+shipyard);
      await org.createRepo(repository);
      console.log('DEBUG: created repo.');
    } catch (e) {
      if (e.response) {
        if (e.response.statusText === 'Not Found') {
          console.log(`[keptn] Could not find organziation ${orgName}.`);
        } else if (e.response.statusText === 'Unprocessable Entity') {
          console.log(`[keptn] Repository ${shipyard.project} already available.`);
        }
      }
      console.log(e.message);
      return false;
    }
    return true;
  }

  private async setHook(repo : any, shipyard : ShipyardModel) : Promise<any> {
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
      console.log('[keptn] Setting webhook failed.');
      console.log(e.message);
    }
  }

  private async initialCommit(repo : any, shipyard : ShipyardModel) : Promise<any> {
    try {
      await repo.writeFile('master',
                           'README.md',
                           `# keptn takes care of your ${shipyard.project}`,
                           '[keptn]: Initial commit', { encode: true });
    } catch (e) {
      console.log('[keptn] Initial commit failed.');
      console.log(e.message);
    }
  }

  private async createBranchesForEachStages(repo : any, shipyard : ShipyardModel) : Promise<any> {
    try {
      const chart = {
        apiVersion: 'v1',
        description: 'A Helm chart for Kubernetes',
        name: 'mean-k8s',
        version: '0.1.0',
      };

      shipyard.stages.forEach(async stage => {
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
          let gatewaySpec = await utils.readFileContent(GitHubService.gatewayTplFile);
          gatewaySpec = Mustache.render(gatewaySpec, { application: shipyard.project, stage: stage.name });

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

  private async addShipyardToMaster(repo: any, shipyard : ShipyardModel) : Promise<any> {
    try {
      await repo.writeFile('master',
                           'shipyard.yml',
                           YAML.stringify(shipyard),
                           '[keptn]: Added shipyard containing the definition of each stage.',
                           { encode: true });
    } catch (e) {
      console.log('[keptn] Adding shipyard to master failed.');
      console.log(e.message);
    }
  }

  async onboardService(orgName : string, service : ServiceModel) : Promise<any> {

    if (service.values && service.values.service) {

      const serviceName = service.values.service.name;
      try {
        const repo = await gh.getRepo(orgName, service.project);

        const shipyardYaml = await repo.getContents('master', 'shipyard.yml');
        const shipyardlObj = YAML.parse(base64decode(shipyardYaml.data.content));

        //shipyardlObj.stages.forEach(async stage => {
        await Promise.all(shipyardlObj.stages.map(async (stage) => {
          const valuesYaml = await repo.getContents(stage.name, 'helm-chart/values.yml');
          let valuesObj = YAML.parse(base64decode(valuesYaml.data.content));
          if (valuesObj === undefined || valuesObj === null) { valuesObj = {}; }

          const chartYaml = await repo.getContents(stage.name, 'helm-chart/Chart.yml');
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

      } catch (e) {
        console.log('[keptn] Onboarding service failed.');
        console.log(e.message);
      }
    } else {
      console.log('[keptn] CloudEvent does not contain data.values.');
    }
  }

  private async addArtifactsToBranch(repo: any, orgName: string, service : ServiceModel, stage: Stage, valuesObj: any, chartName: string) {
    if (service.values) {
      // update values file
      const serviceName = service.values.service.name;
      valuesObj[serviceName] = service.values;
      await repo.writeFile(stage.name, 'helm-chart/values.yml', YAML.stringify(valuesObj, 100),
                           `[keptn]: Added entry for ${serviceName} in values.yml`,
                           { encode: true });

      // add deployment and service template
      await this.addDeploymentServiceTemplates(repo, serviceName, stage.name, service);

      if (stage.deployment_strategy === 'blue_green_service') {
        const bgValues = {};

        // update values file
        bgValues[`${serviceName}Blue`] = service.values;
        bgValues[`${serviceName}Green`] = YAML.parse(YAML.stringify(valuesObj[serviceName], 100));
        bgValues[`${serviceName}Blue`].image.tag = `${stage.name}-stable`;

        if (bgValues[`${serviceName}Blue`].service) {
            bgValues[`${serviceName}Blue`].service.name = bgValues[`${serviceName}Blue`].service.name + '-blue';
        }
        if (bgValues[`${serviceName}Green`].service) {
            bgValues[`${serviceName}Green`].service.name = bgValues[`${serviceName}Green`].service.name + '-green';
        }
        await repo.writeFile(stage.name, `helm-chart/values.yml`, YAML.stringify(bgValues, 100), `[keptn]: Added blue/green values`, {encode: true});

        // get templates for the service
        const branch = await repo.getBranch(stage.name);
        const gitHubRootTree: TreeModel = (await repo.getTree(branch.data.commit.sha)).data;

        // get the content of helm-chart/templates
        const helmTree : TreeModel = (await repo.getTree(gitHubRootTree.tree.filter(item => item.path === 'helm-chart')[0].sha)).data;
        let templateTree : TreeModel = (await repo.getTree(helmTree.tree.filter(item => item.path === 'templates')[0].sha)).data;

        // create blue/green yamls for each deployment/service
        for (let j = 0; j < templateTree.tree.length; j++) {

          const template : TreeItem = templateTree.tree[j];

          if (template => template.path.indexOf(serviceName) === 0 &&
             (template.path.indexOf('yml') > -1 || template.path.indexOf('yaml') > -1) &&
             (template.path.indexOf('Blue') < 0) && (template.path.indexOf('Green') < 0)) {

            const decamelizedserviceName = decamelize(serviceName, '-');
            const templateContentB64Enc = await repo.getContents(stage.name, `helm-chart/templates/${template.path}`);
            const templateContent = base64decode(templateContentB64Enc.data.content);

            if (template.path.indexOf('-service.yml') > 0) {
              await this.createIstioEntry(orgName, repo, decamelizedserviceName, serviceName, stage.name, chartName);
            } else {
              await this.createBlueGreenDeployment(repo, serviceName, decamelizedserviceName, stage.name, templateContent, template);
            }
          }
        }
      }
    } /*else if (cloudEvent.data.manifest) {
      await repo.writeFile(stage.name, `${serviceName}.yml`, YAML.stringify(cloudEvent.data.manifest, 100), `[keptn]: Added manifest for ${serviceName}`, { encode: true });
    }*/ else {
      console.log('[keptn] For onboarding a service, a values or manifest object must be available in the data block.');
    }
  }

  private async addDeploymentServiceTemplates(repo: any, serviceName: string, branch: string, service : ServiceModel) {
    const cServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_C', 'g');
    const decServiceNameRegex = new RegExp('SERVICE_PLACEHOLDER_DEC', 'g');

    if(service.templates.deployment) {
      // TODO: Read deployment from data.templates block.
      console.log('Reading deployment template from cloudEvent not impleted.');
    } else { // Use Template
      let deploymentTpl = await utils.readFileContent(GitHubService.deploymentTplFile);
      deploymentTpl = deploymentTpl.replace(cServiceNameRegex, serviceName);
      deploymentTpl = deploymentTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
      // TODO: let deploymentTpl = cloudEvent.data.templates.deployment
      await repo.writeFile(branch, `helm-chart/templates/${serviceName}-deployment.yml`, deploymentTpl, `[keptn]: Added deployment yml template for app: ${serviceName}.`, { encode: true });
    }

    if(service.templates.service) {
      // TODO: Read deployment from data.templates block.
      console.log('Reading service template from cloudEvent not impleted.');
    } else { // Use Template
      let serviceTpl = await utils.readFileContent(GitHubService.serviceTplFile);
      serviceTpl = serviceTpl.replace(cServiceNameRegex, serviceName);
      serviceTpl = serviceTpl.replace(decServiceNameRegex, decamelize(serviceName, '-'));
      // TODO: let serviceTpl = cloudEvent.data.templates.service
      await repo.writeFile(branch, `helm-chart/templates/${serviceName}-service.yml`, serviceTpl, `[keptn]: Added service yml template for app: ${serviceName}.`, { encode: true }); 
    }
  }

  async createIstioEntry(orgName: string, repo: any, serviceKey : string, serviceName : string, branch: string, chartName: string) {
    // create destination rule
    let destinationRuleTpl = await utils.readFileContent(GitHubService.destinationRuleTplFile);
    destinationRuleTpl = Mustache.render(destinationRuleTpl, {
      serviceName: serviceKey,
      chartName,
      environment: branch,
    });
    await repo.writeFile(branch, `helm-chart/templates/istio-destination-rule-${serviceName}.yml`, destinationRuleTpl, `[keptn]: Added istio destination rule for ${serviceName}.`, { encode: true });

    // create istio virtual service
    let virtualServiceTpl = await utils.readFileContent(GitHubService.virtualServiceTplFile);
    virtualServiceTpl = Mustache.render(virtualServiceTpl, {
      gitHubOrg: orgName,
      serviceName: serviceKey,
      chartName,
      environment: branch,
      // TODO: ingressGatewayIP: istioIngressGatewayService.ip
    });
    await repo.writeFile(branch, `helm-chart/templates/istio-virtual-service-${serviceName}.yml`, virtualServiceTpl, `[keptn]: Added istio virtual service for ${serviceName}.`, { encode: true });
  }

  async createBlueGreenDeployment(repo: any, serviceName : string, decamelizedServiceName : string, branch: string, templateContent: any, template: any) {

    const replaceRegex = new RegExp(serviceName, 'g');
    const tmpRegex = new RegExp('selector-' + decamelizedServiceName, 'g');
    const decamelizedServiceNameRegex = new RegExp(decamelizedServiceName, 'g');
    const tmpString : string = uuid();

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
