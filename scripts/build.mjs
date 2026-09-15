import { mkdir, readFile, writeFile, cp, stat, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const catalog = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const entries = catalog.visualizations;
const topics = [...new Set(entries.map(entry => entry.topic))];
const slugs = new Set();
for (const entry of entries) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || slugs.has(entry.slug)) throw new Error(`Invalid or duplicate slug: ${entry.slug}`);
  slugs.add(entry.slug);
  for (const key of ['file', 'preview', 'explanation']) {
    const source = resolve(root, 'content', entry[key]);
    if (!source.startsWith(join(root, 'content') + '/')) throw new Error(`Invalid content path: ${entry[key]}`);
    await stat(source);
  }
}
const icon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4v15h15M5 19 18 6M5 19l3-9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m14 6 4-.1-.1 4M6 12l2-2 1 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1f2328"/><path d="M8 7v18h18M8 25 24 9M18 9h6v6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
function page(title, description, prefix, body, detail = false) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}${detail ? ' · ' + escape(catalog.title) : ''}</title>
<meta name="description" content="${escape(description)}"><meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="${escape(favicon)}"><link rel="stylesheet" href="${prefix}assets/site.css">
${detail ? `<script src="${prefix}assets/embed.js" defer></script>` : ''}
</head><body><a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="${prefix}index.html">${icon}<span>Visualizations</span></a><span class="header-divider" aria-hidden="true">/</span><span class="header-location">${detail ? 'Explore' : 'Library'}</span></div></header>
${body}
<footer class="site-footer"><span>${escape(catalog.title)}</span><span>Mathematics &amp; statistics</span></footer>
</body></html>\n`;
}
const rows = topic => entries.filter(entry => entry.topic === topic).map(entry => `
<article class="visualization-row">
<a class="preview-link" href="visualizations/${entry.slug}/" tabindex="-1" aria-hidden="true"><img src="${escape(entry.preview)}" alt="" width="200" height="128"></a>
<div class="entry-content"><h3><a href="visualizations/${entry.slug}/">${escape(entry.title)}</a></h3><p>${escape(entry.description)}</p><ul class="tags" aria-label="Topics">${entry.tags.map(tag => `<li>${escape(tag)}</li>`).join('')}</ul></div>
<a class="open-link" href="visualizations/${entry.slug}/" aria-label="Open ${escape(entry.title)}">Open <span aria-hidden="true">↗</span></a>
</article>`).join('');
const body = `<main id="main" class="page-width">
<div class="page-heading"><h1>${escape(catalog.title)}</h1><p>${escape(catalog.description)}</p></div>
<div class="library-layout"><div class="catalog">
<div class="catalog-heading"><span>All visualizations</span><span class="count" aria-label="${entries.length} visualizations">${entries.length}</span></div>
${topics.map(topic => `<section class="topic-group" id="${slugify(topic)}" aria-labelledby="heading-${slugify(topic)}"><div class="topic-heading"><h2 id="heading-${slugify(topic)}">${escape(topic)}</h2><span>${entries.filter(entry => entry.topic === topic).length}</span></div>${rows(topic)}</section>`).join('')}
</div><aside class="library-sidebar"><h2>About this collection</h2><p>Small examples that make mathematical ideas easier to see. Open a visualization and change its controls to explore what happens.</p><div class="sidebar-topics"><h2>Browse by topic</h2><ul>${topics.map(topic => `<li><a href="#${slugify(topic)}">${escape(topic)}</a><span>${entries.filter(entry => entry.topic === topic).length}</span></li>`).join('')}</ul></div></aside></div>
</main>`;
await rm(dist, {recursive: true, force: true});
await mkdir(dist, {recursive: true});
await cp(join(root, 'assets'), join(dist, 'assets'), {recursive: true});
await cp(join(root, 'content', 'previews'), join(dist, 'previews'), {recursive: true});
await writeFile(join(dist, 'index.html'), page(catalog.title, catalog.description, './', body));
await writeFile(join(dist, '.nojekyll'), '');
for (const entry of entries) {
  const directory = join(dist, 'visualizations', entry.slug);
  await mkdir(directory, {recursive: true});
  await cp(dirname(join(root, 'content', entry.file)), directory, {recursive: true});
  await cp(join(root, 'content', entry.file), join(directory, 'interactive.html'));
  const explanation = await readFile(join(root, 'content', entry.explanation), 'utf8');
  const detail = `<main id="main" class="page-width detail-page"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="../../index.html">All visualizations</a><span aria-hidden="true">/</span><span>${escape(entry.topic)}</span></nav>
<div class="detail-heading"><h1>${escape(entry.title)}</h1><p>${escape(entry.description)}</p><ul class="tags" aria-label="Topics"><li>${escape(entry.topic)}</li>${entry.tags.map(tag => `<li>${escape(tag)}</li>`).join('')}</ul></div>
<div class="interactive-container"><iframe class="interactive-frame" src="interactive.html" title="${escape(entry.title)} — interactive visualization" scrolling="no"></iframe></div>
<section class="explanation" aria-labelledby="explanation-title"><h2 id="explanation-title">What to look for</h2>${explanation}</section>
<a class="back-link" href="../../index.html">← Back to the library</a></main>`;
  await writeFile(join(directory, 'index.html'), page(entry.title, entry.description, '../../', detail, true));
}
console.log(`Built ${catalog.title}: home page + ${entries.length} visualization page(s) in dist/`);
