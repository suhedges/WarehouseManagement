import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Warehouse, WarehouseFile, RecordConflict } from '@/types';
import { mergeRecords } from './merge-records';

const GITHUB_TOKEN_KEY = 'github_token';
const GITHUB_REPO_KEY = 'github_repo';
const GITHUB_OWNER_KEY = 'github_owner';
const DATA_FILE_PATH = 'warehouse-data.json';
const BASE_SNAPSHOT_KEY = 'github_base_snapshot';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

function stableStringify(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

export class GitHubSyncService {
  private config: GitHubConfig | null = null;

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
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github+json',         // recommended
        'X-GitHub-Api-Version': '2022-11-28',            // recommended
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
      const response = await this.makeGitHubRequest(`contents/${DATA_FILE_PATH}`);
      const file = await response.json();
      if (file.content) {
        const decoded = atob(file.content.replace(/\n/g, ''));
        const json = JSON.parse(decoded);
        return { data: json, sha: file.sha };
      }
    } catch (error) {

      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
    return null;
  }

  async uploadData(data: WarehouseFile, sha: string | null): Promise<string> {
    const content = btoa(JSON.stringify(data, null, 2));
    const body: any = {
      message: `Update warehouse data - ${new Date().toISOString()}`,
      content,
    };
    if (sha) body.sha = sha; // ← this is the supported way
  
    const res = await this.makeGitHubRequest(`contents/${DATA_FILE_PATH}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const result = await res.json();
    return result.content.sha;
  }

  async syncData(
    localWarehouses: Warehouse[],
    localProducts: Product[],
  ): Promise<{ warehouses: Warehouse[]; products: Product[]; conflicts: RecordConflict[] }> {
    if (!this.config) {
      throw new Error('GitHub configuration not set');
    }

    const baseRaw = await AsyncStorage.getItem(BASE_SNAPSHOT_KEY);
    const base: WarehouseFile = baseRaw ? JSON.parse(baseRaw) : { meta: { schemaVersion: 1 }, warehouses: [], products: [] };

    const remote = await this.downloadData();
    const remoteData: WarehouseFile = remote?.data || { meta: { schemaVersion: 1 }, warehouses: [], products: [] };
    const remoteSha = remote?.sha || null;

    const w = mergeRecords(base.warehouses, localWarehouses, remoteData.warehouses, 'warehouse');
    const p = mergeRecords(base.products, localProducts, remoteData.products, 'product');

    const merged: WarehouseFile = {
      meta: remoteData.meta || { schemaVersion: 1 },
      warehouses: w.records,
      products: p.records,
    };

    const conflicts = [...w.conflicts, ...p.conflicts];

    await AsyncStorage.setItem(BASE_SNAPSHOT_KEY, JSON.stringify(remoteData));

    if (conflicts.length > 0) {
      return { warehouses: merged.warehouses, products: merged.products, conflicts };
    }

    await this.uploadData(merged, remoteSha);
    await AsyncStorage.setItem(BASE_SNAPSHOT_KEY, JSON.stringify(merged));

    return { warehouses: merged.warehouses, products: merged.products, conflicts: [] };
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getConfig(): GitHubConfig | null {
    return this.config;
  }

  private async getRemoteFile(): Promise<{ sha: string; text: string } | null> {
    const res = await this.makeGitHubRequest(`contents/${DATA_FILE_PATH}`, { method: 'GET' });
    const json = await res.json();
    if (!json?.content || !json?.sha) return null;
    const remoteBytes = atob(String(json.content).replace(/\n/g, ''));
    return { sha: String(json.sha), text: remoteBytes };
  }

  // Only PUT when different
  async uploadData(data: WarehouseFile, currentSha: string | null): Promise<string> {
    const desiredText = stableStringify(data);     // deterministic text
    const remote = await this.getRemoteFile();     // latest from GitHub

    // no-op if identical
    if (remote && remote.text === desiredText) {
      return remote.sha; // nothing to do
    }

    const body: any = {
      message: 'Update warehouse data',            // avoid timestamps to prevent churn
      content: btoa(desiredText),
    };
    if (remote?.sha || currentSha) body.sha = remote?.sha ?? currentSha;

    const res = await this.makeGitHubRequest(`contents/${DATA_FILE_PATH}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const result = await res.json();
    return result.content.sha as string;
  }  
  
}

export const githubSync = new GitHubSyncService();