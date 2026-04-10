import { config } from "../../config";
import type { FeatureColumnRight, FeatureDefinition, Right, UtilityContract } from "../../types";
import { compareSemver } from "../../utils/semver";

type FeatureSetId = "espace_client_v100" | "espace_client_v101_plus" | "espace_client_v117_plus" | "espace_client_v118_plus" | "espace_client_v119_plus";

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
    maxVersionExclusive: "0.1.0.17",
    apiVersion: "1.0.0.1",
    message: "OK",
    featureSet: "espace_client_v101_plus"
  },
  {
    minVersion: "0.1.0.17",
    maxVersionExclusive: "0.1.0.18",
    apiVersion: "1.0.0.1",
    message: "OK",
    featureSet: "espace_client_v117_plus"
  },
  {
    minVersion: "0.1.0.18",
    maxVersionExclusive: "0.1.0.19",
    apiVersion: "1.0.0.1",
    message: "OK",
    featureSet: "espace_client_v118_plus"
  },
  {
    minVersion: "0.1.0.19",
    apiVersion: "1.0.0.1",
    message: "OK",
    featureSet: "espace_client_v119_plus"
  }
];

function normalizeFolders(raw: string[]): string[] {
  return (raw || [])
    .map((x) => String(x || "").trim().toUpperCase())
    .filter((x) => !!x)
    .filter((x, i, arr) => arr.findIndex((v) => v.toUpperCase() === x) === i);
}

function buildEspaceClientFeature(
  columnProfile: "minimal" | "extended",
  folders: string[],
  includeAppar: boolean,
  includeApparQuant: boolean,
  includeReglements: boolean
): FeatureDefinition {
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
  const apparColumns: FeatureColumnRight[] = [
    { name: "APPAR", rights: ["read"] as Right[] },
    { name: "INSTA", rights: ["read"] as Right[] },
    { name: "EMPLA", rights: ["read"] as Right[] },
    { name: "OBSER", rights: ["read"] as Right[] },
    { name: "MARQU", rights: ["read"] as Right[] },
    { name: "MODEL", rights: ["read"] as Right[] },
    { name: "GENRE", rights: ["read"] as Right[] },
    { name: "SERIE", rights: ["read"] as Right[] },
    { name: "PUISS", rights: ["read"] as Right[] },
    { name: "ENERG", rights: ["read"] as Right[] },
    { name: "DEGAR", rights: ["read"] as Right[] },
    { name: "FIGAR", rights: ["read"] as Right[] },
    { name: "GARAN", rights: ["read"] as Right[] },
    { name: "CONTR", rights: ["read"] as Right[] },
    { name: "DAMES", rights: ["read"] as Right[] },
    { name: "INTAL", rights: ["read"] as Right[] },
    { name: "DUREE", rights: ["read"] as Right[] },
    { name: "VENDE", rights: ["read"] as Right[] },
    { name: "PRINC", rights: ["read"] as Right[] },
    { name: "TARIF", rights: ["read"] as Right[] },
    { name: "PRICO", rights: ["read"] as Right[] },
    { name: "PARCO", rights: ["read"] as Right[] },
    { name: "ORDR", rights: ["read"] as Right[] }
  ];
  if (includeApparQuant) {
    apparColumns.push({ name: "QUANT", rights: ["read"] as Right[] });
  }
  const hreglColumns: FeatureColumnRight[] = [
    { name: "PAYEU", rights: ["read"] as Right[] },
    { name: "DATRE", rights: ["read"] as Right[] },
    { name: "VERSE", rights: ["read"] as Right[] },
    { name: "MONNA", rights: ["read"] as Right[] },
    { name: "TATVA", rights: ["read"] as Right[] },
    { name: "BANQUE", rights: ["read"] as Right[] },
    { name: "CHEQUE", rights: ["read"] as Right[] },
    { name: "VILLE", rights: ["read"] as Right[] },
    { name: "VERSA", rights: ["read"] as Right[] },
    { name: "REMISE", rights: ["read"] as Right[] },
    { name: "DATEREMISE", rights: ["read"] as Right[] },
    { name: "INCIDENT", rights: ["read"] as Right[] },
    { name: "DATINCIDENT", rights: ["read"] as Right[] }
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
    },
    ...(includeAppar ? [{
      database: `SA_${folder}`,
      table: "APPAR",
      columns: apparColumns
    }] : []),
    ...(includeReglements ? [{
      database: `SA_${folder}`,
      table: "HREGL",
      columns: hreglColumns
    }] : [])
  ]);

  return {
    name: "Espace client",
    code: "espace_client",
    description: "Expose les donnees client pour espace web client final.",
    siteUrl: config.espaceClientPublicUrl,
    endpoints: [
      "GET /client/espace-client/client/:clientId",
      "PUT /client/espace-client/client/:clientId",
      "GET /client/espace-client/client/:clientId/factures",
      "GET /client/espace-client/facture/:factureId",
      ...(includeAppar ? ["GET /client/espace-client/client/:clientId/appareils"] : []),
      ...(includeReglements ? ["GET /client/espace-client/client/:clientId/reglements"] : [])
    ],
    resources
  };
}

function buildFeatureCatalog(featureSet: FeatureSetId, folders: string[]): FeatureDefinition[] {
  switch (featureSet) {
    case "espace_client_v100":
      return [buildEspaceClientFeature("minimal", folders, false, false, false)];
    case "espace_client_v101_plus":
      return [buildEspaceClientFeature("extended", folders, false, false, false)];
    case "espace_client_v117_plus":
      return [buildEspaceClientFeature("extended", folders, true, false, false)];
    case "espace_client_v118_plus":
      return [buildEspaceClientFeature("extended", folders, true, true, false)];
    case "espace_client_v119_plus":
      return [buildEspaceClientFeature("extended", folders, true, true, true)];
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

