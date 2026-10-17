import type { AppLocale } from "@supastack/i18n";

export type PreviewStatus = "open" | "in-progress" | "complete";

export type PreviewRecord = {
  key: string;
  reference: string;
  title: string;
  category: string;
  status: PreviewStatus;
  summary: string;
};

export type FoundationPreviewCopy = {
  heading: string;
  description: string;
  tabsLabel: string;
  recordsTab: string;
  detailTab: string;
  statesDisclosure: string;
  stateLegend: string;
  stateReady: string;
  stateLoading: string;
  stateEmpty: string;
  stateError: string;
  disableControls: string;
  disabledAction: string;
  recordsHeading: string;
  detailHeading: string;
  tableControls: string;
  searchLabel: string;
  statusFilter: string;
  allStatuses: string;
  statuses: Record<PreviewStatus, string>;
  resultCount: (count: number) => string;
  clearFilters: string;
  actions: string;
  actionClearFilters: string;
  actionFirstPage: string;
  addRecord: string;
  tableCaption: string;
  columnReference: string;
  columnTitle: string;
  columnStatus: string;
  pageLabel: string;
  previousPage: string;
  nextPage: string;
  pageStatus: (page: number, pageCount: number) => string;
  noPages: string;
  loadingMessage: string;
  errorMessage: string;
  emptyMessage: string;
  detailEmpty: string;
  detailEmptyList: string;
  backToRecords: string;
  category: string;
  status: string;
  openDetailsSheet: string;
  sheetTitle: string;
  closeSheet: string;
  dialogTitle: string;
  dialogDescription: string;
  dialogClose: string;
  newRecordLabel: string;
  dialogCancel: string;
  dialogSubmit: string;
  createdCategory: string;
  createdSummary: string;
  records: readonly PreviewRecord[];
};

const en: FoundationPreviewCopy = {
  heading: "Foundation block preview",
  description: "Filter sample records, move between pages, and open a record to see its details.",
  tabsLabel: "Foundation preview sections",
  recordsTab: "Records",
  detailTab: "Master and detail",
  statesDisclosure: "Preview states",
  stateLegend: "Table state",
  stateReady: "Ready",
  stateLoading: "Loading",
  stateEmpty: "Empty",
  stateError: "Error",
  disableControls: "Disable table controls",
  disabledAction: "Disabled action",
  recordsHeading: "Sample records",
  detailHeading: "Select a record",
  tableControls: "Record filters and page controls",
  searchLabel: "Search records",
  statusFilter: "Status",
  allStatuses: "All statuses",
  statuses: { open: "Open", "in-progress": "In progress", complete: "Complete" },
  resultCount: (count) => `${count} ${count === 1 ? "record" : "records"}`,
  clearFilters: "Clear filters",
  actions: "Actions",
  actionClearFilters: "Clear filters",
  actionFirstPage: "Go to first page",
  addRecord: "Add sample record",
  tableCaption: "Sample records matching the current filters",
  columnReference: "ID",
  columnTitle: "Title",
  columnStatus: "Status",
  pageLabel: "Record pages",
  previousPage: "Previous page",
  nextPage: "Next page",
  pageStatus: (page, count) => `Page ${page} of ${count}`,
  noPages: "No pages",
  loadingMessage: "Loading sample records…",
  errorMessage: "Unable to load sample records. Choose Ready to try again.",
  emptyMessage: "No records match these filters. Clear filters to see the sample records.",
  detailEmpty: "Choose a record to see its details.",
  detailEmptyList: "No records are available in this view.",
  backToRecords: "Back to records",
  category: "Category",
  status: "Status",
  openDetailsSheet: "Open details sheet",
  sheetTitle: "Record details",
  closeSheet: "Close details",
  dialogTitle: "Add a sample record",
  dialogDescription: "Adding a record updates this local preview only.",
  dialogClose: "Close dialog",
  newRecordLabel: "Record title",
  dialogCancel: "Cancel",
  dialogSubmit: "Add record",
  createdCategory: "Planning",
  createdSummary: "Review this sample record and add a short note.",
  records: [
    {
      key: "record-101",
      reference: "R-101",
      title: "Draft handoff",
      category: "Content",
      status: "open",
      summary: "Review the draft and leave one note for the next editor.",
    },
    {
      key: "record-102",
      reference: "R-102",
      title: "Access check",
      category: "Operations",
      status: "in-progress",
      summary: "Confirm the sample roles on the workspace record.",
    },
    {
      key: "record-103",
      reference: "R-103",
      title: "Release notes",
      category: "Content",
      status: "complete",
      summary: "Collect the changes included in the next update.",
    },
    {
      key: "record-104",
      reference: "R-104",
      title: "Report outline",
      category: "Planning",
      status: "open",
      summary: "Group the notes before writing a short analysis.",
    },
    {
      key: "record-105",
      reference: "R-105",
      title: "Media inventory",
      category: "Operations",
      status: "in-progress",
      summary: "List the media files needed for a sample project.",
    },
    {
      key: "record-106",
      reference: "R-106",
      title: "Feedback review",
      category: "Support",
      status: "complete",
      summary: "Group sample feedback by topic and status.",
    },
    {
      key: "record-107",
      reference: "R-107",
      title: "Import mapping",
      category: "Operations",
      status: "open",
      summary: "Check how fields map between two sample lists.",
    },
    {
      key: "record-108",
      reference: "R-108",
      title: "Setup guide",
      category: "Planning",
      status: "in-progress",
      summary: "Write the steps for a first-time configuration.",
    },
  ],
};

const de: FoundationPreviewCopy = {
  ...en,
  heading: "Vorschau der Foundation-Blöcke",
  description: "Beispielfälle filtern, Seiten wechseln und einen Fall mit Details öffnen.",
  tabsLabel: "Bereiche der Foundation-Vorschau",
  recordsTab: "Einträge",
  detailTab: "Liste und Detailansicht",
  statesDisclosure: "Vorschauzustände",
  stateLegend: "Tabellenzustand",
  stateReady: "Bereit",
  stateLoading: "Wird geladen",
  stateEmpty: "Leer",
  stateError: "Fehler",
  disableControls: "Tabellensteuerelemente deaktivieren",
  disabledAction: "Deaktivierte Aktion",
  recordsHeading: "Beispieleinträge",
  detailHeading: "Eintrag auswählen",
  tableControls: "Filter und Seitensteuerung für Einträge",
  searchLabel: "Einträge suchen",
  statusFilter: "Status",
  allStatuses: "Alle Status",
  statuses: { open: "Offen", "in-progress": "In Bearbeitung", complete: "Abgeschlossen" },
  resultCount: (count) => `${count} ${count === 1 ? "Eintrag" : "Einträge"}`,
  clearFilters: "Filter löschen",
  actions: "Aktionen",
  actionClearFilters: "Filter löschen",
  actionFirstPage: "Zur ersten Seite",
  addRecord: "Beispieleintrag hinzufügen",
  tableCaption: "Beispieleinträge passend zu den aktuellen Filtern",
  columnReference: "ID",
  columnTitle: "Titel",
  columnStatus: "Status",
  pageLabel: "Eintragsseiten",
  previousPage: "Vorherige Seite",
  nextPage: "Nächste Seite",
  pageStatus: (page, count) => `Seite ${page} von ${count}`,
  noPages: "Keine Seiten",
  loadingMessage: "Beispieleinträge werden geladen…",
  errorMessage:
    "Beispieleinträge konnten nicht geladen werden. Wähle Bereit, um es erneut zu versuchen.",
  emptyMessage:
    "Keine Einträge passen zu diesen Filtern. Lösche die Filter, um Beispieleinträge anzuzeigen.",
  detailEmpty: "Wähle einen Eintrag aus, um Details anzuzeigen.",
  detailEmptyList: "In dieser Ansicht sind keine Einträge verfügbar.",
  backToRecords: "Zurück zu den Einträgen",
  category: "Kategorie",
  status: "Status",
  openDetailsSheet: "Details öffnen",
  sheetTitle: "Eintragsdetails",
  closeSheet: "Details schließen",
  dialogTitle: "Beispieleintrag hinzufügen",
  dialogDescription: "Der Eintrag wird nur dieser lokalen Vorschau hinzugefügt.",
  dialogClose: "Dialog schließen",
  newRecordLabel: "Eintragstitel",
  dialogCancel: "Abbrechen",
  dialogSubmit: "Eintrag hinzufügen",
  createdCategory: "Planung",
  createdSummary: "Prüfe diesen Beispieleintrag und ergänze eine kurze Notiz.",
  records: [
    {
      key: "record-101",
      reference: "R-101",
      title: "Entwurfsübergabe",
      category: "Inhalte",
      status: "open",
      summary: "Prüfe den Entwurf und hinterlasse eine Notiz für die nächste Bearbeitung.",
    },
    {
      key: "record-102",
      reference: "R-102",
      title: "Zugriffsprüfung",
      category: "Betrieb",
      status: "in-progress",
      summary: "Prüfe die Beispielrollen für den Arbeitsbereich.",
    },
    {
      key: "record-103",
      reference: "R-103",
      title: "Versionshinweise",
      category: "Inhalte",
      status: "complete",
      summary: "Sammle die Änderungen für die nächste Aktualisierung.",
    },
    {
      key: "record-104",
      reference: "R-104",
      title: "Berichtsentwurf",
      category: "Planung",
      status: "open",
      summary: "Ordne die Notizen vor der kurzen Analyse.",
    },
    {
      key: "record-105",
      reference: "R-105",
      title: "Medienübersicht",
      category: "Betrieb",
      status: "in-progress",
      summary: "Liste die Mediendateien für ein Beispielprojekt auf.",
    },
    {
      key: "record-106",
      reference: "R-106",
      title: "Feedback prüfen",
      category: "Support",
      status: "complete",
      summary: "Ordne das Beispiel-Feedback nach Thema und Status.",
    },
    {
      key: "record-107",
      reference: "R-107",
      title: "Importzuordnung",
      category: "Betrieb",
      status: "open",
      summary: "Prüfe die Feldzuordnung zwischen zwei Beispiellisten.",
    },
    {
      key: "record-108",
      reference: "R-108",
      title: "Einrichtungsanleitung",
      category: "Planung",
      status: "in-progress",
      summary: "Notiere die Schritte für eine erste Konfiguration.",
    },
  ],
};

const es: FoundationPreviewCopy = {
  ...en,
  heading: "Vista previa de bloques de base",
  description:
    "Filtra registros de ejemplo, cambia de página y abre un registro para ver sus detalles.",
  tabsLabel: "Secciones de la vista previa",
  recordsTab: "Registros",
  detailTab: "Lista y detalle",
  statesDisclosure: "Estados de vista previa",
  stateLegend: "Estado de la tabla",
  stateReady: "Listo",
  stateLoading: "Cargando",
  stateEmpty: "Vacío",
  stateError: "Error",
  disableControls: "Desactivar controles de la tabla",
  disabledAction: "Acción desactivada",
  recordsHeading: "Registros de ejemplo",
  detailHeading: "Selecciona un registro",
  tableControls: "Filtros y controles de página de registros",
  searchLabel: "Buscar registros",
  statusFilter: "Estado",
  allStatuses: "Todos los estados",
  statuses: { open: "Abierto", "in-progress": "En curso", complete: "Completado" },
  resultCount: (count) => `${count} ${count === 1 ? "registro" : "registros"}`,
  clearFilters: "Borrar filtros",
  actions: "Acciones",
  actionClearFilters: "Borrar filtros",
  actionFirstPage: "Ir a la primera página",
  addRecord: "Añadir registro de ejemplo",
  tableCaption: "Registros de ejemplo que coinciden con los filtros actuales",
  columnReference: "ID",
  columnTitle: "Título",
  columnStatus: "Estado",
  pageLabel: "Páginas de registros",
  previousPage: "Página anterior",
  nextPage: "Página siguiente",
  pageStatus: (page, count) => `Página ${page} de ${count}`,
  noPages: "No hay páginas",
  loadingMessage: "Cargando registros de ejemplo…",
  errorMessage:
    "No se pudieron cargar los registros de ejemplo. Selecciona Listo para volver a intentarlo.",
  emptyMessage:
    "Ningún registro coincide con estos filtros. Bórralos para ver los registros de ejemplo.",
  detailEmpty: "Selecciona un registro para ver sus detalles.",
  detailEmptyList: "No hay registros disponibles en esta vista.",
  backToRecords: "Volver a los registros",
  category: "Categoría",
  status: "Estado",
  openDetailsSheet: "Abrir detalles",
  sheetTitle: "Detalles del registro",
  closeSheet: "Cerrar detalles",
  dialogTitle: "Añadir un registro de ejemplo",
  dialogDescription: "El registro solo se añade a esta vista previa local.",
  dialogClose: "Cerrar diálogo",
  newRecordLabel: "Título del registro",
  dialogCancel: "Cancelar",
  dialogSubmit: "Añadir registro",
  createdCategory: "Planificación",
  createdSummary: "Revisa este registro de ejemplo y añade una nota breve.",
  records: [
    {
      key: "record-101",
      reference: "R-101",
      title: "Entrega de borrador",
      category: "Contenido",
      status: "open",
      summary: "Revisa el borrador y deja una nota para la siguiente persona editora.",
    },
    {
      key: "record-102",
      reference: "R-102",
      title: "Revisión de acceso",
      category: "Operaciones",
      status: "in-progress",
      summary: "Confirma los roles de ejemplo del espacio de trabajo.",
    },
    {
      key: "record-103",
      reference: "R-103",
      title: "Notas de versión",
      category: "Contenido",
      status: "complete",
      summary: "Reúne los cambios incluidos en la próxima actualización.",
    },
    {
      key: "record-104",
      reference: "R-104",
      title: "Esquema del informe",
      category: "Planificación",
      status: "open",
      summary: "Organiza las notas antes de redactar un análisis breve.",
    },
    {
      key: "record-105",
      reference: "R-105",
      title: "Inventario multimedia",
      category: "Operaciones",
      status: "in-progress",
      summary: "Enumera los archivos multimedia necesarios para un proyecto de ejemplo.",
    },
    {
      key: "record-106",
      reference: "R-106",
      title: "Revisión de comentarios",
      category: "Soporte",
      status: "complete",
      summary: "Agrupa los comentarios de ejemplo por tema y estado.",
    },
    {
      key: "record-107",
      reference: "R-107",
      title: "Asignación de importación",
      category: "Operaciones",
      status: "open",
      summary: "Comprueba cómo se asignan los campos entre dos listas de ejemplo.",
    },
    {
      key: "record-108",
      reference: "R-108",
      title: "Guía de configuración",
      category: "Planificación",
      status: "in-progress",
      summary: "Anota los pasos de una primera configuración.",
    },
  ],
};

const fr: FoundationPreviewCopy = {
  ...en,
  heading: "Aperçu des blocs de base",
  description:
    "Filtrez les exemples, changez de page et ouvrez un élément pour consulter ses détails.",
  tabsLabel: "Sections de l’aperçu",
  recordsTab: "Éléments",
  detailTab: "Liste et détails",
  statesDisclosure: "États de l’aperçu",
  stateLegend: "État du tableau",
  stateReady: "Prêt",
  stateLoading: "Chargement",
  stateEmpty: "Vide",
  stateError: "Erreur",
  disableControls: "Désactiver les commandes du tableau",
  disabledAction: "Action désactivée",
  recordsHeading: "Éléments d’exemple",
  detailHeading: "Sélectionnez un élément",
  tableControls: "Filtres et commandes de page des éléments",
  searchLabel: "Rechercher des éléments",
  statusFilter: "Statut",
  allStatuses: "Tous les statuts",
  statuses: { open: "Ouvert", "in-progress": "En cours", complete: "Terminé" },
  resultCount: (count) => `${count} ${count === 1 ? "élément" : "éléments"}`,
  clearFilters: "Effacer les filtres",
  actions: "Actions",
  actionClearFilters: "Effacer les filtres",
  actionFirstPage: "Aller à la première page",
  addRecord: "Ajouter un élément d’exemple",
  tableCaption: "Éléments d’exemple correspondant aux filtres actuels",
  columnReference: "ID",
  columnTitle: "Titre",
  columnStatus: "Statut",
  pageLabel: "Pages des éléments",
  previousPage: "Page précédente",
  nextPage: "Page suivante",
  pageStatus: (page, count) => `Page ${page} sur ${count}`,
  noPages: "Aucune page",
  loadingMessage: "Chargement des éléments d’exemple…",
  errorMessage: "Impossible de charger les éléments d’exemple. Sélectionnez Prêt pour réessayer.",
  emptyMessage:
    "Aucun élément ne correspond à ces filtres. Effacez-les pour afficher les exemples.",
  detailEmpty: "Choisissez un élément pour afficher ses détails.",
  detailEmptyList: "Aucun élément n’est disponible dans cette vue.",
  backToRecords: "Retour aux éléments",
  category: "Catégorie",
  status: "Statut",
  openDetailsSheet: "Ouvrir les détails",
  sheetTitle: "Détails de l’élément",
  closeSheet: "Fermer les détails",
  dialogTitle: "Ajouter un élément d’exemple",
  dialogDescription: "L’élément est ajouté uniquement à cet aperçu local.",
  dialogClose: "Fermer le dialogue",
  newRecordLabel: "Titre de l’élément",
  dialogCancel: "Annuler",
  dialogSubmit: "Ajouter l’élément",
  createdCategory: "Planification",
  createdSummary: "Vérifiez cet élément d’exemple et ajoutez une courte note.",
  records: [
    {
      key: "record-101",
      reference: "R-101",
      title: "Transmission du brouillon",
      category: "Contenu",
      status: "open",
      summary: "Relisez le brouillon et laissez une note à la prochaine personne.",
    },
    {
      key: "record-102",
      reference: "R-102",
      title: "Vérification des accès",
      category: "Opérations",
      status: "in-progress",
      summary: "Vérifiez les rôles d’exemple de l’espace de travail.",
    },
    {
      key: "record-103",
      reference: "R-103",
      title: "Notes de version",
      category: "Contenu",
      status: "complete",
      summary: "Rassemblez les changements de la prochaine mise à jour.",
    },
    {
      key: "record-104",
      reference: "R-104",
      title: "Plan du rapport",
      category: "Planification",
      status: "open",
      summary: "Organisez les notes avant de rédiger une courte analyse.",
    },
    {
      key: "record-105",
      reference: "R-105",
      title: "Inventaire des médias",
      category: "Opérations",
      status: "in-progress",
      summary: "Listez les fichiers média nécessaires à un projet d’exemple.",
    },
    {
      key: "record-106",
      reference: "R-106",
      title: "Revue des retours",
      category: "Assistance",
      status: "complete",
      summary: "Classez les retours d’exemple par sujet et par statut.",
    },
    {
      key: "record-107",
      reference: "R-107",
      title: "Correspondance d’import",
      category: "Opérations",
      status: "open",
      summary: "Vérifiez la correspondance des champs entre deux listes d’exemple.",
    },
    {
      key: "record-108",
      reference: "R-108",
      title: "Guide de configuration",
      category: "Planification",
      status: "in-progress",
      summary: "Notez les étapes d’une première configuration.",
    },
  ],
};

export function previewCopy(locale: AppLocale = "en"): FoundationPreviewCopy {
  return { en, de, es, fr }[locale];
}
