export type ApiVersion = "1.0.0.0" | "1.0.0.1";

export type Right = "read" | "write";

export interface FeatureColumnRight {
  name: string;
  rights: Right[];
}

export interface FeatureResource {
  database: string;
  table: string;
  columns: FeatureColumnRight[];
}

export interface FeatureDefinition {
  name: string;
  code: string;
  description: string;
  siteUrl?: string;
  endpoints: string[];
  resources: FeatureResource[];
}

export interface UtilityContract {
  isSupported: boolean;
  apiVersion: ApiVersion | null;
  message: string;
  featureCatalog: FeatureDefinition[];
}

