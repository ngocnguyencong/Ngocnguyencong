import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LeadRecord, LeadStore } from "./marketing-leads";

const DEFAULT_STORE_PATH = path.join(process.cwd(), ".data", "marketing-leads.json");
const FIRESTORE_COLLECTION = "marketing_leads";

/**
 * Dev placeholder: appends leads to a local JSON file so the marketing forms
 * are fully testable without any backend. Data really is written to disk
 * (never faked), but this file is gitignored dev state — NOT production
 * storage.
 */
function createLocalFileStore(filePath = DEFAULT_STORE_PATH): LeadStore {
  async function readLeads(): Promise<LeadRecord[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as LeadRecord[]) : [];
    } catch {
      return [];
    }
  }

  return {
    async save(lead) {
      const leads = await readLeads();
      if (
        lead.kind === "newsletter" &&
        leads.some((existing) => existing.kind === "newsletter" && existing.email === lead.email)
      ) {
        return "duplicate";
      }
      leads.push(lead);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
      return "created";
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`MARKETING_LEAD_STORE=firestore requires ${name} to be set`);
  }
  return value;
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

async function createFirestoreStore(): Promise<LeadStore> {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(requireEnv("FIREBASE_PRIVATE_KEY"));
  const databaseId = process.env.FIRESTORE_DATABASE?.trim() || "(default)";

  // Lazy import so local/dev never loads firebase-admin unless selected.
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
          projectId,
        });

  const db = databaseId === "(default)" ? getFirestore(app) : getFirestore(app, databaseId);

  return {
    async save(lead) {
      const collection = db.collection(FIRESTORE_COLLECTION);
      const fields: Record<string, string> = {
        kind: lead.kind,
        email: lead.email,
        receivedAt: lead.receivedAt,
        ...(lead.name !== undefined ? { name: lead.name } : {}),
        ...(lead.message !== undefined ? { message: lead.message } : {}),
      };
      if (lead.kind === "contact") {
        await collection.add(fields);
        return "created";
      }
      try {
        await collection.doc(`newsletter:${lead.email}`).create(fields);
        return "created";
      } catch (error: unknown) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? Number(error.code)
            : undefined;
        if (code === 6 || code === 409) {
          return "duplicate";
        }
        throw error;
      }
    },
  };
}

/**
 * Returns the configured lead store, or `undefined` when
 * MARKETING_LEAD_STORE is unset (lead capture stays email-notify only).
 */
export async function getLeadStore(): Promise<LeadStore | undefined> {
  switch (process.env.MARKETING_LEAD_STORE?.trim() ?? "") {
    case "":
      return undefined;
    case "local":
      return createLocalFileStore(process.env.MARKETING_LEAD_STORE_PATH ?? DEFAULT_STORE_PATH);
    case "firestore":
      return createFirestoreStore();
    default:
      throw new Error(`Unknown MARKETING_LEAD_STORE value: ${process.env.MARKETING_LEAD_STORE}`);
  }
}
