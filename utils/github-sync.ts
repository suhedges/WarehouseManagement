import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Warehouse, WarehouseFile, RecordConflict } from '@/types';

const GITHUB_TOKEN_KEY = 'github_token';
const GITHUB_REPO_KEY = 'github_repo';
const GITHUB_OWNER_KEY = 'github_owner';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

function stableStringify(v: any): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((item) => (item === undefined ? 'null' : stableStringify(item))).join(',') + ']';
  const keys = Object.keys(v).filter((k) => (v as any)[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((v as any)[k])).join(',') + '}';
}

function sanitizeForJson<T = any>(value: T): T {
  if (value === undefined) return null as unknown as T;
  if (value === null || typeof value !== 'object') return value as T;
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : sanitizeForJson(item))) as unknown as T;
  const out: Record<string, any> = {};
  Object.keys(value as Record<string, any>).forEach((k) => {
    const v = (value as Record<string, any>)[k];
    if (v !== undefined) {
      out[k] = sanitizeForJson(v);
    }
  });
  return out as T;
}

function isWarehouseFile(v: unknown): v is WarehouseFile {
  const obj = v as WarehouseFile | null;
  return !!obj && typeof obj === 'object' && !!(obj as any).meta && Array.isArray((obj as any).warehouses) && Array.isArray((obj as any).products);
}

function safeParseJson<T>(text: string | null | undefined, fallback: T): T {
  try {
    if (!text) return fallback;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed === 'undefined') return fallback;
    const parsed = JSON.parse(trimmed) as unknown;
    return (parsed ?? fallback) as T;
  } catch (e) {
    console.warn('safeParseJson failed, using fallback', e);
    return fallback;
  }
}

export class GitHubSyncService {
  private config: GitHubConfig | null = null;
  private username: string = 'local';

  setUser(username: string | null) {
    this.username = (username && username.trim().length > 0) ? username.trim() : 'local';
  }

  private get dataFilePath(): string {
    return `warehouse-data-${this.username}.json`;
  }

  private get baseSnapshotKey(): string {
    return `github_base_snapshot_${this.username}`;
  }

  async loadConfig(): Promise<GitHubConfig | null> {
    try {
      const token = await AsyncStorage.getItem(GITHUB_TOKEN_KEY);
      const owner = await AsyncStorage.getItem(GITHUB_OWNER_KEY);
      const repo = await AsyncStorage.getItem(GITHUB_REPO_KEY);
      
      if (token && owner && repo) {
        this.config = { token, owner, repo };
        return this.config;
      }
    } catch (error) {
      console.error('Failed to load GitHub config:', error);
    }
    return null;
  }

  async saveConfig(config: GitHubConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(GITHUB_TOKEN_KEY, config.token);
      await AsyncStorage.setItem(GITHUB_OWNER_KEY, config.owner);
      await AsyncStorage.setItem(GITHUB_REPO_KEY, config.repo);
      this.config = config;
    } catch (error) {
      console.error('Failed to save GitHub config:', error);
      throw error;
    }
  }

  async clearConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem(GITHUB_TOKEN_KEY);
      await AsyncStorage.removeItem(GITHUB_OWNER_KEY);
      await AsyncStorage.removeItem(GITHUB_REPO_KEY);
      this.config = null;
    } catch (error) {
      console.error('Failed to clear GitHub config:', error);
    }
  }

  private async makeGitHubRequest(endpoint: string, options: RequestInit = {}, attempt = 0): Promise<Response> {
    if (!this.config) throw new Error('GitHub configuration not set');

    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    
    const remaining = Number(response.headers.get('X-RateLimit-Remaining') || '1');
    if ((response.status === 403 || response.status === 429 || remaining === 0) && attempt < 5) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      const delay = retryAfter > 0 ? retryAfter : Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.makeGitHubRequest(endpoint, options, attempt + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response;
  }

  async downloadData(): Promise<{ data: WarehouseFile; sha: string } | null> {
    try {
      const response = await this.makeGitHubRequest(`contents/${this.dataFilePath}`);
      const file = await response.json();
      if (file?.content) {
        const decoded = atob(String(file.content).replace(/\n/g, ''));
        try {
          const json = JSON.parse(decoded);
          if (!isWarehouseFile(json)) throw new Error('Invalid shape');
          return { data: json, sha: String(file.sha) };
        } catch (e) {
          console.warn('downloadData: JSON parse failed, attempting to repair', e);
          const repaired = decoded.replace(/\bundefined\b/g, 'null');
          const json = JSON.parse(repaired);
          if (!isWarehouseFile(json)) throw new Error('Invalid shape after repair');
          return { data: json, sha: String(file.sha) };
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
    return null;
  }

  async syncData(
    localWarehouses: Warehouse[],
    localProducts: Product[],
  ): Promise<{ warehouses: Warehouse[]; products: Product[]; conflicts: RecordConflict[] }> {
    throw new Error('syncData is deprecated. Use pullRemoteOnLogin() and pushLocalOnly()');
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getConfig(): GitHubConfig | null {
    return this.config;
  }

  private async getRemoteFile(): Promise<{ sha: string; text: string } | null> {
    try {
      const res = await this.makeGitHubRequest(`contents/${this.dataFilePath}`, { method: 'GET' });
      const json = await res.json();
      if (!json?.content || !json?.sha) return null;
      const remoteBytes = atob(String(json.content).replace(/\n/g, ''));
      return { sha: String(json.sha), text: remoteBytes };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('404')) {
        console.log('getRemoteFile: file not found on GitHub, will create on next upload', this.dataFilePath);
        return null;
      }
      console.error('getRemoteFile failed', e);
      throw e as Error;
    }
  }

  async uploadData(data: WarehouseFile, currentSha: string | null): Promise<string> {
    const sanitized = sanitizeForJson<WarehouseFile>(data);
    const desiredText = stableStringify(sanitized);
    let sha = currentSha;

    if (!sha) {
      const remote = await this.getRemoteFile();
      if (remote && remote.text === desiredText) {
        return remote.sha;
      }
      sha = remote?.sha ?? null;
    }

    const body: Record<string, any> = {
      message: 'Update warehouse data',
      content: btoa(desiredText),
    };
    if (sha) body.sha = sha;

    const res = await this.makeGitHubRequest(`contents/${this.dataFilePath}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const result = await res.json();
    return (result?.content?.sha ?? '') as string;
  }

  async resetBaseSnapshot(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.baseSnapshotKey);
      console.log('GitHubSyncService: BASE_SNAPSHOT reset for', this.username);
    } catch (e) {
      console.error('GitHubSyncService: Failed to reset BASE_SNAPSHOT', e);
      throw e as Error;
    }
  }

  async setBaseSnapshot(data: WarehouseFile, sha: string | null): Promise<void> {
    try {
      const payload = { data: sanitizeForJson(data), sha };
      await AsyncStorage.setItem(this.baseSnapshotKey, JSON.stringify(payload));
    } catch (e) {
      console.error('GitHubSyncService: Failed to set BASE_SNAPSHOT', e);
      throw e as Error;
    }
  }
  
  async getBaseSnapshot(): Promise<{ data: WarehouseFile; sha: string | null } | null> {
    try {
      const text = await AsyncStorage.getItem(this.baseSnapshotKey);
      if (!text) return null;
      const parsed = safeParseJson<any>(text, null);
      if (!parsed) return null;
      if (parsed.data && parsed.sha !== undefined) {
        return { data: parsed.data as WarehouseFile, sha: parsed.sha as string | null };
      }
      return { data: parsed as WarehouseFile, sha: null };
    } catch (e) {
      console.error('GitHubSyncService: Failed to get BASE_SNAPSHOT', e);
      return null;
    }
  }  

  async pullRemoteOnLogin(): Promise<WarehouseFile | null> {
    const defaultFile: WarehouseFile = { meta: { schemaVersion: 1 }, warehouses: [], products: [] };
    const remote = await this.downloadData();
    if (!remote) {
      return null;
    }
    const remoteData: WarehouseFile = isWarehouseFile(remote.data) ? remote.data : defaultFile;
    await this.setBaseSnapshot(remoteData, remote.sha);
    return remoteData;
  }

  async pushLocalOnly(
    localWarehouses: Warehouse[],
    localProducts: Product[],
    currentSha: string | null,
  ): Promise<string> {
    if (!this.config) {
      throw new Error('GitHub configuration not set');
    }
    const data: WarehouseFile = {
      meta: { schemaVersion: 1 },
      warehouses: localWarehouses,
      products: localProducts,
    };
    const base = await this.getBaseSnapshot();
    const sanitized = sanitizeForJson<WarehouseFile>(data);
    if (base && stableStringify(sanitized) === stableStringify(sanitizeForJson(base.data))) {
      console.log('pushLocalOnly: no changes, skipping upload');
      return base.sha ?? '';
    }
    const newSha = await this.uploadData(data, currentSha);
    await this.setBaseSnapshot(data, newSha);
    console.log('pushLocalOnly: uploaded with sha', newSha);
    return newSha;
  }
}

export const githubSync = new GitHubSyncService();