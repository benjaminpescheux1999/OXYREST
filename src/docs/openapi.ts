export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "OxyRest API",
    version: "1.0.0",
    description:
      "API OXYDRIVER avec 3 niveaux: SuperAdmin (plateforme), Admin (vos clients), Client (clients finaux)."
  },
  servers: [{ url: "/", description: "Same host" }],
  tags: [
    { name: "SuperAdmin", description: "Gestion globale des clés API (vous)." },
    { name: "Admin", description: "Actions client administrateur (bind/rotate/provision)." },
    { name: "Client", description: "Authentification portail client final + données métier." },
    { name: "Utility", description: "Synchronisation utilitaire OXYDRIVER." },
    { name: "System", description: "Santé système, versions, update catalog." }
  ],
  components: {
    securitySchemes: {
      SuperAdminApiKey: {
        type: "apiKey",
        in: "header",
        name: "x-admin-key",
        description: "Clé SuperAdmin pour gérer les tokens plateforme."
      },
      ClientTokenHeader: {
        type: "apiKey",
        in: "header",
        name: "x-client-token",
        description: "Token client lié à un utilitaire."
      },
      ClientAccessBearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token JWT du portail client."
      }
    }
  },
  paths: {
    "/admin/tokens": {
      get: {
        tags: ["SuperAdmin"],
        summary: "Lister les tokens d'accès utilitaire",
        security: [{ SuperAdminApiKey: [] }],
        responses: {
          "200": { description: "Liste des tokens" },
          "401": { description: "Non autorisé" }
        }
      },
      post: {
        tags: ["SuperAdmin"],
        summary: "Créer un token d'accès utilitaire",
        security: [{ SuperAdminApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["folders"],
                properties: {
                  label: { type: "string", example: "Client Brest (optionnel)" },
                  folders: {
                    type: "array",
                    items: { type: "string" },
                    example: ["GAZSRV", "GAZSRV2"]
                  },
                  scopes: {
                    type: "array",
                    items: { type: "string" },
                    example: ["sync", "proxy"]
                  }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Token créé (retourne aussi le mot de passe interface par défaut)" },
          "400": { description: "Payload invalide" },
          "409": { description: "Label déjà utilisé (doit être unique)" },
          "401": { description: "Non autorisé" }
        }
      }
    },
    "/admin/tokens/reset-ui-password": {
      post: {
        tags: ["SuperAdmin"],
        summary: "Réinitialiser le mot de passe interface d'un token via son label",
        security: [{ SuperAdminApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["label"],
                properties: {
                  label: { type: "string", example: "Client Brest" },
                  newPassword: { type: "string", example: "oxy-ab12cd34" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Mot de passe réinitialisé" },
          "400": { description: "Payload invalide" },
          "401": { description: "Non autorisé" },
          "404": { description: "Label introuvable" }
        }
      }
    },
    "/admin/tokens/{tokenId}/revoke": {
      post: {
        tags: ["SuperAdmin"],
        summary: "Révoquer un token",
        security: [{ SuperAdminApiKey: [] }],
        parameters: [{ name: "tokenId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Token révoqué" },
          "401": { description: "Non autorisé" },
          "404": { description: "Token introuvable" }
        }
      }
    },
    "/utility/negotiate": {
      post: {
        tags: ["Utility"],
        summary: "Négocier la version API compatible utilitaire",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["utilityVersion", "accessKey"],
                properties: {
                  utilityVersion: { type: "string", example: "0.1.0.1" },
                  accessKey: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Version supportée" },
          "426": { description: "Version utilitaire non supportée" }
        }
      }
    },
    "/utility/sync": {
      post: {
        tags: ["Utility"],
        summary: "Synchroniser état utilitaire (tunnel, capabilities, features)",
        responses: {
          "200": { description: "Synchronisation OK" },
          "401": { description: "Access key invalide/révoquée" },
          "426": { description: "Version non supportée" }
        }
      }
    },
    "/utility/identify": {
      post: {
        tags: ["Utility"],
        summary: "Identifier l'utilitaire lié à une access key",
        responses: {
          "200": { description: "Utilitaire trouvé" },
          "404": { description: "Utilitaire non trouvé" }
        }
      }
    },
    "/client/bind": {
      post: {
        tags: ["Admin"],
        summary: "Lier un clientToken au bon utilitaire",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["clientToken", "accessKey"],
                properties: { clientToken: { type: "string" }, accessKey: { type: "string" } }
              }
            }
          }
        },
        responses: {
          "200": { description: "Binding OK" },
          "401": { description: "Access key invalide/révoquée" }
        }
      }
    },
    "/client/rotate": {
      post: {
        tags: ["Admin"],
        summary: "Régénérer un clientToken et invalider l'ancien",
        responses: {
          "200": { description: "Rotation OK" },
          "401": { description: "Access key invalide/révoquée" }
        }
      }
    },
    "/client/espace-client/adminClient/create": {
      post: {
        tags: ["Admin"],
        summary: "Créer un compte portail client final",
        responses: { "200": { description: "Compte créé" }, "401": { description: "Non autorisé" } }
      }
    },
    "/client/espace-client/auth/login": {
      post: {
        tags: ["Client"],
        summary: "Login client final (renvoie accessToken + pose refresh cookie)",
        security: [{ ClientTokenHeader: [] }],
        responses: { "200": { description: "Connecté" }, "401": { description: "Identifiants invalides" } }
      }
    },
    "/client/espace-client/auth/refresh": {
      post: {
        tags: ["Client"],
        summary: "Renouveler l'access token via refresh cookie HttpOnly",
        security: [{ ClientTokenHeader: [] }],
        responses: { "200": { description: "Token rafraîchi" }, "401": { description: "Refresh invalide/expiré" } }
      }
    },
    "/client/espace-client/auth/logout": {
      post: {
        tags: ["Client"],
        summary: "Logout client final et révocation session refresh",
        responses: { "200": { description: "Déconnecté" } }
      }
    },
    "/client/espace-client/auth/me": {
      get: {
        tags: ["Client"],
        summary: "Récupérer session courante",
        security: [{ ClientAccessBearer: [] }],
        responses: { "200": { description: "Session active" }, "401": { description: "Session invalide" } }
      }
    },
    "/client/espace-client/client/{clientId}": {
      get: {
        tags: ["Client"],
        summary: "Récupérer les données client (proxy vers utilitaire)",
        security: [{ ClientTokenHeader: [] }, { ClientAccessBearer: [] }],
        parameters: [{ name: "clientId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Client trouvé" }, "502": { description: "Erreur proxy utilitaire" } }
      }
    },
    "/client/espace-client/client/{clientId}/factures": {
      get: {
        tags: ["Client"],
        summary: "Lister les factures d'un client (FACTU)",
        security: [{ ClientTokenHeader: [] }, { ClientAccessBearer: [] }],
        parameters: [{ name: "clientId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Factures trouvées" }, "502": { description: "Erreur proxy utilitaire" } }
      }
    },
    "/client/espace-client/facture/{factureId}": {
      get: {
        tags: ["Client"],
        summary: "Récupérer le détail d'une facture (FACTU + CORFA)",
        security: [{ ClientTokenHeader: [] }],
        parameters: [{ name: "factureId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Facture trouvée" }, "502": { description: "Erreur proxy utilitaire" } }
      }
    },
    "/client/espace-client/monitoring/error": {
      post: {
        tags: ["Client"],
        summary: "Reporter une erreur front (LogRocket/email)",
        security: [{ ClientTokenHeader: [] }],
        responses: { "200": { description: "Erreur monitorée" } }
      }
    },
    "/system/health": {
      get: { tags: ["System"], summary: "Healthcheck", responses: { "200": { description: "OK" } } }
    },
    "/system/versions": {
      get: { tags: ["System"], summary: "Versions API/Utility supportées", responses: { "200": { description: "OK" } } }
    },
    "/system/storage": {
      get: { tags: ["System"], summary: "Infos stockage (SQLite)", responses: { "200": { description: "OK" } } }
    },
    "/system/utility-update": {
      get: { tags: ["System"], summary: "Infos de mise à jour utilitaire", responses: { "200": { description: "OK" } } }
    },
    "/system/utility-update/catalog": {
      get: { tags: ["System"], summary: "Catalogue versions utilitaire", responses: { "200": { description: "OK" } } }
    }
  }
} as const;

