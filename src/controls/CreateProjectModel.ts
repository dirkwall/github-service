import { Shipyard } from '../types/ShipyardModel';
import { ApiModel, ApiModelProperty, SwaggerDefinitionConstant } from 'swagger-express-ts';

@ApiModel({
  description: '',
  name: 'CreateProjectModel',
})
export class CreateProjectModel {
  @ApiModelProperty({
    description: 'Object containing the required shipyard',
    example: [{
      project: 'Sockshop',
      stages: 'List of stage definitions',
    }],
    type: SwaggerDefinitionConstant.Model.Type.OBJECT,
    required: true,
  })
  data : Shipyard;
}
