export interface CreateProjectRequest {
  data : Data;
}

export interface Data {
  project: string;
  stages: Stage[];
}

export interface Stage {
  name: string;
  deployment_strategy: string;
}