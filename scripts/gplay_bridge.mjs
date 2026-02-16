#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const localModule = path.join(projectRoot, 'lead-finder', 'node_modules', 'google-play-scraper', 'index.js');

async function loadScraper() {
  try {
    const module = await import(pathToFileURL(localModule).href);
    return module.default;
  } catch {
    const module = await import('google-play-scraper');
    return module.default;
  }
}

function parsePayload() {
  const raw = process.argv[2];
  if (!raw) {
    throw new Error('Missing JSON payload argument');
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid payload object');
  }
  return parsed;
}

function normalizeCategory(category) {
  if (!category || category === 'ALL') return undefined;
  return category;
}

async function run() {
  const payload = parsePayload();
  const gplay = await loadScraper();

  if (payload.mode === 'list') {
    const options = {
      collection: String(payload.collection || 'TOP_FREE'),
      country: String(payload.country || 'us'),
      lang: String(payload.lang || 'en'),
      num: Number(payload.num || 50),
      fullDetail: false,
    };

    const category = normalizeCategory(payload.category);
    if (category) {
      options.category = String(category);
    }

    const rows = await gplay.list(options);
    const appIds = Array.from(
      new Set(
        rows
          .map((row) => String(row?.appId || '').trim())
          .filter((appId) => Boolean(appId)),
      ),
    );

    process.stdout.write(JSON.stringify({ appIds }));
    return;
  }

  if (payload.mode === 'search') {
    const term = String(payload.term || '').trim();
    if (!term) {
      throw new Error('Search term is required');
    }

    const options = {
      term,
      country: String(payload.country || 'us'),
      lang: String(payload.lang || 'en'),
      num: Math.max(1, Math.min(Number(payload.num || 5), 50)),
      fullDetail: false,
    };

    const rows = await gplay.search(options);
    const items = rows
      .map((row) => {
        const appId = row?.appId ? String(row.appId).trim() : '';
        const url = row?.url
          ? String(row.url)
          : appId
            ? `https://play.google.com/store/apps/details?id=${appId}`
            : null;

        return {
          appId: appId || null,
          title: String(row?.title || ''),
          url,
          score: typeof row?.score === 'number' ? row.score : null,
          reviews: row?.reviews ?? row?.installs ?? null,
          developer: row?.developer ?? null,
        };
      })
      .filter((item) => item.appId || item.title);

    process.stdout.write(JSON.stringify({ items }));
    return;
  }

  throw new Error(`Unsupported mode: ${String(payload.mode || '')}`);
}

run().catch((error) => {
  process.stderr.write(String(error?.stack || error?.message || error));
  process.exit(1);
});
