import { config } from "../../config";
import type { FeatureColumnRight, FeatureDefinition, UtilityContract } from "../../types";
import { compareSemver } from "../../utils/semver";

type FeatureSetId = "espace_client_v100" | "espace_client_v101_plus";

interface UtilityVersionPolicy {
  minVersion: string;
  maxVersionExclusive?: string;
  apiVersion: UtilityContract["apiVersion"];
  message: string;
  featureSet: FeatureSetId;
}

const versionPolicies: UtilityVersionPolicy[] = [
  {
    minVersion: "0.1.0.0",
    maxVersionExclusive: "0.1.0.1",
    apiVersion: "1.0.0.0",
    message: "OK",
    featureSet: "espace_client_v100"
  },
  {
    minVersion: "0.1.0.1",
    maxVersionExclusive: "0.1.0.2",
    apiVersion: "1.0.0.0",
    message: "OK",
    featureSet: "espace_client_v101_plus"
  },
  {
    minVersion: "0.1.0.2",
    apiVersion: "1.0.0.1",
    message: "OK",
    featureSet: "espace_client_v101_plus"
  }
];

function buildEspaceClientFeature(includeTeldo: boolean): FeatureDefinition {
  const extraColumns: FeatureColumnRight[] = includeTeldo ? [{ name: "TELDO", rights: ["read"] }] : [];
  return {
    name: "Espace client",
    code: "espace_client",
    description: "Expose les donnees client pour espace web client final.",
    endpoints: ["GET /client/espace-client/client/:clientId"],
    resources: [
      {
        database: "SA_GAZSRV",
        table: "CLIEN",
        columns: [
          { name: "CLIEN", rights: ["read"] },
          { name: "NOM", rights: ["read"] },
          { name: "PRENO", rights: ["read"] },
          ...extraColumns
        ]
      }
    ]
  };
}

function buildFeatureCatalog(featureSet: FeatureSetId): FeatureDefinition[] {
  switch (featureSet) {
    case "espace_client_v100":
      return [buildEspaceClientFeature(false)];
    case "espace_client_v101_plus":
      return [buildEspaceClientFeature(true)];
    default:
      return [];
  }
}

function resolvePolicy(utilityVersion: string): UtilityVersionPolicy | null {
  for (const p of versionPolicies) {
    const aboveMin = compareSemver(utilityVersion, p.minVersion) >= 0;
    const belowMax = !p.maxVersionExclusive || compareSemver(utilityVersion, p.maxVersionExclusive) < 0;
    if (aboveMin && belowMax) return p;
  }
  return null;
}

export function resolveUtilityContract(utilityVersion: string): UtilityContract {
  const supported = compareSemver(utilityVersion, config.minSupportedUtilityVersion) >= 0;
  if (!supported) {
    return {
      isSupported: false,
      apiVersion: null,
      message: `Version utilitaire non supportee. Min requis: ${config.minSupportedUtilityVersion}`,
      featureCatalog: []
    };
  }

  const policy = resolvePolicy(utilityVersion);
  if (!policy) {
    return {
      isSupported: false,
      apiVersion: null,
      message: `Version utilitaire non mappée. Version reçue: ${utilityVersion}`,
      featureCatalog: []
    };
  }

  return {
    isSupported: true,
    apiVersion: policy.apiVersion,
    message: policy.message,
    featureCatalog: buildFeatureCatalog(policy.featureSet)
  };
}

