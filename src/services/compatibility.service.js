const { apiVersions, minSupportedUtilityVersion } = require("../config");
const { compareSemver } = require("../utils/version");

function getFeatureCatalog(apiVersion) {
  if (apiVersion !== "v1") return [];
  return [
    {
      name: "Espace client",
      code: "espace_client",
      description: "Expose les donnees client/facturation pour consultation.",
      resources: [
        {
          database: "SA_GAZSRV",
          table: "CLIEN",
          columns: [
            { name: "*", rights: ["read"] },
            { name: "TELDO", rights: ["write"] }
          ]
        },
        {
          database: "SA_GAZSRV",
          table: "FACTU",
          columns: [
            { name: "*", rights: ["read"] }
          ]
        }
      ]
    }
  ];
}

function resolveApiVersionForUtilityVersion(utilityVersion) {
  const supported = compareSemver(utilityVersion, minSupportedUtilityVersion) >= 0;
  if (!supported) {
    return {
      isSupported: false,
      apiVersion: null,
      message: `Version utilitaire non supportee. Min requis: ${minSupportedUtilityVersion}`
    };
  }

  // Extension future: map ranges -> versions API.
  return {
    isSupported: true,
    apiVersion: apiVersions[0],
    message: "OK",
    featureCatalog: getFeatureCatalog(apiVersions[0])
  };
}

module.exports = { resolveApiVersionForUtilityVersion, getFeatureCatalog };

