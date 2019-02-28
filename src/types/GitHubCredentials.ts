export class GitHubCredentials {
  org: string;
  user: string;
  token: string;

  areCredentialsDefined(): boolean {
    return (this.org != undefined && this.user != undefined && this.token != undefined);
  }
}
