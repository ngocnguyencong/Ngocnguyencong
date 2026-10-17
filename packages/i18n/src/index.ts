export const SUPPORTED_LOCALES = ["en", "de", "es", "fr"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_COOKIE = "supastack_locale";

export type SettingsSectionCopy = Readonly<{
  description: string;
  label: string;
}>;

/**
 * Settings → Connections panel copy. All plain strings —
 * interpolated values use "{placeholder}" templates rendered client-side
 * with formatTemplate so the copy stays serializable across RSC props.
 */
export type ConnectionsPanelCopy = Readonly<{
  /** Generic banner when an action rejects before returning a result. */
  actionFailed: string;
  /** "Connect {provider}" — per-provider OAuth connect button. */
  connectProvider: string;
  disconnect: string;
  /** Success line after a disconnect. */
  disconnected: string;
  disconnectConfirm: string;
  emptyText: string;
  emptyTitle: string;
  /** OAuth callback flash banners (?status=connected|denied|error|unavailable). */
  flashConnected: string;
  flashDenied: string;
  flashError: string;
  flashUnavailable: string;
  /** "Last refreshed {date}". */
  lastRefreshed: string;
  managerOnly: string;
  /** "Not configured — set {envVar}." */
  notConfigured: string;
  oauthSummary: string;
  oauthTitle: string;
  reconnect: string;
  /** Manual refresh outcomes keyed by ConnectedAccountActionErrorKind. */
  refreshNotFound: string;
  refreshNotRefreshable: string;
  refreshNow: string;
  refreshReconnect: string;
  refreshSuperseded: string;
  refreshUpstream: string;
  refreshed: string;
  smtpAdd: string;
  smtpHost: string;
  smtpLabel: string;
  smtpPassword: string;
  smtpPort: string;
  /** Implicit-TLS checkbox — checking it suggests port 465 (default is 587). */
  smtpSecure: string;
  smtpSummary: string;
  smtpTitle: string;
  smtpUsername: string;
  statusActive: string;
  statusNeedsReauth: string;
  statusRevoked: string;
  /** "Token expires {date}". */
  tokenExpires: string;
}>;

/** Settings → Connections section: nav label/description plus all panel copy. */
export type ConnectionsSectionCopy = SettingsSectionCopy &
  Readonly<{
    panel: ConnectionsPanelCopy;
  }>;

export type MessageDictionary = Readonly<{
  language: string;
  common: Readonly<{
    dismiss: string;
  }>;
  auth: Readonly<{
    /** Localized toast messages keyed off Better Auth error codes. */
    errors: Readonly<{
      invalidCredentials: string;
      invalidCode: string;
      expiredCode: string;
      tooManyRequests: string;
      emailNotVerified: string;
      generic: string;
    }>;
    /** Separator between social providers and the email methods. */
    orDivider: string;
    /** Pending-session skeleton landmarks. */
    restoringStep: string;
    restoringTitle: string;
    /** Transient success toasts. */
    signedIn: string;
    signedOut: string;
    /** Step headings keyed by the web-auth-steps AuthStep ids. */
    stepTitles: Readonly<{
      choose: string;
      "otp-email": string;
      "otp-verify": string;
      "set-password": string;
      "magic-link-email": string;
      "magic-link-sent": string;
      "signed-in": string;
    }>;
    /** Fallback when the email field is still empty (used inside templates). */
    yourEmail: string;
    /** "Signed in as {email}." */
    signedInAs: string;
    signOut: string;
    returnToDashboard: string;
    /** "Continue with {provider}" */
    continueWith: string;
    lastUsed: string;
    emailMeCode: string;
    createAccount: string;
    createPassword: string;
    emailMeLink: string;
    emailLabel: string;
    passwordLabel: string;
    /** "Code sent to {email}." */
    codeSentTo: string;
    emailCodeLabel: string;
    verifyCode: string;
    /** "Sign-in link sent to {email}. Open it on this device to continue." */
    linkSentTo: string;
    back: string;
    /** Auth.js engine card. */
    authjsTitle: string;
    authjsIntro: string;
    signIn: string;
    signingIn: string;
    authjsEngineNote: string;
    /** "Set {setting} to enable them." */
    authjsEngineEnable: string;
  }>;
  nav: Readonly<{
    pricing: string;
    faq: string;
    blog: string;
    docs: string;
    waitlist: string;
    getAccess: string;
  }>;
  marketingLanding: Readonly<{
    title: string;
    description: string;
    primaryAction: string;
    metadataTitle: string;
    metadataDescription: string;
  }>;
  settings: Readonly<{
    title: string;
    /** Settings → General workspace export card (owner/admin only). */
    workspaceExport: Readonly<{
      title: string;
      description: string;
      action: string;
    }>;
    sections: Readonly<{
      general: SettingsSectionCopy;
      appearance: SettingsSectionCopy;
      security: SettingsSectionCopy;
      billing: SettingsSectionCopy;
      usage: SettingsSectionCopy;
      members: SettingsSectionCopy;
      notifications: SettingsSectionCopy;
      developers: SettingsSectionCopy;
      connections: ConnectionsSectionCopy;
      domains: SettingsSectionCopy;
      audit: SettingsSectionCopy;
    }>;
  }>;
  billing: Readonly<{
    credits: Readonly<{
      title: string;
      intro: string;
      balanceLabel: string;
      empty: string;
      kinds: Readonly<{
        adjustment: string;
        debit: string;
        expire: string;
        grant: string;
        refund: string;
      }>;
    }>;
  }>;
  org: Readonly<{
    settingsTitle: string;
    settingsSummary: string;
    general: string;
    dangerZone: string;
    dangerSummary: string;
    leave: string;
    leaveSummary: string;
    renameSaved: string;
    ownerRequired: string;
  }>;
  mail: Readonly<{
    inviteSubject: string;
    inviteBody: (orgName: string, acceptUrl: string) => string;
    earlyAccessSubject: string;
    earlyAccessBody: (signupUrl: string) => string;
    otpSignInSubject: string;
    otpResetSubject: string;
    otpSignInBody: (code: string) => string;
    otpResetBody: (code: string) => string;
    magicLinkSubject: string;
    magicLinkBody: (url: string) => string;
    aiCompleteSubject: string;
    aiCompleteBody: string;
    billingFailedSubject: string;
    billingFailedBody: string;
    transactionalFooter: string;
  }>;
  notifications: Readonly<{
    title: string;
    empty: string;
    emailInvites: string;
    emailBilling: string;
    inAppProduct: string;
  }>;
  notificationEvents: Readonly<{
    checkoutSucceeded: Readonly<{ title: string; body: string }>;
    paymentFailed: Readonly<{ title: string; body: string }>;
    subscriptionEnded: Readonly<{ title: string; body: string }>;
    budgetExceeded: Readonly<{ title: string; body: string }>;
    inviteAccepted: Readonly<{
      title: string;
      body: (memberEmail: string) => string;
    }>;
    memberLeft: Readonly<{
      title: string;
      body: (memberEmail: string) => string;
    }>;
    memberRemoved: Readonly<{
      title: string;
      body: (memberEmail: string) => string;
    }>;
    memberRoleChanged: Readonly<{
      title: string;
      body: (memberEmail: string, role: string) => string;
    }>;
    connectedAccountReauth: Readonly<{
      title: string;
      body: (accountLabel: string) => string;
    }>;
  }>;
}>;

const en: MessageDictionary = {
  language: "English",
  common: {
    dismiss: "Dismiss",
  },
  auth: {
    errors: {
      invalidCredentials: "Invalid email or password.",
      invalidCode: "That code is not right. Check it and try again.",
      expiredCode: "That code has expired. Request a new one.",
      tooManyRequests: "Too many attempts. Wait a moment and try again.",
      emailNotVerified: "Verify your email before signing in.",
      generic: "Sign-in failed. Please try again.",
    },
    orDivider: "or",
    restoringStep: "Restoring session",
    restoringTitle: "Restoring your secure session…",
    signedIn: "Signed in.",
    signedOut: "Signed out.",
    stepTitles: {
      choose: "Sign in to your workspace.",
      "otp-email": "Email me a code.",
      "otp-verify": "Enter your email code.",
      "set-password": "Create a password.",
      "magic-link-email": "Email me a sign-in link.",
      "magic-link-sent": "Check your email for a sign-in link.",
      "signed-in": "Your account is ready.",
    },
    yourEmail: "your email",
    signedInAs: "Signed in as {email}.",
    signOut: "Sign out",
    returnToDashboard: "Return to dashboard",
    continueWith: "Continue with {provider}",
    lastUsed: "Last used",
    emailMeCode: "Email me a code",
    createAccount: "Create account",
    createPassword: "Create password",
    emailMeLink: "Email me a link",
    emailLabel: "Email address",
    passwordLabel: "Password",
    codeSentTo: "Code sent to {email}.",
    emailCodeLabel: "Email code",
    verifyCode: "Verify code",
    linkSentTo: "Sign-in link sent to {email}. Open it on this device to continue.",
    back: "Choose another method",
    authjsTitle: "Sign in",
    authjsIntro: "Use your email and password, or continue with a connected provider.",
    signIn: "Sign in",
    signingIn: "Signing in…",
    authjsEngineNote:
      "Email OTP, magic links, passkeys, and two-factor sign-in are provided by the Better Auth engine.",
    authjsEngineEnable: "Set {setting} to enable them.",
  },
  nav: {
    pricing: "Pricing",
    faq: "FAQ",
    blog: "Blog",
    docs: "Docs",
    waitlist: "Waitlist",
    getAccess: "Get started",
  },
  marketingLanding: {
    title: "Your app, your starting point.",
    description:
      "This is a boilerplate demo for web, mobile, and desktop. Explore the sample app, then replace the content and configure the modules for your product.",
    primaryAction: "Open the demo",
    metadataTitle: "Boilerplate demo",
    metadataDescription:
      "Explore a sample analytics product on the supastack boilerplate — live dashboards, revenue attribution, and visitor journeys over seeded demo data.",
  },
  settings: {
    title: "Settings",
    workspaceExport: {
      title: "Workspace data",
      description:
        "Download a JSON copy of this workspace's content, commerce, members, and settings.",
      action: "Export workspace",
    },
    sections: {
      general: { label: "General", description: "Profile, display name, and avatar." },
      appearance: {
        label: "Appearance",
        description: "Color packs, density, radius, fonts, and the kit UI gallery.",
      },
      security: {
        label: "Security",
        description: "Sign-in methods, passkeys, and two-factor authentication.",
      },
      billing: {
        label: "Billing",
        description: "Product plans, trials, and customer portal.",
      },
      usage: {
        label: "Usage",
        description: "AI spend, meter limits, and prepaid credits for the workspace.",
      },
      members: {
        label: "Members",
        description: "Invites and roles for the active workspace.",
      },
      notifications: {
        label: "Notifications",
        description: "In-app notification center and email preference toggles.",
      },
      developers: {
        label: "Developers",
        description: "API keys and outbound webhooks for the active workspace.",
      },
      connections: {
        label: "Connections",
        description: "External accounts the workspace can send and sync through.",
        panel: {
          actionFailed: "The action could not be completed. Try again.",
          connectProvider: "Connect {provider}",
          disconnect: "Disconnect",
          disconnected: "Account disconnected.",
          disconnectConfirm:
            "Disconnect this account? The workspace loses access to it immediately.",
          emptyText: "Connect an OAuth provider or add an SMTP account to get started.",
          emptyTitle: "No connections yet",
          flashConnected: "Account connected.",
          flashDenied: "Authorization was denied — nothing was connected.",
          flashError: "The connection could not be completed. Try again.",
          flashUnavailable: "That provider is not available on this deployment.",
          lastRefreshed: "Last refreshed {date}",
          managerOnly: "Owner or admin role required.",
          notConfigured: "Not configured — set {envVar}.",
          oauthSummary:
            "Provider accounts the workspace acts through. Tokens are stored encrypted and refreshed automatically.",
          oauthTitle: "OAuth accounts",
          reconnect: "Reconnect",
          refreshNotFound: "That connected account no longer exists — reload the page.",
          refreshNotRefreshable: "Only OAuth accounts can be refreshed.",
          refreshNow: "Refresh now",
          refreshReconnect: "Reconnect required — the provider rejected the stored grant.",
          refreshSuperseded: "This account changed while refreshing — reload the page.",
          refreshUpstream: "The provider could not be reached. Try again later.",
          refreshed: "Tokens refreshed.",
          smtpAdd: "Add SMTP account",
          smtpHost: "Host",
          smtpLabel: "Label (optional)",
          smtpPassword: "Password",
          smtpPort: "Port",
          smtpSecure: "Implicit TLS (port 465)",
          smtpSummary: "Workspace mailboxes reached over SMTP. The password is stored encrypted.",
          smtpTitle: "SMTP accounts",
          smtpUsername: "Username",
          statusActive: "Active",
          statusNeedsReauth: "Reconnect required",
          statusRevoked: "Revoked",
          tokenExpires: "Token expires {date}",
        },
      },
      domains: {
        label: "Domains",
        description: "Custom white-label hostnames for the active workspace.",
      },
      audit: {
        label: "Audit log",
        description: "Workspace activity for invites, members, and credentials.",
      },
    },
  },
  billing: {
    credits: {
      title: "Credits",
      intro:
        "Prepaid credits keep metered workspace actions running after the plan's quota is used up.",
      balanceLabel: "Available credits",
      empty: "No credit transactions yet.",
      kinds: {
        adjustment: "Adjustment",
        debit: "Debit",
        expire: "Expiry",
        grant: "Grant",
        refund: "Refund",
      },
    },
  },
  org: {
    settingsTitle: "Organization settings",
    settingsSummary:
      "Rename or delete the active organization. Only owners can make destructive changes.",
    general: "General",
    dangerZone: "Danger zone",
    dangerSummary:
      "Deleting an organization removes its memberships and product data for everyone.",
    leave: "Leave organization",
    leaveSummary:
      "Leave the active organization. Sole owners must transfer ownership or delete it.",
    renameSaved: "Organization renamed.",
    ownerRequired: "Owner role required.",
  },
  mail: {
    inviteSubject: "You are invited to a supastack organization",
    inviteBody: (orgName, acceptUrl) =>
      `You were invited to join ${orgName}. Accept the invite: ${acceptUrl}`,
    earlyAccessSubject: "Your supastack early access invite",
    earlyAccessBody: (signupUrl) =>
      `You are off the waitlist. Claim your early access here: ${signupUrl}`,
    otpSignInSubject: "Your supastack sign-in code",
    otpResetSubject: "Your supastack password reset code",
    otpSignInBody: (code) => `Your sign-in code is ${code}`,
    otpResetBody: (code) => `Your password reset code is ${code}`,
    magicLinkSubject: "Your supastack sign-in link",
    magicLinkBody: (url) => `Open this link to sign in: ${url}`,
    aiCompleteSubject: "Your AI task is complete",
    aiCompleteBody: "Your AI task completed successfully. Open the app to view the result.",
    billingFailedSubject: "Billing payment failed",
    billingFailedBody:
      "A billing payment failed. Update payment details in the app billing portal.",
    transactionalFooter: "This is a transactional message from supastack. Do not reply.",
  },
  notifications: {
    title: "Notifications",
    empty: "No notifications yet.",
    emailInvites: "Email me about organization invites",
    emailBilling: "Email me about billing events",
    inAppProduct: "Show in-app product notifications",
  },
  notificationEvents: {
    checkoutSucceeded: {
      title: "Subscription active",
      body: "Billing entitlement is now active for this workspace.",
    },
    paymentFailed: {
      title: "Payment failed",
      body: "A billing payment failed. Update payment details to restore access.",
    },
    subscriptionEnded: {
      title: "Subscription ended",
      body: "This workspace subscription is inactive. Choose a plan to continue.",
    },
    budgetExceeded: {
      title: "AI budget reached",
      body: "This workspace hit its monthly AI budget. New provider attempts are blocked until the period resets or the limit changes.",
    },
    inviteAccepted: {
      title: "Invite accepted",
      body: (memberEmail) => `${memberEmail} joined this workspace.`,
    },
    memberLeft: {
      title: "Member left",
      body: (memberEmail) => `${memberEmail} left this workspace.`,
    },
    memberRemoved: {
      title: "Member removed",
      body: (memberEmail) => `${memberEmail} was removed from this workspace.`,
    },
    memberRoleChanged: {
      title: "Role updated",
      body: (memberEmail, role) => `${memberEmail} is now ${role}.`,
    },
    connectedAccountReauth: {
      title: "Account needs reconnecting",
      body: (accountLabel) =>
        `${accountLabel} could not refresh its access. Reconnect it to keep it working.`,
    },
  },
};

const de: MessageDictionary = {
  language: "Deutsch",
  common: {
    dismiss: "Schließen",
  },
  auth: {
    errors: {
      invalidCredentials: "E-Mail-Adresse oder Passwort ist falsch.",
      invalidCode: "Der Code ist ungültig. Bitte prüfe ihn und versuche es erneut.",
      expiredCode: "Der Code ist abgelaufen. Fordere einen neuen an.",
      tooManyRequests: "Zu viele Versuche. Warte einen Moment und versuche es erneut.",
      emailNotVerified: "Bestätige zuerst deine E-Mail-Adresse, um dich anzumelden.",
      generic: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    },
    orDivider: "oder",
    restoringStep: "Sitzung wird wiederhergestellt",
    restoringTitle: "Deine sichere Sitzung wird wiederhergestellt…",
    signedIn: "Angemeldet.",
    signedOut: "Abgemeldet.",
    stepTitles: {
      choose: "Melde dich in deinem Workspace an.",
      "otp-email": "Schick mir einen Code.",
      "otp-verify": "Gib deinen E-Mail-Code ein.",
      "set-password": "Erstelle ein Passwort.",
      "magic-link-email": "Schick mir einen Anmeldelink.",
      "magic-link-sent": "Schau in deinem Postfach nach einem Anmeldelink.",
      "signed-in": "Dein Konto ist bereit.",
    },
    yourEmail: "deine E-Mail-Adresse",
    signedInAs: "Angemeldet als {email}.",
    signOut: "Abmelden",
    returnToDashboard: "Zurück zum Dashboard",
    continueWith: "Weiter mit {provider}",
    lastUsed: "Zuletzt verwendet",
    emailMeCode: "Schick mir einen Code",
    createAccount: "Konto erstellen",
    createPassword: "Passwort erstellen",
    emailMeLink: "Schick mir einen Link",
    emailLabel: "E-Mail-Adresse",
    passwordLabel: "Passwort",
    codeSentTo: "Code gesendet an {email}.",
    emailCodeLabel: "E-Mail-Code",
    verifyCode: "Code bestätigen",
    linkSentTo: "Anmeldelink gesendet an {email}. Öffne ihn auf diesem Gerät, um fortzufahren.",
    back: "Andere Methode wählen",
    authjsTitle: "Anmelden",
    authjsIntro:
      "Nutze deine E-Mail-Adresse und dein Passwort oder fahre mit einem verbundenen Anbieter fort.",
    signIn: "Anmelden",
    signingIn: "Anmeldung läuft…",
    authjsEngineNote:
      "E-Mail-OTP, Magic Links, Passkeys und Zwei-Faktor-Anmeldung werden von der Better-Auth-Engine bereitgestellt.",
    authjsEngineEnable: "Setze {setting}, um sie zu aktivieren.",
  },
  nav: {
    pricing: "Preise",
    faq: "FAQ",
    blog: "Blog",
    docs: "Dokumentation",
    waitlist: "Warteliste",
    getAccess: "Loslegen",
  },
  marketingLanding: {
    title: "Deine App, dein Ausgangspunkt.",
    description:
      "Dies ist eine Boilerplate-Demo für Web, Mobile und Desktop. Erkunde die Beispiel-App, ersetze die Inhalte und konfiguriere die Module für dein Produkt.",
    primaryAction: "Demo öffnen",
    metadataTitle: "Boilerplate-Demo",
    metadataDescription:
      "Erkunde eine Beispiel-App mit Next.js, Expo und Tauri. Teste die gemeinsamen Module, lies die Setup-Dokumentation und passe die Inhalte an dein Produkt an.",
  },
  settings: {
    title: "Einstellungen",
    workspaceExport: {
      title: "Workspace-Daten",
      description:
        "Lade eine JSON-Kopie der Inhalte, des Shops, der Mitglieder und der Einstellungen dieses Workspaces herunter.",
      action: "Workspace exportieren",
    },
    sections: {
      general: { label: "Allgemein", description: "Profil, Anzeigename und Avatar." },
      appearance: {
        label: "Darstellung",
        description: "Farbpaletten, Dichte, Radius, Schriften und die Kit-UI-Galerie.",
      },
      security: {
        label: "Sicherheit",
        description: "Anmeldemethoden, Passkeys und Zwei-Faktor-Authentifizierung.",
      },
      billing: {
        label: "Abrechnung",
        description: "Produktpläne, Testzeiträume und Kundenportal.",
      },
      usage: {
        label: "Nutzung",
        description: "KI-Ausgaben, Zählerlimits und Prepaid-Guthaben für den Workspace.",
      },
      members: {
        label: "Mitglieder",
        description: "Einladungen und Rollen für den aktiven Workspace.",
      },
      notifications: {
        label: "Benachrichtigungen",
        description: "In-App-Benachrichtigungen und E-Mail-Einstellungen.",
      },
      developers: {
        label: "Entwickler",
        description: "API-Schlüssel und ausgehende Webhooks für den aktiven Workspace.",
      },
      connections: {
        label: "Verbindungen",
        description: "Externe Konten, über die der Workspace senden und synchronisieren kann.",
        panel: {
          actionFailed: "Die Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.",
          connectProvider: "{provider} verbinden",
          disconnect: "Trennen",
          disconnected: "Konto getrennt.",
          disconnectConfirm:
            "Dieses Konto trennen? Der Workspace verliert sofort den Zugriff darauf.",
          emptyText: "Verbinde einen OAuth-Anbieter oder füge ein SMTP-Konto hinzu, um zu starten.",
          emptyTitle: "Noch keine Verbindungen",
          flashConnected: "Konto verbunden.",
          flashDenied: "Autorisierung abgelehnt — es wurde nichts verbunden.",
          flashError: "Die Verbindung konnte nicht hergestellt werden. Bitte erneut versuchen.",
          flashUnavailable: "Dieser Anbieter ist in dieser Bereitstellung nicht verfügbar.",
          lastRefreshed: "Zuletzt aktualisiert {date}",
          managerOnly: "Eigentümer- oder Admin-Rolle erforderlich.",
          notConfigured: "Nicht konfiguriert — setze {envVar}.",
          oauthSummary:
            "Anbieterkonten, über die der Workspace agiert. Tokens werden verschlüsselt gespeichert und automatisch erneuert.",
          oauthTitle: "OAuth-Konten",
          reconnect: "Neu verbinden",
          refreshNotFound: "Dieses verbundene Konto existiert nicht mehr — Seite neu laden.",
          refreshNotRefreshable: "Nur OAuth-Konten können aktualisiert werden.",
          refreshNow: "Jetzt aktualisieren",
          refreshReconnect:
            "Neu verbinden erforderlich — der Anbieter hat die gespeicherte Berechtigung abgelehnt.",
          refreshSuperseded:
            "Dieses Konto wurde während der Aktualisierung geändert — Seite neu laden.",
          refreshUpstream: "Der Anbieter ist nicht erreichbar. Bitte später erneut versuchen.",
          refreshed: "Tokens aktualisiert.",
          smtpAdd: "SMTP-Konto hinzufügen",
          smtpHost: "Host",
          smtpLabel: "Bezeichnung (optional)",
          smtpPassword: "Passwort",
          smtpPort: "Port",
          smtpSecure: "Implizites TLS (Port 465)",
          smtpSummary:
            "Postfächer des Workspace über SMTP. Das Passwort wird verschlüsselt gespeichert.",
          smtpTitle: "SMTP-Konten",
          smtpUsername: "Benutzername",
          statusActive: "Aktiv",
          statusNeedsReauth: "Neu verbinden erforderlich",
          statusRevoked: "Widerrufen",
          tokenExpires: "Token läuft ab {date}",
        },
      },
      domains: {
        label: "Domains",
        description: "Eigene White-Label-Hostnamen für den aktiven Workspace.",
      },
      audit: {
        label: "Audit-Protokoll",
        description: "Workspace-Aktivitäten zu Einladungen, Mitgliedern und Zugangsdaten.",
      },
    },
  },
  billing: {
    credits: {
      title: "Guthaben",
      intro:
        "Vorausbezahlte Credits halten gemessene Workspace-Aktionen aktiv, nachdem das Plan-Kontingent aufgebraucht ist.",
      balanceLabel: "Verfügbare Credits",
      empty: "Noch keine Guthabenbewegungen.",
      kinds: {
        adjustment: "Korrektur",
        debit: "Belastung",
        expire: "Ablauf",
        grant: "Gutschrift",
        refund: "Erstattung",
      },
    },
  },
  org: {
    settingsTitle: "Organisationseinstellungen",
    settingsSummary:
      "Aktive Organisation umbenennen oder löschen. Nur Eigentümer können destruktive Änderungen vornehmen.",
    general: "Allgemein",
    dangerZone: "Gefahrenzone",
    dangerSummary:
      "Das Löschen einer Organisation entfernt Mitgliedschaften und Produktdaten für alle.",
    leave: "Organisation verlassen",
    leaveSummary:
      "Aktive Organisation verlassen. Alleinige Eigentümer müssen Besitz übertragen oder löschen.",
    renameSaved: "Organisation umbenannt.",
    ownerRequired: "Eigentümerrolle erforderlich.",
  },
  mail: {
    inviteSubject: "Einladung zu einer supastack-Organisation",
    inviteBody: (orgName, acceptUrl) =>
      `Sie wurden eingeladen, ${orgName} beizutreten. Einladung annehmen: ${acceptUrl}`,
    earlyAccessSubject: "Ihre supastack-Early-Access-Einladung",
    earlyAccessBody: (signupUrl) =>
      `Sie sind von der Warteliste. Sichern Sie sich Ihren Early Access hier: ${signupUrl}`,
    otpSignInSubject: "Ihr Starter-Kit-Anmeldecode",
    otpResetSubject: "Ihr Starter-Kit-Passwort-Reset-Code",
    otpSignInBody: (code) => `Ihr Anmeldecode lautet ${code}`,
    otpResetBody: (code) => `Ihr Passwort-Reset-Code lautet ${code}`,
    magicLinkSubject: "Ihr Starter-Kit-Anmeldelink",
    magicLinkBody: (url) => `Öffnen Sie diesen Link zur Anmeldung: ${url}`,
    aiCompleteSubject: "Ihre KI-Aufgabe ist abgeschlossen",
    aiCompleteBody:
      "Ihre KI-Aufgabe wurde erfolgreich abgeschlossen. Öffnen Sie die App, um das Ergebnis anzusehen.",
    billingFailedSubject: "Zahlungsfehler bei der Abrechnung",
    billingFailedBody:
      "Eine Abrechnungszahlung ist fehlgeschlagen. Aktualisieren Sie die Zahlungsdaten im Abrechnungsportal.",
    transactionalFooter:
      "Dies ist eine Transaktionsnachricht von supastack. Bitte nicht antworten.",
  },
  notifications: {
    title: "Benachrichtigungen",
    empty: "Noch keine Benachrichtigungen.",
    emailInvites: "E-Mails zu Organisationseinladungen",
    emailBilling: "E-Mails zu Abrechnungsereignissen",
    inAppProduct: "In-App-Produktbenachrichtigungen anzeigen",
  },
  notificationEvents: {
    checkoutSucceeded: {
      title: "Abonnement aktiv",
      body: "Die Abrechnungsberechtigung ist für diesen Workspace jetzt aktiv.",
    },
    paymentFailed: {
      title: "Zahlung fehlgeschlagen",
      body: "Eine Abrechnungszahlung ist fehlgeschlagen. Aktualisieren Sie die Zahlungsdaten.",
    },
    subscriptionEnded: {
      title: "Abonnement beendet",
      body: "Dieses Workspace-Abonnement ist inaktiv. Wählen Sie einen Plan, um fortzufahren.",
    },
    budgetExceeded: {
      title: "KI-Budget erreicht",
      body: "Dieser Workspace hat sein monatliches KI-Budget erreicht. Neue Anbieterversuche sind blockiert.",
    },
    inviteAccepted: {
      title: "Einladung angenommen",
      body: (memberEmail) => `${memberEmail} ist diesem Workspace beigetreten.`,
    },
    memberLeft: {
      title: "Mitglied hat verlassen",
      body: (memberEmail) => `${memberEmail} hat diesen Workspace verlassen.`,
    },
    memberRemoved: {
      title: "Mitglied entfernt",
      body: (memberEmail) => `${memberEmail} wurde aus diesem Workspace entfernt.`,
    },
    memberRoleChanged: {
      title: "Rolle aktualisiert",
      body: (memberEmail, role) => `${memberEmail} ist jetzt ${role}.`,
    },
    connectedAccountReauth: {
      title: "Konto erneut verbinden",
      body: (accountLabel) =>
        `${accountLabel} konnte seinen Zugriff nicht erneuern. Verbinden Sie das Konto erneut, damit es weiter funktioniert.`,
    },
  },
};

const es: MessageDictionary = {
  language: "Español",
  common: {
    dismiss: "Descartar",
  },
  auth: {
    errors: {
      invalidCredentials: "Correo o contraseña incorrectos.",
      invalidCode: "El código no es válido. Revísalo e inténtalo de nuevo.",
      expiredCode: "El código ha caducado. Solicita uno nuevo.",
      tooManyRequests: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
      emailNotVerified: "Verifica tu correo antes de iniciar sesión.",
      generic: "No se pudo iniciar sesión. Inténtalo de nuevo.",
    },
    orDivider: "o",
    restoringStep: "Restaurando la sesión",
    restoringTitle: "Restaurando tu sesión segura…",
    signedIn: "Sesión iniciada.",
    signedOut: "Sesión cerrada.",
    stepTitles: {
      choose: "Inicia sesión en tu espacio de trabajo.",
      "otp-email": "Envíame un código.",
      "otp-verify": "Introduce tu código de correo.",
      "set-password": "Crea una contraseña.",
      "magic-link-email": "Envíame un enlace de acceso.",
      "magic-link-sent": "Revisa tu correo: te enviamos un enlace de acceso.",
      "signed-in": "Tu cuenta está lista.",
    },
    yourEmail: "tu correo",
    signedInAs: "Sesión iniciada como {email}.",
    signOut: "Cerrar sesión",
    returnToDashboard: "Volver al panel",
    continueWith: "Continuar con {provider}",
    lastUsed: "Usado por última vez",
    emailMeCode: "Envíame un código",
    createAccount: "Crear cuenta",
    createPassword: "Crear contraseña",
    emailMeLink: "Envíame un enlace",
    emailLabel: "Correo electrónico",
    passwordLabel: "Contraseña",
    codeSentTo: "Código enviado a {email}.",
    emailCodeLabel: "Código de correo",
    verifyCode: "Verificar código",
    linkSentTo: "Enlace de acceso enviado a {email}. Ábrelo en este dispositivo para continuar.",
    back: "Elegir otro método",
    authjsTitle: "Iniciar sesión",
    authjsIntro: "Usa tu correo y contraseña, o continúa con un proveedor conectado.",
    signIn: "Iniciar sesión",
    signingIn: "Iniciando sesión…",
    authjsEngineNote:
      "El OTP por correo, los enlaces mágicos, las passkeys y el inicio de sesión en dos pasos los proporciona el motor Better Auth.",
    authjsEngineEnable: "Define {setting} para activarlos.",
  },
  nav: {
    pricing: "Precios",
    faq: "FAQ",
    blog: "Blog",
    docs: "Docs",
    waitlist: "Lista de espera",
    getAccess: "Comenzar",
  },
  marketingLanding: {
    title: "Tu app, tu punto de partida.",
    description:
      "Esta es una demo de plantilla para web, móvil y escritorio. Explora la app de ejemplo, sustituye el contenido y configura los módulos para tu producto.",
    primaryAction: "Abrir la demo",
    metadataTitle: "Demo de plantilla",
    metadataDescription:
      "Explora una app de ejemplo con Next.js, Expo y Tauri. Prueba los módulos compartidos, consulta las guías y adapta el contenido de ejemplo a tu producto.",
  },
  settings: {
    title: "Ajustes",
    workspaceExport: {
      title: "Datos del espacio de trabajo",
      description:
        "Descarga una copia JSON del contenido, la tienda, los miembros y la configuración de este espacio de trabajo.",
      action: "Exportar espacio de trabajo",
    },
    sections: {
      general: { label: "General", description: "Perfil, nombre visible y avatar." },
      appearance: {
        label: "Apariencia",
        description: "Paletas, densidad, radio, tipografías y la galería de UI del kit.",
      },
      security: {
        label: "Seguridad",
        description: "Métodos de acceso, passkeys y autenticación en dos pasos.",
      },
      billing: {
        label: "Facturación",
        description: "Planes de producto, pruebas y portal del cliente.",
      },
      usage: {
        label: "Uso",
        description:
          "Gasto de IA, límites de medidores y créditos prepagados del espacio de trabajo.",
      },
      members: {
        label: "Miembros",
        description: "Invitaciones y roles del espacio de trabajo activo.",
      },
      notifications: {
        label: "Notificaciones",
        description: "Centro de notificaciones y preferencias de correo.",
      },
      developers: {
        label: "Desarrolladores",
        description: "Claves API y webhooks salientes del espacio de trabajo activo.",
      },
      connections: {
        label: "Conexiones",
        description:
          "Cuentas externas a través de las cuales el espacio de trabajo puede enviar y sincronizar.",
        panel: {
          actionFailed: "No se pudo completar la acción. Inténtalo de nuevo.",
          connectProvider: "Conectar {provider}",
          disconnect: "Desconectar",
          disconnected: "Cuenta desconectada.",
          disconnectConfirm:
            "¿Desconectar esta cuenta? El espacio de trabajo perderá el acceso inmediatamente.",
          emptyText: "Conecta un proveedor OAuth o añade una cuenta SMTP para empezar.",
          emptyTitle: "Aún no hay conexiones",
          flashConnected: "Cuenta conectada.",
          flashDenied: "Autorización denegada — no se conectó nada.",
          flashError: "No se pudo completar la conexión. Inténtalo de nuevo.",
          flashUnavailable: "Ese proveedor no está disponible en este despliegue.",
          lastRefreshed: "Última actualización {date}",
          managerOnly: "Se requiere rol de propietario o administrador.",
          notConfigured: "No configurado — define {envVar}.",
          oauthSummary:
            "Cuentas de proveedores a través de las cuales actúa el espacio de trabajo. Los tokens se almacenan cifrados y se renuevan automáticamente.",
          oauthTitle: "Cuentas OAuth",
          reconnect: "Volver a conectar",
          refreshNotFound: "Esa cuenta conectada ya no existe — recarga la página.",
          refreshNotRefreshable: "Solo las cuentas OAuth pueden actualizarse.",
          refreshNow: "Actualizar ahora",
          refreshReconnect: "Reconexión necesaria — el proveedor rechazó la credencial almacenada.",
          refreshSuperseded: "Esta cuenta cambió durante la actualización — recarga la página.",
          refreshUpstream: "No se pudo contactar con el proveedor. Inténtalo más tarde.",
          refreshed: "Tokens actualizados.",
          smtpAdd: "Añadir cuenta SMTP",
          smtpHost: "Host",
          smtpLabel: "Etiqueta (opcional)",
          smtpPassword: "Contraseña",
          smtpPort: "Puerto",
          smtpSecure: "TLS implícito (puerto 465)",
          smtpSummary:
            "Buzones del espacio de trabajo accedidos por SMTP. La contraseña se almacena cifrada.",
          smtpTitle: "Cuentas SMTP",
          smtpUsername: "Usuario",
          statusActive: "Activa",
          statusNeedsReauth: "Requiere reconexión",
          statusRevoked: "Revocada",
          tokenExpires: "El token caduca {date}",
        },
      },
      domains: {
        label: "Dominios",
        description: "Nombres de host personalizados (marca blanca) del espacio activo.",
      },
      audit: {
        label: "Registro de auditoría",
        description: "Actividad del espacio: invitaciones, miembros y credenciales.",
      },
    },
  },
  billing: {
    credits: {
      title: "Créditos",
      intro:
        "Los créditos prepagados mantienen activas las acciones medidas del espacio de trabajo cuando se agota la cuota del plan.",
      balanceLabel: "Créditos disponibles",
      empty: "Aún no hay movimientos de créditos.",
      kinds: {
        adjustment: "Ajuste",
        debit: "Cargo",
        expire: "Caducidad",
        grant: "Concesión",
        refund: "Reembolso",
      },
    },
  },
  org: {
    settingsTitle: "Ajustes de organización",
    settingsSummary:
      "Renombra o elimina la organización activa. Solo los propietarios pueden hacer cambios destructivos.",
    general: "General",
    dangerZone: "Zona de peligro",
    dangerSummary: "Eliminar una organización quita membresías y datos del producto para todos.",
    leave: "Abandonar organización",
    leaveSummary:
      "Abandona la organización activa. Un propietario único debe transferir la propiedad o eliminarla.",
    renameSaved: "Organización renombrada.",
    ownerRequired: "Se requiere rol de propietario.",
  },
  mail: {
    inviteSubject: "Invitación a una organización de supastack",
    inviteBody: (orgName, acceptUrl) =>
      `Te invitaron a unirte a ${orgName}. Acepta la invitación: ${acceptUrl}`,
    earlyAccessSubject: "Tu invitación de acceso anticipado a supastack",
    earlyAccessBody: (signupUrl) =>
      `Ya saliste de la lista de espera. Reclama tu acceso anticipado aquí: ${signupUrl}`,
    otpSignInSubject: "Tu código de acceso de supastack",
    otpResetSubject: "Tu código de restablecimiento de supastack",
    otpSignInBody: (code) => `Tu código de acceso es ${code}`,
    otpResetBody: (code) => `Tu código de restablecimiento es ${code}`,
    magicLinkSubject: "Tu enlace de acceso de supastack",
    magicLinkBody: (url) => `Abre este enlace para iniciar sesión: ${url}`,
    aiCompleteSubject: "Tu tarea de IA está completa",
    aiCompleteBody: "Tu tarea de IA finalizó correctamente. Abre la app para ver el resultado.",
    billingFailedSubject: "Falló el pago de facturación",
    billingFailedBody:
      "Falló un pago de facturación. Actualiza los datos de pago en el portal de facturación.",
    transactionalFooter: "Este es un mensaje transaccional de supastack. No responder.",
  },
  notifications: {
    title: "Notificaciones",
    empty: "Aún no hay notificaciones.",
    emailInvites: "Enviarme correos sobre invitaciones",
    emailBilling: "Enviarme correos sobre facturación",
    inAppProduct: "Mostrar notificaciones del producto en la app",
  },
  notificationEvents: {
    checkoutSucceeded: {
      title: "Suscripción activa",
      body: "La habilitación de facturación ya está activa para este espacio de trabajo.",
    },
    paymentFailed: {
      title: "Pago fallido",
      body: "Falló un pago de facturación. Actualiza los datos de pago para restaurar el acceso.",
    },
    subscriptionEnded: {
      title: "Suscripción finalizada",
      body: "La suscripción de este espacio está inactiva. Elige un plan para continuar.",
    },
    budgetExceeded: {
      title: "Presupuesto de IA alcanzado",
      body: "Este espacio alcanzó su presupuesto mensual de IA. Los nuevos intentos del proveedor están bloqueados.",
    },
    inviteAccepted: {
      title: "Invitación aceptada",
      body: (memberEmail) => `${memberEmail} se unió a este espacio de trabajo.`,
    },
    memberLeft: {
      title: "Miembro salió",
      body: (memberEmail) => `${memberEmail} dejó este espacio de trabajo.`,
    },
    memberRemoved: {
      title: "Miembro eliminado",
      body: (memberEmail) => `${memberEmail} fue eliminado de este espacio de trabajo.`,
    },
    memberRoleChanged: {
      title: "Rol actualizado",
      body: (memberEmail, role) => `${memberEmail} ahora es ${role}.`,
    },
    connectedAccountReauth: {
      title: "Cuenta por reconectar",
      body: (accountLabel) =>
        `${accountLabel} no pudo renovar su acceso. Vuelve a conectarla para que siga funcionando.`,
    },
  },
};

const fr: MessageDictionary = {
  language: "Français",
  common: {
    dismiss: "Fermer",
  },
  auth: {
    errors: {
      invalidCredentials: "E-mail ou mot de passe incorrect.",
      invalidCode: "Ce code n’est pas valide. Vérifiez-le et réessayez.",
      expiredCode: "Ce code a expiré. Demandez-en un nouveau.",
      tooManyRequests: "Trop de tentatives. Patientez un instant puis réessayez.",
      emailNotVerified: "Vérifiez votre e-mail avant de vous connecter.",
      generic: "La connexion a échoué. Veuillez réessayer.",
    },
    orDivider: "ou",
    restoringStep: "Restauration de la session",
    restoringTitle: "Restauration de votre session sécurisée…",
    signedIn: "Connecté.",
    signedOut: "Déconnecté.",
    stepTitles: {
      choose: "Connectez-vous à votre espace de travail.",
      "otp-email": "Envoyez-moi un code.",
      "otp-verify": "Saisissez votre code e-mail.",
      "set-password": "Créez un mot de passe.",
      "magic-link-email": "Envoyez-moi un lien de connexion.",
      "magic-link-sent": "Consultez votre boîte mail pour le lien de connexion.",
      "signed-in": "Votre compte est prêt.",
    },
    yourEmail: "votre e-mail",
    signedInAs: "Connecté en tant que {email}.",
    signOut: "Se déconnecter",
    returnToDashboard: "Retour au tableau de bord",
    continueWith: "Continuer avec {provider}",
    lastUsed: "Dernière utilisation",
    emailMeCode: "Envoyez-moi un code",
    createAccount: "Créer un compte",
    createPassword: "Créer un mot de passe",
    emailMeLink: "Envoyez-moi un lien",
    emailLabel: "Adresse e-mail",
    passwordLabel: "Mot de passe",
    codeSentTo: "Code envoyé à {email}.",
    emailCodeLabel: "Code e-mail",
    verifyCode: "Vérifier le code",
    linkSentTo: "Lien de connexion envoyé à {email}. Ouvrez-le sur cet appareil pour continuer.",
    back: "Choisir une autre méthode",
    authjsTitle: "Se connecter",
    authjsIntro:
      "Utilisez votre e-mail et votre mot de passe, ou continuez avec un fournisseur connecté.",
    signIn: "Se connecter",
    signingIn: "Connexion en cours…",
    authjsEngineNote:
      "L'OTP par e-mail, les liens magiques, les passkeys et la connexion à deux facteurs sont fournis par le moteur Better Auth.",
    authjsEngineEnable: "Définissez {setting} pour les activer.",
  },
  nav: {
    pricing: "Tarifs",
    faq: "FAQ",
    blog: "Blog",
    docs: "Docs",
    waitlist: "Liste d'attente",
    getAccess: "Commencer",
  },
  marketingLanding: {
    title: "Votre app, votre point de départ.",
    description:
      "Ceci est une démo de modèle pour le web, le mobile et le bureau. Explorez l’app d’exemple, remplacez le contenu et configurez les modules pour votre produit.",
    primaryAction: "Ouvrir la démo",
    metadataTitle: "Démo du modèle",
    metadataDescription:
      "Explorez une app d’exemple avec Next.js, Expo et Tauri. Testez les modules partagés, consultez les guides et adaptez le contenu d’exemple à votre produit.",
  },
  settings: {
    title: "Paramètres",
    workspaceExport: {
      title: "Données de l’espace de travail",
      description:
        "Téléchargez une copie JSON du contenu, de la boutique, des membres et des réglages de cet espace de travail.",
      action: "Exporter l’espace de travail",
    },
    sections: {
      general: { label: "Général", description: "Profil, nom affiché et avatar." },
      appearance: {
        label: "Apparence",
        description: "Palettes, densité, rayon, polices et galerie d’UI du kit.",
      },
      security: {
        label: "Sécurité",
        description: "Méthodes de connexion, passkeys et authentification à deux facteurs.",
      },
      billing: {
        label: "Facturation",
        description: "Offres produit, essais et portail client.",
      },
      usage: {
        label: "Utilisation",
        description:
          "Dépenses IA, limites de compteurs et crédits prépayés de l’espace de travail.",
      },
      members: {
        label: "Membres",
        description: "Invitations et rôles de l’espace de travail actif.",
      },
      notifications: {
        label: "Notifications",
        description: "Centre de notifications et préférences e-mail.",
      },
      developers: {
        label: "Développeurs",
        description: "Clés API et webhooks sortants de l’espace de travail actif.",
      },
      connections: {
        label: "Connexions",
        description:
          "Comptes externes via lesquels l’espace de travail peut envoyer et synchroniser.",
        panel: {
          actionFailed: "L’action n’a pas pu aboutir. Réessayez.",
          connectProvider: "Connecter {provider}",
          disconnect: "Déconnecter",
          disconnected: "Compte déconnecté.",
          disconnectConfirm:
            "Déconnecter ce compte ? L’espace de travail perd immédiatement l’accès.",
          emptyText: "Connectez un fournisseur OAuth ou ajoutez un compte SMTP pour commencer.",
          emptyTitle: "Aucune connexion pour le moment",
          flashConnected: "Compte connecté.",
          flashDenied: "Autorisation refusée — rien n’a été connecté.",
          flashError: "La connexion n’a pas pu aboutir. Réessayez.",
          flashUnavailable: "Ce fournisseur n’est pas disponible sur ce déploiement.",
          lastRefreshed: "Dernière actualisation {date}",
          managerOnly: "Rôle propriétaire ou administrateur requis.",
          notConfigured: "Non configuré — définissez {envVar}.",
          oauthSummary:
            "Comptes de fournisseurs via lesquels l’espace de travail agit. Les jetons sont stockés chiffrés et renouvelés automatiquement.",
          oauthTitle: "Comptes OAuth",
          reconnect: "Reconnecter",
          refreshNotFound: "Ce compte connecté n’existe plus — rechargez la page.",
          refreshNotRefreshable: "Seuls les comptes OAuth peuvent être actualisés.",
          refreshNow: "Actualiser",
          refreshReconnect:
            "Reconnexion requise — le fournisseur a rejeté l’autorisation enregistrée.",
          refreshSuperseded: "Ce compte a changé pendant l’actualisation — rechargez la page.",
          refreshUpstream: "Le fournisseur est injoignable. Réessayez plus tard.",
          refreshed: "Jetons actualisés.",
          smtpAdd: "Ajouter un compte SMTP",
          smtpHost: "Hôte",
          smtpLabel: "Libellé (facultatif)",
          smtpPassword: "Mot de passe",
          smtpPort: "Port",
          smtpSecure: "TLS implicite (port 465)",
          smtpSummary:
            "Boîtes aux lettres de l’espace de travail accessibles via SMTP. Le mot de passe est stocké chiffré.",
          smtpTitle: "Comptes SMTP",
          smtpUsername: "Nom d’utilisateur",
          statusActive: "Actif",
          statusNeedsReauth: "Reconnexion requise",
          statusRevoked: "Révoqué",
          tokenExpires: "Le jeton expire {date}",
        },
      },
      domains: {
        label: "Domaines",
        description: "Noms d’hôte personnalisés (marque blanche) de l’espace actif.",
      },
      audit: {
        label: "Journal d’audit",
        description: "Activité de l’espace : invitations, membres et identifiants.",
      },
    },
  },
  billing: {
    credits: {
      title: "Crédits",
      intro:
        "Les crédits prépayés maintiennent les actions mesurées de l’espace de travail actives une fois le quota du forfait épuisé.",
      balanceLabel: "Crédits disponibles",
      empty: "Aucun mouvement de crédits pour le moment.",
      kinds: {
        adjustment: "Ajustement",
        debit: "Débit",
        expire: "Expiration",
        grant: "Attribution",
        refund: "Remboursement",
      },
    },
  },
  org: {
    settingsTitle: "Paramètres de l’organisation",
    settingsSummary:
      "Renommez ou supprimez l’organisation active. Seuls les propriétaires peuvent faire des changements destructeurs.",
    general: "Général",
    dangerZone: "Zone de danger",
    dangerSummary:
      "Supprimer une organisation retire les adhésions et les données produit pour tout le monde.",
    leave: "Quitter l’organisation",
    leaveSummary:
      "Quittez l’organisation active. Un propriétaire unique doit transférer la propriété ou la supprimer.",
    renameSaved: "Organisation renommée.",
    ownerRequired: "Rôle propriétaire requis.",
  },
  mail: {
    inviteSubject: "Invitation à une organisation supastack",
    inviteBody: (orgName, acceptUrl) =>
      `Vous êtes invité à rejoindre ${orgName}. Accepter l'invitation : ${acceptUrl}`,
    earlyAccessSubject: "Votre invitation early access supastack",
    earlyAccessBody: (signupUrl) =>
      `Vous êtes sorti de la liste d'attente. Réclamez votre accès anticipé ici : ${signupUrl}`,
    otpSignInSubject: "Votre code de connexion supastack",
    otpResetSubject: "Votre code de réinitialisation supastack",
    otpSignInBody: (code) => `Votre code de connexion est ${code}`,
    otpResetBody: (code) => `Votre code de réinitialisation est ${code}`,
    magicLinkSubject: "Votre lien de connexion supastack",
    magicLinkBody: (url) => `Ouvrez ce lien pour vous connecter : ${url}`,
    aiCompleteSubject: "Votre tâche IA est terminée",
    aiCompleteBody:
      "Votre tâche IA s’est terminée avec succès. Ouvrez l’application pour voir le résultat.",
    billingFailedSubject: "Échec du paiement de facturation",
    billingFailedBody:
      "Un paiement de facturation a échoué. Mettez à jour les détails de paiement dans le portail.",
    transactionalFooter: "Ceci est un message transactionnel de supastack. Ne pas répondre.",
  },
  notifications: {
    title: "Notifications",
    empty: "Aucune notification pour le moment.",
    emailInvites: "M'envoyer des e-mails d'invitation",
    emailBilling: "M'envoyer des e-mails de facturation",
    inAppProduct: "Afficher les notifications produit dans l'app",
  },
  notificationEvents: {
    checkoutSucceeded: {
      title: "Abonnement actif",
      body: "Le droit de facturation est maintenant actif pour cet espace de travail.",
    },
    paymentFailed: {
      title: "Paiement échoué",
      body: "Un paiement de facturation a échoué. Mettez à jour les détails de paiement.",
    },
    subscriptionEnded: {
      title: "Abonnement terminé",
      body: "L’abonnement de cet espace est inactif. Choisissez une offre pour continuer.",
    },
    budgetExceeded: {
      title: "Budget IA atteint",
      body: "Cet espace a atteint son budget IA mensuel. Les nouvelles tentatives fournisseur sont bloquées.",
    },
    inviteAccepted: {
      title: "Invitation acceptée",
      body: (memberEmail) => `${memberEmail} a rejoint cet espace de travail.`,
    },
    memberLeft: {
      title: "Membre parti",
      body: (memberEmail) => `${memberEmail} a quitté cet espace de travail.`,
    },
    memberRemoved: {
      title: "Membre retiré",
      body: (memberEmail) => `${memberEmail} a été retiré de cet espace de travail.`,
    },
    memberRoleChanged: {
      title: "Rôle mis à jour",
      body: (memberEmail, role) => `${memberEmail} est maintenant ${role}.`,
    },
    connectedAccountReauth: {
      title: "Compte à reconnecter",
      body: (accountLabel) =>
        `${accountLabel} n’a pas pu renouveler son accès. Reconnectez-le pour qu’il continue à fonctionner.`,
    },
  },
};

export const dictionaries: Readonly<Record<AppLocale, MessageDictionary>> = Object.freeze({
  en,
  de,
  es,
  fr,
});

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "de" || value === "es" || value === "fr";
}

export function resolveLocale(
  candidates: readonly (string | null | undefined)[],
  fallback: AppLocale = DEFAULT_LOCALE,
): AppLocale {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.trim().toLowerCase().slice(0, 2);
    if (isAppLocale(normalized)) {
      return normalized;
    }
  }
  return fallback;
}

export function getDictionary(locale: AppLocale): MessageDictionary {
  return dictionaries[locale];
}

export function localePath(locale: AppLocale, pathname = "/"): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === DEFAULT_LOCALE) {
    return path === "" ? "/" : path;
  }
  if (path === "/") {
    return `/${locale}`;
  }
  return `/${locale}${path}`;
}

export function stripLocalePrefix(pathname: string): Readonly<{
  locale: AppLocale | null;
  pathname: string;
}> {
  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];
  if (!isAppLocale(maybeLocale)) {
    return { locale: null, pathname: pathname || "/" };
  }
  const rest = `/${segments.slice(1).join("/")}`;
  return { locale: maybeLocale, pathname: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/" };
}
