export interface TreeModel {
  sha: string;
  url: string;
  tree: TreeItem[];
}

export interface TreeItem {
  path: string;
  type: string;
  sha: string;
  url: string;
}
