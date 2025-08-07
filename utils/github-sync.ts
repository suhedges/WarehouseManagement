import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Warehouse } from '@/types';

const GITHUB_TOKEN_KEY = 'github_token';
const GITHUB_REPO_KEY = 'github_repo';
const GITHUB_OWNER_KEY = 'github_owner';
const DATA_FILE_PATH = 'warehouse-data.json';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface WarehouseData {
  warehouses: Warehouse[];
  products: Product[];
  lastSync: string;
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

  private async makeGitHubRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.config) {
      throw new Error('GitHub configuration not set');
    }

    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  async downloadData(): Promise<WarehouseData | null> {
    try {
      const response = await this.makeGitHubRequest(`contents/${DATA_FILE_PATH}`);
      const data = await response.json();
      
      if (data.content) {
        const decodedContent = atob(data.content.replace(/\n/g, ''));
        return JSON.parse(decodedContent);
      }
    } catch (error) {
      console.error('Failed to download data from GitHub:', error);
      // If file doesn't exist, return null (first time setup)
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
    return null;
  }

  async uploadData(data: WarehouseData): Promise<void> {
    try {
      // First, try to get the current file to get its SHA
      let sha: string | undefined;
      try {
        const response = await this.makeGitHubRequest(`contents/${DATA_FILE_PATH}`);
        const fileData = await response.json();
        sha = fileData.sha;
      } catch (error) {
        // File doesn't exist yet, that's okay
        console.log('File does not exist yet, creating new file');
      }

      const content = btoa(JSON.stringify(data, null, 2));
      
      const body: any = {
        message: `Update warehouse data - ${new Date().toISOString()}`,
        content,
      };

      if (sha) {
        body.sha = sha;
      }

      await this.makeGitHubRequest(`contents/${DATA_FILE_PATH}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      console.log('Successfully uploaded data to GitHub');
    } catch (error) {
      console.error('Failed to upload data to GitHub:', error);
      throw error;
    }
  }

  async syncData(warehouses: Warehouse[], products: Product[]): Promise<{ warehouses: Warehouse[], products: Product[] }> {
    if (!this.config) {
      throw new Error('GitHub configuration not set');
    }

    try {
      // Download current data from GitHub
      const remoteData = await this.downloadData();
      
      // Prepare local data
      const localData: WarehouseData = {
        warehouses,
        products,
        lastSync: new Date().toISOString(),
      };

      if (!remoteData) {
        // No remote data exists, upload local data
        await this.uploadData(localData);
        return { warehouses, products };
      }

      // For now, we'll use a simple "last write wins" strategy
      // In a more complex scenario, you might want to implement proper conflict resolution
      const localLastSync = new Date(localData.lastSync);
      const remoteLastSync = new Date(remoteData.lastSync);

      if (remoteLastSync > localLastSync) {
        // Remote data is newer, use it
        console.log('Using remote data (newer)');
        return {
          warehouses: remoteData.warehouses,
          products: remoteData.products,
        };
      } else {
        // Local data is newer or same, upload it
        console.log('Uploading local data (newer or same)');
        await this.uploadData(localData);
        return { warehouses, products };
      }
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getConfig(): GitHubConfig | null {
    return this.config;
  }
}

export const githubSync = new GitHubSyncService();