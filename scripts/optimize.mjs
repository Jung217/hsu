// 圖片優化：把「作品集/照」下的原圖壓成網站用大圖 + 縮圖，並輸出 photos.json
// 用法：npm run optimize
import sharp from 'sharp';
import { readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve('.');
const SRC = path.join(ROOT, '作品集', '照');
const OUT = path.join(ROOT, 'assets', 'photos');
const DATA = path.join(ROOT, 'assets', 'data');

const FULL_MAX = 2200; // 燈箱大圖長邊
const FULL_Q = 82;
const THUMB_MAX = 760; // 圖牆縮圖長邊
const THUMB_Q = 72;
const CONCURRENCY = 4;

// 分類顯示名稱 → 英文 slug / 排序
const CAT_META = {
  車: { slug: 'cars', order: 1 },
  風景: { slug: 'scenery', order: 2 },
  動物: { slug: 'animals', order: 3 },
  活動: { slug: 'events', order: 4 },
};

const isImage = (n) => /\.(jpe?g|png)$/i.test(n);

function pad(n) {
  return String(n).padStart(3, '0');
}

async function collect() {
  const cats = [];
  const top = await readdir(SRC, { withFileTypes: true });
  for (const e of top) {
    if (!e.isDirectory()) continue;
    const catName = e.name;
    const catDir = path.join(SRC, catName);
    const children = await readdir(catDir, { withFileTypes: true });
    const subDirs = children.filter((c) => c.isDirectory());
    const looseFiles = children.filter((c) => c.isFile() && isImage(c.name));
    const items = [];
    const hasSubs = subDirs.length > 0;
    for (const f of looseFiles) {
      items.push({ file: path.join(catDir, f.name), sub: hasSubs ? '其他' : null });
    }
    for (const sd of subDirs) {
      const sdDir = path.join(catDir, sd.name);
      const files = (await readdir(sdDir, { withFileTypes: true })).filter(
        (f) => f.isFile() && isImage(f.name),
      );
      for (const f of files) items.push({ file: path.join(sdDir, f.name), sub: sd.name });
    }
    cats.push({ catName, items });
  }
  // 依預設順序排
  cats.sort((a, b) => (CAT_META[a.catName]?.order ?? 99) - (CAT_META[b.catName]?.order ?? 99));
  return cats;
}

async function run() {
  // 清空舊輸出
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await mkdir(DATA, { recursive: true });

  const cats = await collect();
  const seen = new Set(); // 內容雜湊去重
  const manifest = [];
  const catSummary = [];
  let totalSrc = 0;
  let totalOut = 0;
  let idx = 0;

  for (const cat of cats) {
    const meta = CAT_META[cat.catName] || { slug: 'misc', order: 99 };
    const catSlug = meta.slug;
    const catOutDir = path.join(OUT, catSlug);
    await mkdir(catOutDir, { recursive: true });

    // 收集去重後的有效項目
    const valid = [];
    for (const it of cat.items) {
      const buf = await readFile(it.file);
      const hash = createHash('sha1').update(buf).digest('hex');
      if (seen.has(hash)) {
        console.log(`  ↷ 跳過重複：${path.basename(it.file)}`);
        continue;
      }
      seen.add(hash);
      totalSrc += buf.length;
      valid.push({ ...it, buf });
    }

    // 子分類 id 對應
    const subIds = new Map();
    let subCounter = 0;
    const subOrder = [];
    const ensureSub = (name) => {
      if (name == null) return null;
      if (!subIds.has(name)) {
        const id = `${catSlug}-s${++subCounter}`;
        subIds.set(name, id);
        subOrder.push({ name, id, count: 0 });
      }
      return subIds.get(name);
    };

    // 並行處理
    let n = 0;
    const queue = valid.slice();
    const catItems = [];
    async function worker() {
      while (queue.length) {
        const it = queue.shift();
        const i = ++n;
        const base = `${catSlug}-${pad(i)}`;
        const fullName = `${base}.jpg`;
        const thumbName = `${base}_t.jpg`;
        try {
          const { data: fullData, info } = await sharp(it.buf)
            .rotate()
            .flatten({ background: '#0a0a0a' })
            .resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: FULL_Q, mozjpeg: true })
            .toBuffer({ resolveWithObject: true });
          await writeFile(path.join(catOutDir, fullName), fullData);

          const thumbData = await sharp(it.buf)
            .rotate()
            .flatten({ background: '#0a0a0a' })
            .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: THUMB_Q, mozjpeg: true })
            .toBuffer();
          await writeFile(path.join(catOutDir, thumbName), thumbData);

          totalOut += fullData.length + thumbData.length;
          const subId = ensureSub(it.sub);
          if (subId) subOrder.find((s) => s.id === subId).count++;
          catItems.push({
            cat: cat.catName,
            catSlug,
            sub: it.sub,
            subId,
            full: `assets/photos/${catSlug}/${fullName}`,
            thumb: `assets/photos/${catSlug}/${thumbName}`,
            w: info.width,
            h: info.height,
          });
          process.stdout.write(`\r  ${cat.catName}: ${i}/${valid.length}    `);
        } catch (err) {
          console.error(`\n  ✗ 失敗 ${it.file}: ${err.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`\n✔ ${cat.catName} (${catSlug})：${catItems.length} 張`);

    // 穩定排序：先依子分類順序，再原順序
    manifest.push(...catItems);
    catSummary.push({
      name: cat.catName,
      slug: catSlug,
      count: catItems.length,
      subs: subOrder,
    });
    idx += catItems.length;
  }

  const out = {
    generatedAt: null, // 由 git 提交時間代表；避免不確定性
    total: manifest.length,
    categories: catSummary,
    photos: manifest,
  };
  await writeFile(path.join(DATA, 'photos.json'), JSON.stringify(out, null, 2), 'utf8');

  const mb = (b) => (b / 1024 / 1024).toFixed(1);
  console.log('\n========================================');
  console.log(`總計：${manifest.length} 張照片`);
  console.log(`原檔總量：${mb(totalSrc)} MB → 輸出總量：${mb(totalOut)} MB`);
  console.log(`清單：assets/data/photos.json`);
  console.log('分類統計：');
  for (const c of catSummary) {
    console.log(`  ${c.name} (${c.slug})：${c.count} 張` + (c.subs.length ? ` — 子分類 ${c.subs.map((s) => `${s.name}:${s.count}`).join('、')}` : ''));
  }
  console.log('========================================');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
