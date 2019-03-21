import { ApiModel, ApiModelProperty, SwaggerDefinitionConstant } from 'swagger-express-ts';

@ApiModel({
  description: '',
  name: 'ShipyardModel',
})
export class ShipyardModel {
  project: string;
  registry: string;
  stages: Stage[];
}

export class Stage {
  name: string;
  deployment_strategy: string;
  test_strategy: string;
}
