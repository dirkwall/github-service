export class Shipyard {
  project: string;
  stages: Stage[];
}

export class Stage {
  name: string;
  deployment_strategy: string;
}
