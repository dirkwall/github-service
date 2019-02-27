import { CreateProjectRequest } from '../types/CreateProjectRequest';
import { OnboardServiceRequest } from '../types/OnboardServiceRequest';

export interface SourceOperator {
  createProject(gitHubOrgName : string, payload : CreateProjectRequest): Promise<void>;
  onboardService(gitHubOrgName : string, payload : OnboardServiceRequest): Promise<void>; 
}
