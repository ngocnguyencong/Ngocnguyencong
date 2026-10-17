import type { AppLocale } from "@supastack/i18n";

/**
 * Localized chrome copy for the public resource pages (`/changelog`,
 * `/roadmap`, `/api-reference`) — same `Record<AppLocale, …>` convention as
 * `DOCS_COPY` in `src/resources/docs-copy.ts`. Scope is deliberate: only the
 * page chrome (headings, intros, badges, status/access labels, CTA) is
 * translated; changelog entries and roadmap items are curated English data.
 * Sentences carrying inline links or code use `{placeholder}` templates and
 * split at render time, like `setupSentence` does in the docs pages.
 */
const en = {
  /** First breadcrumb item on the resource pages. */
  home: "Home",
  changelog: {
    title: "Changelog",
    description:
      "Shipped changes to the supastack boilerplate demo, newest first — features and improvements across the web app, mobile app, desktop shell, and docs.",
    intro:
      "What shipped in the boilerplate demo, newest first. Entries describe outcomes — the documentation covers the details.",
    latestBadge: "Latest",
  },
  roadmap: {
    title: "Roadmap",
    description:
      "What the supastack boilerplate demo ships today, what is in progress, and what is planned next — a curated public roadmap without promised dates.",
    intro:
      "What the demo ships today, what is in progress, and what is planned. Curated and neutral — no dates are promised.",
    statusLabels: {
      shipped: "Shipped",
      in_progress: "In progress",
      planned: "Planned",
    },
    /** Closing CTA — `{featureBoard}` is replaced by the /feedback link. */
    cta: "Signed-in workspace members shape this list — submit and vote on requests on the {featureBoard}.",
    ctaFeatureBoard: "feature board",
  },
  apiReference: {
    title: "API reference",
    description:
      "Every endpoint in the versioned /api/v1 REST API — method, path, summary, and authentication — rendered from the deployment's own OpenAPI document.",
    /** `{openApiLink}` + `{docsLink}` become anchors at render time. */
    intro:
      "Every operation in the versioned REST API, rendered from the {openApiLink}. An interactive viewer lives at {docsLink}.",
    introOpenApiLink: "published OpenAPI document",
    introDocsLink: "/api/docs",
    authHeading: "Authentication",
    /** `{bearerKey}` becomes an inline <code> element at render time. */
    authBody:
      "Endpoints accept an authenticated app session or an {bearerKey} scoped API key issued per workspace in Settings → Developers. Key callers act inside the key's workspace; writes additionally need the write scope.",
    authBearerKey: "Authorization: Bearer sk_…",
    /** Endpoint access labels keyed by `ApiReferenceAccess`. */
    accessLabels: {
      "session-or-key": "Session or Bearer sk_ key",
      public: "Public",
    },
  },
};
export type ResourceCopy = typeof en;

export const RESOURCE_COPY: Record<AppLocale, ResourceCopy> = {
  en,
  de: {
    home: "Startseite",
    changelog: {
      title: "Changelog",
      description:
        "Veröffentlichte Änderungen an der supastack-Boilerplate-Demo, neueste zuerst — Funktionen und Verbesserungen in Web-App, mobiler App, Desktop-Shell und Dokumentation.",
      intro:
        "Was in der Boilerplate-Demo veröffentlicht wurde, neueste zuerst. Die Einträge beschreiben Ergebnisse — die Dokumentation liefert die Details.",
      latestBadge: "Neueste",
    },
    roadmap: {
      title: "Roadmap",
      description:
        "Was die supastack-Boilerplate-Demo heute bietet, was in Arbeit ist und was als Nächstes geplant ist — eine kuratierte öffentliche Roadmap ohne versprochene Termine.",
      intro:
        "Was die Demo heute bietet, was in Arbeit ist und was geplant ist. Kuratiert und neutral — es werden keine Termine versprochen.",
      statusLabels: {
        shipped: "Veröffentlicht",
        in_progress: "In Arbeit",
        planned: "Geplant",
      },
      cta: "Angemeldete Workspace-Mitglieder gestalten diese Liste mit — reiche Anfragen im {featureBoard} ein und stimme ab.",
      ctaFeatureBoard: "Feature-Board",
    },
    apiReference: {
      title: "API-Referenz",
      description:
        "Jeder Endpunkt der versionierten /api/v1-REST-API — Methode, Pfad, Zusammenfassung und Authentifizierung — gerendert aus dem eigenen OpenAPI-Dokument der Bereitstellung.",
      intro:
        "Jede Operation der versionierten REST-API, gerendert aus dem {openApiLink}. Eine interaktive Ansicht gibt es unter {docsLink}.",
      introOpenApiLink: "veröffentlichten OpenAPI-Dokument",
      introDocsLink: "/api/docs",
      authHeading: "Authentifizierung",
      authBody:
        "Endpunkte akzeptieren eine authentifizierte App-Sitzung oder einen pro Workspace unter Einstellungen → Entwickler ausgestellten {bearerKey}-API-Schlüssel mit Scopes. Aufrufe mit Schlüssel agieren im Workspace des Schlüssels; Schreibvorgänge benötigen zusätzlich den Write-Scope.",
      authBearerKey: "Authorization: Bearer sk_…",
      accessLabels: {
        "session-or-key": "Sitzung oder Bearer-sk_-Schlüssel",
        public: "Öffentlich",
      },
    },
  },
  es: {
    home: "Inicio",
    changelog: {
      title: "Registro de cambios",
      description:
        "Cambios publicados en la demo de plantilla supastack, los más recientes primero: funciones y mejoras en la app web, la app móvil, el shell de escritorio y la documentación.",
      intro:
        "Lo que se publicó en la demo de plantilla, lo más reciente primero. Las entradas describen resultados: la documentación cubre los detalles.",
      latestBadge: "Último",
    },
    roadmap: {
      title: "Hoja de ruta",
      description:
        "Lo que la demo de plantilla supastack ofrece hoy, lo que está en progreso y lo que está planeado después: una hoja de ruta pública sin fechas prometidas.",
      intro:
        "Lo que la demo ofrece hoy, lo que está en progreso y lo que está planeado. Curada y neutral: no se prometen fechas.",
      statusLabels: {
        shipped: "Publicado",
        in_progress: "En progreso",
        planned: "Planeado",
      },
      cta: "Los miembros del espacio de trabajo con sesión iniciada dan forma a esta lista: envía solicitudes y vota en el {featureBoard}.",
      ctaFeatureBoard: "tablero de funciones",
    },
    apiReference: {
      title: "Referencia de API",
      description:
        "Cada endpoint de la API REST versionada /api/v1: método, ruta, resumen y autenticación, renderizado desde el propio documento OpenAPI del despliegue.",
      intro:
        "Cada operación de la API REST versionada, renderizada desde el {openApiLink}. Hay un visor interactivo en {docsLink}.",
      introOpenApiLink: "documento OpenAPI publicado",
      introDocsLink: "/api/docs",
      authHeading: "Autenticación",
      authBody:
        "Los endpoints aceptan una sesión de aplicación autenticada o una clave de API con ámbitos {bearerKey} emitida por espacio de trabajo en Configuración → Desarrolladores. Quienes llaman con clave actúan dentro del espacio de esa clave; las escrituras además necesitan el ámbito de escritura.",
      authBearerKey: "Authorization: Bearer sk_…",
      accessLabels: {
        "session-or-key": "Sesión o clave Bearer sk_",
        public: "Público",
      },
    },
  },
  fr: {
    home: "Accueil",
    changelog: {
      title: "Journal des modifications",
      description:
        "Changements publiés dans la démo du boilerplate supastack, du plus récent au plus ancien — fonctionnalités et améliorations de l'app web, de l'app mobile, du shell desktop et de la documentation.",
      intro:
        "Ce qui a été publié dans la démo du boilerplate, du plus récent au plus ancien. Les entrées décrivent les résultats — la documentation couvre les détails.",
      latestBadge: "Récent",
    },
    roadmap: {
      title: "Feuille de route",
      description:
        "Ce que la démo du boilerplate supastack propose aujourd'hui, ce qui est en cours et ce qui est prévu ensuite — une feuille de route publique sans dates promises.",
      intro:
        "Ce que la démo propose aujourd'hui, ce qui est en cours et ce qui est prévu. Contenu neutre et sélectionné — aucune date n'est promise.",
      statusLabels: {
        shipped: "Publié",
        in_progress: "En cours",
        planned: "Prévu",
      },
      cta: "Les membres connectés d'un espace de travail façonnent cette liste — soumettez des demandes et votez sur le {featureBoard}.",
      ctaFeatureBoard: "tableau des fonctionnalités",
    },
    apiReference: {
      title: "Référence de l'API",
      description:
        "Chaque endpoint de l'API REST versionnée /api/v1 — méthode, chemin, résumé et authentification — généré depuis le document OpenAPI du déploiement.",
      intro:
        "Chaque opération de l'API REST versionnée, générée depuis le {openApiLink}. Un visualiseur interactif est disponible sur {docsLink}.",
      introOpenApiLink: "document OpenAPI publié",
      introDocsLink: "/api/docs",
      authHeading: "Authentification",
      authBody:
        "Les endpoints acceptent une session d'application authentifiée ou une clé d'API {bearerKey} à portée limitée, émise par espace de travail dans Paramètres → Développeurs. Les appels par clé agissent dans l'espace de travail de la clé ; les écritures exigent en plus la portée d'écriture.",
      authBearerKey: "Authorization: Bearer sk_…",
      accessLabels: {
        "session-or-key": "Session ou clé Bearer sk_",
        public: "Public",
      },
    },
  },
};
