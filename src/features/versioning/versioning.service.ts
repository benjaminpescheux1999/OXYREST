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

function buildEspaceClientFeature(columnProfile: "minimal" | "extended"): FeatureDefinition {
  const minimalColumns: FeatureColumnRight[] = [
    { name: "CLIEN", rights: ["read"] },
    { name: "NOM", rights: ["read"] },
    { name: "PRENO", rights: ["read"] }
  ];
  const extendedColumns: FeatureColumnRight[] = [
    ...minimalColumns,
    { name: "TELDO", rights: ["read"] },
    { name: "TELPO", rights: ["read"] },
    { name: "TELTR", rights: ["read"] },
    { name: "CONTR", rights: ["read"] },
    { name: "NUMRU", rights: ["read"] },
    { name: "QUARU", rights: ["read"] },
    { name: "RUE1", rights: ["read"] },
    { name: "VILLE", rights: ["read"] },
    { name: "CODPO", rights: ["read"] },
    { name: "RENOU", rights: ["read"] }
  ];
  return {
    name: "Espace client",
    code: "espace_client",
    description: "Expose les donnees client pour espace web client final.",
    endpoints: [
      "GET /client/espace-client/client/:clientId",
      "GET /client/espace-client/client/:clientId/factures",
      "GET /client/espace-client/facture/:factureId"
    ],
    resources: [
      {
        database: "SA_GAZSRV",
        table: "CLIEN",
        columns: columnProfile === "extended" ? extendedColumns : minimalColumns
      },
      {
        database: "SA_GAZSRV",
        table: "FACTU",
        columns: [
          { name: "CLE", rights: ["read"] },
          { name: "TYPE", rights: ["read"] },
          { name: "CLIEN", rights: ["read"] },
          { name: "NOM", rights: ["read"] },
          { name: "ADRES_1_", rights: ["read"] },
          { name: "ADRES_2_", rights: ["read"] },
          { name: "ADRES_3_", rights: ["read"] },
          { name: "TOHT", rights: ["read"] },
          { name: "TOTVA", rights: ["read"] },
          { name: "TOTTC", rights: ["read"] }
        ]
      },
      {
        database: "SA_GAZSRV",
        table: "CORFA",
        columns: [
          { name: "CLE", rights: ["read"] },
          { name: "DESIG", rights: ["read"] },
          { name: "QUANT", rights: ["read"] },
          { name: "PRIBR", rights: ["read"] },
          { name: "REMIS", rights: ["read"] },
          { name: "PRINE", rights: ["read"] },
          { name: "PAYEU", rights: ["read"] },
          { name: "DATEF", rights: ["read"] },
          { name: "TATVA", rights: ["read"] },
          { name: "MONTA", rights: ["read"] },
          { name: "TTC", rights: ["read"] }
        ]
      }
    ]
  };
}

function buildFeatureCatalog(featureSet: FeatureSetId): FeatureDefinition[] {
  switch (featureSet) {
    case "espace_client_v100":
      return [buildEspaceClientFeature("minimal")];
    case "espace_client_v101_plus":
      return [buildEspaceClientFeature("extended")];
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

