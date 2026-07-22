import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DataRow } from '../types';

export interface DummyUser {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  company: string;
  status?: 'approved' | 'pending' | 'rejected';
  isAdmin?: boolean;
}

export const DUMMY_USERS: DummyUser[] = [
  { name: 'Hansika', email: 'hansika@example.com', passwordHash: 'password123', role: 'Lead Data Scientist', company: 'Acme Corporation', status: 'approved', isAdmin: false },
  { name: 'Karthik', email: 'karthik@example.com', passwordHash: 'password123', role: 'Database Administrator', company: 'Globex Industries', status: 'approved', isAdmin: true },
  { name: 'Sneha', email: 'sneha@example.com', passwordHash: 'password123', role: 'Product Manager', company: 'Initech Logistics', status: 'approved', isAdmin: false },
  { name: 'Suma', email: 'suma@example.com', passwordHash: 'password123', role: 'Security Analyst', company: 'Umbrella Corp', status: 'approved', isAdmin: false },
  { name: 'System Admin', email: 'admin@example.com', passwordHash: 'admin123', role: 'System Administrator', company: 'Leadcleanse Systems', status: 'approved', isAdmin: true },
];

export interface AttachedFileRecord {
  id: string;
  filename: string;
  attachedAt: string;
  sizeBytes: number;
  rowsCount: number;
  columnsCount: number;
  attachedBy: string;
  userAgent?: string;
}

export interface ExportRecord {
  id: string;
  filename: string;
  exportedAt: string;
  rowsCount: number;
  exportType: string;
  exportedBy: string;
  userAgent?: string;
}

export interface DownloadRecord {
  id: string;
  filename: string;
  downloadedAt: string;
  downloadedBy: string;
  fileType: string;
  userAgent?: string;
}

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Load custom keys from localStorage if they exist
const storedUrl = localStorage.getItem('datacleanse_supabase_url');
const storedKey = localStorage.getItem('datacleanse_supabase_anon_key');
if (storedUrl) supabaseUrl = storedUrl;
if (storedKey) supabaseAnonKey = storedKey;

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      return supabaseClient;
    } catch (e) {
      console.error('Failed to initialize Supabase client', e);
    }
  }
  return null;
}

export function updateSupabaseConfig(url: string, anonKey: string) {
  if (url) {
    localStorage.setItem('datacleanse_supabase_url', url);
    supabaseUrl = url;
  } else {
    localStorage.removeItem('datacleanse_supabase_url');
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  }

  if (anonKey) {
    localStorage.setItem('datacleanse_supabase_anon_key', anonKey);
    supabaseAnonKey = anonKey;
  } else {
    localStorage.removeItem('datacleanse_supabase_anon_key');
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }

  supabaseClient = null; // Re-initialize on next call
}

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  };
}

// INDEXEDDB DATABASE FALLBACK
const DB_NAME = 'datacleanse_indexeddb';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('attached_files')) {
        db.createObjectStore('attached_files', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('export_log')) {
        db.createObjectStore('export_log', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('download_log')) {
        db.createObjectStore('download_log', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('user_accounts')) {
        db.createObjectStore('user_accounts', { keyPath: 'email' });
      }
    };
  });
}

function getAllFromStore<T>(storeName: string): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function getFromStore<T>(storeName: string, id: string): Promise<T | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function putInStore<T>(storeName: string, item: T): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function clearStore(storeName: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

// Migration helper from localStorage to IndexedDB
async function migrateLocalStorageToIndexedDB() {
  try {
    const rawAttached = localStorage.getItem('datacleanse_attached_files');
    if (rawAttached) {
      const attached = JSON.parse(rawAttached);
      if (Array.isArray(attached)) {
        for (const item of attached) {
          await putInStore('attached_files', item);
        }
      }
      localStorage.removeItem('datacleanse_attached_files');
    }

    const rawExport = localStorage.getItem('datacleanse_export_log');
    if (rawExport) {
      const exports = JSON.parse(rawExport);
      if (Array.isArray(exports)) {
        for (const item of exports) {
          await putInStore('export_log', item);
        }
      }
      localStorage.removeItem('datacleanse_export_log');
    }

    const rawDownload = localStorage.getItem('datacleanse_download_log');
    if (rawDownload) {
      const downloads = JSON.parse(rawDownload);
      if (Array.isArray(downloads)) {
        for (const item of downloads) {
          await putInStore('download_log', item);
        }
      }
      localStorage.removeItem('datacleanse_download_log');
    }
  } catch (e) {
    console.error('Failed to migrate localStorage data to IndexedDB', e);
  }
}

// Run migration immediately
if (typeof window !== 'undefined') {
  migrateLocalStorageToIndexedDB();
}

// ASYNC LOGGING AND QUERY FUNCTIONS FOR APP
export async function getAttachedFiles(): Promise<AttachedFileRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('attached_files')
        .select('id, filename, attached_at, size_bytes, rows_count, columns_count, attached_by, user_agent')
        .order('attached_at', { ascending: false });
      if (!error && data) {
        return (data as Record<string, unknown>[]).map((d) => ({
          id: String(d.id),
          filename: String(d.filename),
          attachedAt: String(d.attached_at),
          sizeBytes: Number(d.size_bytes),
          rowsCount: Number(d.rows_count),
          columnsCount: Number(d.columns_count),
          attachedBy: String(d.attached_by || 'Unknown'),
          userAgent: d.user_agent ? String(d.user_agent) : undefined,
        }));
      }
      console.error('Supabase query error', error);
    } catch (err) {
      console.error('Supabase query failed', err);
    }
  }

  // Local IndexedDB fallback
  try {
    const localRecords = await getAllFromStore<{ id: string; filename: string; attachedAt: string; sizeBytes: number; rowsCount: number; columnsCount: number; attachedBy: string; userAgent?: string }>('attached_files');
    localRecords.sort((a, b) => new Date(b.attachedAt).getTime() - new Date(a.attachedAt).getTime());
    return localRecords.map(d => ({
      id: d.id,
      filename: d.filename,
      attachedAt: d.attachedAt,
      sizeBytes: d.sizeBytes,
      rowsCount: d.rowsCount,
      columnsCount: d.columnsCount,
      attachedBy: d.attachedBy || 'Unknown',
      userAgent: d.userAgent,
    }));
  } catch (err) {
    console.error('Failed to query local IndexedDB attached_files', err);
    return [];
  }
}

export async function logAttachedFile(
  filename: string,
  sizeBytes: number,
  rowsCount: number,
  columnsCount: number,
  username: string,
  rows: DataRow[]
): Promise<AttachedFileRecord> {
  const client = getSupabaseClient();
  const fileContentString = JSON.stringify(rows);
  const nowStr = new Date().toISOString();
  const agent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  if (client) {
    try {
      const { data, error } = await client
        .from('attached_files')
        .insert({
          filename,
          size_bytes: sizeBytes,
          rows_count: rowsCount,
          columns_count: columnsCount,
          attached_by: username,
          user_agent: agent,
          file_content: fileContentString,
        })
        .select('id, filename, attached_at, size_bytes, rows_count, columns_count, attached_by, user_agent')
        .single();
      if (!error && data) {
        const d = data as Record<string, unknown>;
        return {
          id: String(d.id),
          filename: String(d.filename),
          attachedAt: String(d.attached_at),
          sizeBytes: Number(d.size_bytes),
          rowsCount: Number(d.rows_count),
          columnsCount: Number(d.columns_count),
          attachedBy: String(d.attached_by || username),
          userAgent: d.user_agent ? String(d.user_agent) : undefined,
        };
      }
      console.error('Supabase insert failed', error);
    } catch (err) {
      console.error('Supabase insert exception', err);
    }
  }

  // Local IndexedDB fallback
  const newRecord = {
    id: Math.random().toString(36).substring(2, 9),
    filename,
    attachedAt: nowStr,
    sizeBytes,
    rowsCount,
    columnsCount,
    attachedBy: username,
    userAgent: agent,
    file_content: fileContentString,
  };
  try {
    await putInStore('attached_files', newRecord);
  } catch (err) {
    console.error('Failed to save attached file to local IndexedDB', err);
  }
  return {
    id: newRecord.id,
    filename: newRecord.filename,
    attachedAt: newRecord.attachedAt,
    sizeBytes: newRecord.sizeBytes,
    rowsCount: newRecord.rowsCount,
    columnsCount: newRecord.columnsCount,
    attachedBy: newRecord.attachedBy,
    userAgent: newRecord.userAgent,
  };
}

export async function getExportLog(): Promise<ExportRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('export_log')
        .select('id, filename, exported_at, rows_count, export_type, exported_by, user_agent')
        .order('exported_at', { ascending: false });
      if (!error && data) {
        return (data as Record<string, unknown>[]).map((d) => ({
          id: String(d.id),
          filename: String(d.filename),
          exportedAt: String(d.exported_at),
          rowsCount: Number(d.rows_count),
          exportType: String(d.export_type),
          exportedBy: String(d.exported_by || 'Unknown'),
          userAgent: d.user_agent ? String(d.user_agent) : undefined,
        }));
      }
      console.error('Supabase export query error', error);
    } catch (err) {
      console.error('Supabase query failed', err);
    }
  }

  // Local IndexedDB fallback
  try {
    const localRecords = await getAllFromStore<{ id: string; filename: string; exportedAt: string; rowsCount: number; exportType: string; exportedBy: string; userAgent?: string }>('export_log');
    localRecords.sort((a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime());
    return localRecords.map(d => ({
      id: d.id,
      filename: d.filename,
      exportedAt: d.exportedAt,
      rowsCount: d.rowsCount,
      exportType: d.exportType,
      exportedBy: d.exportedBy || 'Unknown',
      userAgent: d.userAgent,
    }));
  } catch (err) {
    console.error('Failed to query local IndexedDB export_log', err);
    return [];
  }
}

export async function logExport(
  filename: string,
  rowsCount: number,
  exportType: string,
  username: string,
  rows: DataRow[]
): Promise<ExportRecord> {
  const client = getSupabaseClient();
  const fileContentString = JSON.stringify(rows);
  const nowStr = new Date().toISOString();
  const agent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  if (client) {
    try {
      const { data, error } = await client
        .from('export_log')
        .insert({
          filename,
          rows_count: rowsCount,
          export_type: exportType,
          exported_by: username,
          user_agent: agent,
          file_content: fileContentString,
        })
        .select('id, filename, exported_at, rows_count, export_type, exported_by, user_agent')
        .single();
      if (!error && data) {
        const d = data as Record<string, unknown>;
        return {
          id: String(d.id),
          filename: String(d.filename),
          exportedAt: String(d.exported_at),
          rowsCount: Number(d.rows_count),
          exportType: String(d.export_type),
          exportedBy: String(d.exported_by || username),
          userAgent: d.user_agent ? String(d.user_agent) : undefined,
        };
      }
      console.error('Supabase insert failed', error);
    } catch (err) {
      console.error('Supabase insert exception', err);
    }
  }

  // Local IndexedDB fallback
  const newRecord = {
    id: Math.random().toString(36).substring(2, 9),
    filename,
    exportedAt: nowStr,
    rowsCount,
    exportType,
    exportedBy: username,
    userAgent: agent,
    file_content: fileContentString,
  };
  try {
    await putInStore('export_log', newRecord);
  } catch (err) {
    console.error('Failed to save export to local IndexedDB', err);
  }
  return {
    id: newRecord.id,
    filename: newRecord.filename,
    exportedAt: newRecord.exportedAt,
    rowsCount: newRecord.rowsCount,
    exportType: newRecord.exportType,
    exportedBy: newRecord.exportedBy,
    userAgent: newRecord.userAgent,
  };
}

export async function getAttachedFileContent(id: string): Promise<DataRow[] | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('attached_files')
        .select('file_content')
        .eq('id', id)
        .single();
      if (!error && data && data.file_content) {
        return JSON.parse(data.file_content) as DataRow[];
      }
    } catch (e) {
      console.error('Failed to get attached file content from Supabase', e);
    }
  }

  // Local IndexedDB fallback
  try {
    const match = await getFromStore<{ file_content?: string }>('attached_files', id);
    if (match && match.file_content) {
      return JSON.parse(match.file_content) as DataRow[];
    }
  } catch (e) {
    console.error('Failed to parse file_content JSON fallback from IndexedDB', e);
  }
  return null;
}

export async function getExportFileContent(id: string): Promise<DataRow[] | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('export_log')
        .select('file_content')
        .eq('id', id)
        .single();
      if (!error && data && data.file_content) {
        return JSON.parse(data.file_content) as DataRow[];
      }
    } catch (e) {
      console.error('Failed to get export content from Supabase', e);
    }
  }

  // Local IndexedDB fallback
  try {
    const match = await getFromStore<{ file_content?: string }>('export_log', id);
    if (match && match.file_content) {
      return JSON.parse(match.file_content) as DataRow[];
    }
  } catch (e) {
    console.error('Failed to parse file_content JSON fallback from IndexedDB', e);
  }
  return null;
}

export async function logDownload(filename: string, username: string, fileType: string): Promise<DownloadRecord> {
  const client = getSupabaseClient();
  const nowStr = new Date().toISOString();
  const agent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  if (client) {
    try {
      const { data, error } = await client
        .from('download_log')
        .insert({
          filename,
          downloaded_by: username,
          user_agent: agent,
          file_type: fileType,
        })
        .select('id, filename, downloaded_at, downloaded_by, file_type, user_agent')
        .single();
      if (!error && data) {
        const d = data as Record<string, unknown>;
        return {
          id: String(d.id),
          filename: String(d.filename),
          downloadedAt: String(d.downloaded_at),
          downloadedBy: String(d.downloaded_by),
          fileType: String(d.file_type),
          userAgent: d.user_agent ? String(d.user_agent) : undefined,
        };
      }
      console.error('Supabase download insert failed', error);
    } catch (err) {
      console.error('Supabase download insert exception', err);
    }
  }

  // Local IndexedDB fallback
  const newRecord: DownloadRecord = {
    id: Math.random().toString(36).substring(2, 9),
    filename,
    downloadedAt: nowStr,
    downloadedBy: username,
    fileType,
    userAgent: agent,
  };
  try {
    await putInStore('download_log', newRecord);
  } catch (err) {
    console.error('Failed to save download log to IndexedDB', err);
  }
  return newRecord;
}

export async function getDownloadLog(): Promise<DownloadRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('download_log')
        .select('id, filename, downloaded_at, downloaded_by, file_type, user_agent')
        .order('downloaded_at', { ascending: false });
      if (!error && data) {
        return (data as Record<string, unknown>[]).map((d) => ({
          id: String(d.id),
          filename: String(d.filename),
          downloadedAt: String(d.downloaded_at),
          downloadedBy: String(d.downloaded_by || 'Unknown'),
          fileType: String(d.file_type),
          userAgent: d.user_agent ? String(d.user_agent) : undefined,
        }));
      }
      console.error('Supabase download query error', error);
    } catch (err) {
      console.error('Supabase query failed', err);
    }
  }

  // Local IndexedDB fallback
  try {
    const localRecords = await getAllFromStore<DownloadRecord>('download_log');
    localRecords.sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
    return localRecords;
  } catch (err) {
    console.error('Failed to query local IndexedDB download_log', err);
    return [];
  }
}

export async function clearDatabaseHistory(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await Promise.all([
        client.from('attached_files').delete().neq('filename', ''),
        client.from('export_log').delete().neq('filename', ''),
        client.from('download_log').delete().neq('filename', ''),
      ]);
    } catch (e) {
      console.error('Supabase delete failed', e);
    }
  }

  // Local IndexedDB fallback
  try {
    await Promise.all([
      clearStore('attached_files'),
      clearStore('export_log'),
      clearStore('download_log'),
    ]);
  } catch (e) {
    console.error('Failed to clear local IndexedDB', e);
  }
}

export async function syncUserToDatabase(user: DummyUser): Promise<void> {
  const client = getSupabaseClient();
  const userData = {
    email: user.email.toLowerCase(),
    name: user.name,
    password_hash: user.passwordHash,
    role: user.role,
    company: user.company,
    status: user.status || 'approved',
    is_admin: !!user.isAdmin,
    updated_at: new Date().toISOString(),
  };

  if (client) {
    try {
      const { error } = await client
        .from('users_profile')
        .upsert(userData, { onConflict: 'email' });
      if (error) {
        console.error('Supabase user profile upsert error:', error);
      }
    } catch (e) {
      console.error('Supabase user profile sync exception:', e);
    }
  }

  // Also save in local IndexedDB store
  try {
    await putInStore('user_accounts', {
      email: user.email.toLowerCase(),
      name: user.name,
      passwordHash: user.passwordHash,
      role: user.role,
      company: user.company,
      status: user.status || 'approved',
      isAdmin: !!user.isAdmin,
    });
  } catch (e) {
    console.error('IndexedDB user accounts store error:', e);
  }
}

export async function getDatabaseUsers(): Promise<DummyUser[]> {
  const client = getSupabaseClient();
  let dbUsers: DummyUser[] = [];

  if (client) {
    try {
      const { data, error } = await client
        .from('users_profile')
        .select('email, name, password_hash, role, company, status, is_admin');
      if (!error && data && data.length > 0) {
        dbUsers = data.map((d: Record<string, unknown>) => ({
          email: String(d.email || ''),
          name: String(d.name || ''),
          passwordHash: String(d.password_hash || ''),
          role: String(d.role || ''),
          company: String(d.company || ''),
          status: (d.status as 'approved' | 'pending' | 'rejected') || 'approved',
          isAdmin: Boolean(d.is_admin),
        }));
      }
    } catch (e) {
      console.error('Supabase get user profiles exception:', e);
    }
  }

  // Fallback to IndexedDB local user accounts store if Supabase returned nothing
  if (dbUsers.length === 0) {
    try {
      const localAccounts = await getAllFromStore<DummyUser>('user_accounts');
      if (localAccounts && localAccounts.length > 0) {
        dbUsers = localAccounts;
      }
    } catch (e) {
      console.error('IndexedDB user accounts fetch error:', e);
    }
  }

  return dbUsers;
}
