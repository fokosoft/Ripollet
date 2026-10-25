// Ejecuta verdad.html en Chrome sin ventana (con la GPU del equipo) y guarda la profundidad máxima de cada celda para
// cada escenario de lluvia en datos_sim/verdad_<mm/h>.bin (Uint16, cm). Es la "verdad" con la que aprende Neutro.
// Uso: node obtener_verdad.mjs  [ruta de chrome.exe]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PUERTO = 9334;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Perfil de Chrome temporal junto al proyecto (no en C:, que va justo) y se borra al terminar
const PERFIL = join(DIR, ".perfil_chrome");
const chrome = spawn(CHROME, ["--headless=new", `--user-data-dir=${PERFIL}`,
  `--remote-debugging-port=${PUERTO}`, "--ignore-gpu-blocklist", "about:blank"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await esperar(500);
  try {
    const pagina = (await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()).find((p) => p.type === "page");
    if (pagina) ws = new WebSocket(pagina.webSocketDebuggerUrl);
  } catch { /* Chrome aún arrancando */ }
}
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pendientes = new Map();
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d.result ?? d.error); pendientes.delete(d.id); }
  if (d.method === "Runtime.exceptionThrown") console.error("Error en la página:", d.params.exceptionDetails.exception?.description);
});
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluar = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.value;

await cdp("Runtime.enable");
await cdp("Page.navigate", { url: pathToFileURL(join(DIR, "verdad.html")).href });
const t0 = Date.now();
let anterior = "";
while (!(await evaluar("window.__verdad?.listo === true"))) {
  await esperar(3000);
  const registro = await evaluar("document.getElementById('registro')?.textContent") || "";
  if (registro !== anterior) { console.log(registro.slice(anterior.length).trim()); anterior = registro; }
  if (Date.now() - t0 > 20 * 60 * 1000) throw new Error("La simulación tarda demasiado");
}
const resultados = await evaluar("window.__verdad.resultados");
mkdirSync(join(DIR, "datos_sim"), { recursive: true });
for (const [mmh, b64] of Object.entries(resultados)) writeFileSync(join(DIR, "datos_sim", `verdad_${mmh}.bin`), Buffer.from(b64, "base64"));
console.log(`Guardado en datos_sim/ (${Object.keys(resultados).length} escenarios, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
ws.close();
chrome.kill();
await esperar(1500);
try { rmSync(PERFIL, { recursive: true, force: true }); } catch { /* Chrome aún lo suelta */ }
process.exit(0);
