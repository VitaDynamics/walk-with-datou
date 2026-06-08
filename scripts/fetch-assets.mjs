#!/usr/bin/env node
/**
 * Fetch CC0 GLB asset packs into public/models/<category>/ (Phase 5).
 *
 * Licensing: CC0 ONLY (public domain — no attribution, commercial OK). The
 * sources below are all CC0. Do not add CC-BY/NC/ND sources here without
 * updating the manifest license handling (gen-manifest.mjs fails on non-CC0).
 *
 * Two source tiers:
 *
 *  A) GitHub-hosted Kenney "Starter Kit" repos (the SEED SET, used by default).
 *     These are reachable from CI/sandboxes that can reach github.com and give a
 *     representative ~80–120 GLB to prove the pipeline end-to-end. Cloned via the
 *     codeload tarball (no full history).
 *
 *  B) The full kenney.nl / quaternius.com packs (Nature 330, Food 200, Furniture
 *     140, animals, …) that get to 1000+ kinds. These live on kenney.nl /
 *     quaternius.com, which may be blocked from locked-down networks. Run with
 *     `--full` from an unrestricted machine to pull them. URLs are scraped from
 *     the kit pages (the zip hash changes on re-publish), so this path needs
 *     network access to those hosts.
 *
 * Usage:
 *   node scripts/fetch-assets.mjs            # seed set (GitHub Kenney kits)
 *   node scripts/fetch-assets.mjs --full     # + full kenney.nl/quaternius packs
 *   node scripts/fetch-assets.mjs --clean    # wipe public/models first
 */

import { mkdir, rm, readdir, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = join(ROOT, 'public', 'models');

const args = new Set(process.argv.slice(2));
const FULL = args.has('--full');
const CLEAN = args.has('--clean');

/**
 * Seed-set sources: GitHub-hosted Kenney CC0 starter kits. Each entry maps the
 * kit's GLB into one of our catalog categories. `match` optionally remaps
 * specific files to better-fitting categories (e.g. a tree GLB → 'tree').
 */
const GITHUB_KITS = [
  {
    repo: 'KenneyNL/Starter-Kit-City-Builder',
    ref: 'main',
    glbDir: 'models',
    category: 'infrastructure',
    remap: [
      [/grass-trees/, 'tree'],
      [/^grass/, 'grass'],
      [/fountain/, 'infrastructure'],
    ],
  },
  {
    repo: 'KenneyNL/Starter-Kit-Basic-Scene',
    ref: 'main',
    glbDir: 'models',
    category: 'decor',
    remap: [
      [/tree|plant|flower/, 'tree'],
      [/rock|stone/, 'rock'],
    ],
  },
  {
    repo: 'KenneyNL/Starter-Kit-3D-Platformer',
    ref: 'main',
    glbDir: 'models',
    category: 'play',
    remap: [[/coin|key|flag/, 'collectible']],
  },
];

function log(...m) {
  console.log('[fetch-assets]', ...m);
}

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/** Download + extract a GitHub repo tarball into a temp dir; return its path. */
async function fetchRepoTarball(repo, ref) {
  const url = `https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`;
  const work = join(tmpdir(), `wwd-asset-${repo.replace(/\//g, '_')}-${ref}`);
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const tarball = join(work, 'repo.tar.gz');
  log(`downloading ${repo}@${ref}`);
  await run('curl', ['-sSL', '-o', tarball, url]);
  await run('tar', ['-xzf', tarball, '-C', work, '--strip-components=1']);
  return work;
}

function categoryFor(kit, file) {
  for (const [re, cat] of kit.remap ?? []) if (re.test(file)) return cat;
  return kit.category;
}

async function copyKitGlb(kit) {
  let repoDir;
  try {
    repoDir = await fetchRepoTarball(kit.repo, kit.ref);
  } catch (err) {
    log(`SKIP ${kit.repo}: ${err.message}`);
    return 0;
  }
  const srcDir = join(repoDir, kit.glbDir);
  let files;
  try {
    files = (await readdir(srcDir)).filter((f) => f.endsWith('.glb'));
  } catch {
    log(`SKIP ${kit.repo}: no ${kit.glbDir}/ dir`);
    return 0;
  }
  let n = 0;
  for (const f of files) {
    const cat = categoryFor(kit, f);
    const destDir = join(MODELS_DIR, cat);
    await mkdir(destDir, { recursive: true });
    // Namespace by kit so two kits with a "grass.glb" don't clash.
    const stem = `${kit.repo
      .split('/')[1]
      .replace(/^Starter-Kit-/, '')
      .toLowerCase()}-${basename(f)}`;
    await copyFile(join(srcDir, f), join(destDir, stem));
    n++;
  }
  await rm(repoDir, { recursive: true, force: true });
  log(`${kit.repo}: ${n} GLB → public/models/`);
  return n;
}

async function fetchFull() {
  log('--full requested: pulling kenney.nl / quaternius.com packs');
  log('NOTE: these hosts may be unreachable from locked-down networks.');
  // Kenney kit zips (CC0). The hash in the path changes on re-publish, so we
  // scrape the current "download" href from each kit page rather than hardcode.
  const KENNEY_KITS = [
    { slug: 'nature-kit', category: 'tree' },
    { slug: 'food-kit', category: 'food' },
    { slug: 'furniture-kit', category: 'decor' },
    { slug: 'holiday-kit', category: 'seasonal' },
  ];
  for (const kit of KENNEY_KITS) {
    try {
      const page = await (await fetch(`https://kenney.nl/assets/${kit.slug}`)).text();
      const m = page.match(/href="([^"]*\.zip)"/);
      if (!m) {
        log(`SKIP ${kit.slug}: no zip href found`);
        continue;
      }
      const zipUrl = new URL(m[1], 'https://kenney.nl').href;
      const work = join(tmpdir(), `wwd-kenney-${kit.slug}`);
      await rm(work, { recursive: true, force: true });
      await mkdir(work, { recursive: true });
      await run('curl', ['-sSL', '-o', join(work, 'kit.zip'), zipUrl]);
      await run('unzip', ['-qo', join(work, 'kit.zip'), '-d', work]);
      // Copy every GLB found under the kit's Models/GLB folder.
      const dest = join(MODELS_DIR, kit.category);
      await mkdir(dest, { recursive: true });
      await run('bash', ['-c', `find "${work}" -iname '*.glb' -exec cp {} "${dest}/" \\;`]);
      await rm(work, { recursive: true, force: true });
      log(`kenney/${kit.slug} → public/models/${kit.category}/`);
    } catch (err) {
      log(`SKIP kenney/${kit.slug}: ${err.message}`);
    }
  }
}

async function main() {
  if (CLEAN && existsSync(MODELS_DIR)) {
    log('cleaning public/models');
    await rm(MODELS_DIR, { recursive: true, force: true });
  }
  await mkdir(MODELS_DIR, { recursive: true });
  await writeFile(join(MODELS_DIR, '.gitkeep'), '');

  let total = 0;
  for (const kit of GITHUB_KITS) total += await copyKitGlb(kit);
  if (FULL) await fetchFull();

  log(`done. ${total} seed GLB fetched. Now run: npm run gen:manifest`);
  if (total === 0) {
    log('WARNING: no assets fetched — is github.com reachable? Try --full elsewhere.');
  }
}

main().catch((err) => {
  console.error('[fetch-assets] failed:', err);
  process.exit(1);
});
