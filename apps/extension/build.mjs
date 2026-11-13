import { mkdir, copyFile, readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url)));
if (manifest.manifest_version !== 3 || manifest.permissions.join() !== 'activeTab,scripting' || manifest.host_permissions.join() !== 'http://127.0.0.1:3001/*') throw Error('Permisos inesperados');
await mkdir(new URL('./dist', import.meta.url), { recursive: true });
for (const file of ['manifest.json', 'popup.html', 'popup.css', 'popup.js', 'extractor.js']) await copyFile(new URL(file, import.meta.url), new URL('dist/' + file, import.meta.url));
console.log('Fishi Extension: cargar apps/extension/dist como desempaquetada');
