import { githubSync } from '@/utils/github-sync';

async function run() {
  try {
    console.log('[check-remote-has-no-deleted] starting');
    const cfg = githubSync.getConfig();
    if (!cfg) {
      console.log('[check-remote-has-no-deleted] GitHub not configured. Open the app, set GitHub settings, and run a sync first.');
      return;
    }
    const remote = await githubSync.downloadData();
    if (!remote) {
      console.log('[check-remote-has-no-deleted] No remote file found. Nothing to check.');
      return;
    }
    const { data } = remote;
    const hasDeletedWarehouses = data.warehouses.some(w => (w as any).deleted === true);
    const hasDeletedProducts = data.products.some(p => (p as any).deleted === true);
    if (hasDeletedWarehouses || hasDeletedProducts) {
      console.error('[check-remote-has-no-deleted] FAILED: Found deleted entries in remote file', {
        deletedWarehouses: data.warehouses.filter(w => (w as any).deleted === true).map(w => w.id),
        deletedProducts: data.products.filter(p => (p as any).deleted === true).map(p => p.id),
      });
      return;
    }
    console.log('[check-remote-has-no-deleted] PASS: No deleted entries present in remote warehouse-data-*.json');
  } catch (e) {
    console.error('[check-remote-has-no-deleted] Error:', e);
  }
}

void run();
