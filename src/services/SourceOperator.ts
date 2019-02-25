import { CreateProjectRequest } from '../types/CreateProjectRequest';

export interface SourceOperator {
  createRepository(gitHubOrgName : string, payload : CreateProjectRequest): Promise<void>;

  setHook(gitHubOrgName : string, payload : CreateProjectRequest) : Promise<any>;
  
  initialCommit(gitHubOrgName : string, payload : CreateProjectRequest) : Promise<any>;
  
  createBranchesForEachStages(gitHubOrgName : string, payload : CreateProjectRequest) : Promise<any>;
  
  addShipyardToMaster(gitHubOrgName : string, payload : CreateProjectRequest) : Promise<any>;
}