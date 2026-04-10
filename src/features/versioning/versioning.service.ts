import { config } from "../../config";
import type { FeatureColumnRight, FeatureDefinition, Right, UtilityContract } from "../../types";
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

function normalizeFolders(raw: string[]): string[] {
  return (raw || [])
    .map((x) => String(x || "").trim().toUpperCase())
    .filter((x) => !!x)
    .filter((x, i, arr) => arr.findIndex((v) => v.toUpperCase() === x) === i);
}

function buildEspaceClientFeature(columnProfile: "minimal" | "extended", folders: string[]): FeatureDefinition {
  const factureColumns: FeatureColumnRight[] = [
    { name: "CLE", rights: ["read"] as Right[] },
    { name: "TYPE", rights: ["read"] as Right[] },
    { name: "CLIEN", rights: ["read"] as Right[] },
    { name: "NOM", rights: ["read"] as Right[] },
    { name: "ADRES_1_", rights: ["read"] as Right[] },
    { name: "ADRES_2_", rights: ["read"] as Right[] },
    { name: "ADRES_3_", rights: ["read"] as Right[] },
    { name: "TOHT", rights: ["read"] as Right[] },
    { name: "TOTVA", rights: ["read"] as Right[] },
    { name: "TOTTC", rights: ["read"] as Right[] }
  ];
  const corfaColumns: FeatureColumnRight[] = [
    { name: "CLE", rights: ["read"] as Right[] },
    { name: "DESIG", rights: ["read"] as Right[] },
    { name: "QUANT", rights: ["read"] as Right[] },
    { name: "PRIBR", rights: ["read"] as Right[] },
    { name: "REMIS", rights: ["read"] as Right[] },
    { name: "PRINE", rights: ["read"] as Right[] },
    { name: "PAYEU", rights: ["read"] as Right[] },
    { name: "DATEF", rights: ["read"] as Right[] },
    { name: "TATVA", rights: ["read"] as Right[] },
    { name: "MONTA", rights: ["read"] as Right[] },
    { name: "TTC", rights: ["read"] as Right[] }
  ];
  const normalizedFolders = normalizeFolders(folders);
  const minimalColumns: FeatureColumnRight[] = [
    { name: "CLIEN", rights: ["read"] },
    { name: "NOM", rights: ["read"] },
    { name: "PRENO", rights: ["read"] }
  ];
  const extendedColumns: FeatureColumnRight[] = [
    ...minimalColumns,
    { name: "TELDO", rights: ["read", "write"] },
    { name: "TELPO", rights: ["read", "write"] },
    { name: "TELTR", rights: ["read", "write"] },
    { name: "EMAIL", rights: ["read", "write"] },
    { name: "CONTR", rights: ["read"] },
    { name: "NUMRU", rights: ["read"] },
    { name: "QUARU", rights: ["read"] },
    { name: "RUE1", rights: ["read"] },
    { name: "VILLE", rights: ["read"] },
    { name: "CODPO", rights: ["read"] },
    { name: "RENOU", rights: ["read"] }
  ];
  const resources = normalizedFolders.flatMap((folder) => [
    {
      database: `SA_${folder}`,
      table: "CLIEN",
      columns: columnProfile === "extended" ? extendedColumns : minimalColumns
    },
    {
      database: `SA_${folder}`,
      table: "FACTU",
      columns: factureColumns
    },
    {
      database: `SA_${folder}`,
      table: "CORFA",
      columns: corfaColumns
    }
  ]);

  return {
    name: "Espace client",
    code: "espace_client",
    description: "Expose les donnees client pour espace web client final.",
    endpoints: [
      "GET /client/espace-client/client/:clientId",
      "PUT /client/espace-client/client/:clientId",
      "GET /client/espace-client/client/:clientId/factures",
      "GET /client/espace-client/facture/:factureId"
    ],
    resources
  };
}

function buildFeatureCatalog(featureSet: FeatureSetId, folders: string[]): FeatureDefinition[] {
  switch (featureSet) {
    case "espace_client_v100":
      return [buildEspaceClientFeature("minimal", folders)];
    case "espace_client_v101_plus":
      return [buildEspaceClientFeature("extended", folders)];
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

export function resolveUtilityContract(utilityVersion: string, selectedFolders: string[] = []): UtilityContract {
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
      featureCatalog: buildFeatureCatalog(policy.featureSet, selectedFolders)
  };
}

