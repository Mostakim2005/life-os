import * as obsidianApi from "obsidian";
import { normalizePath, type Plugin } from "obsidian";

type NodeRequireFn = (id: string) => unknown;

interface DesktopFs {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: string) => string;
}

interface DesktopPath {
  join: (...parts: string[]) => string;
}

interface DesktopVm {
  runInThisContext: (
    code: string,
    opts?: { filename?: string }
  ) => (
    module: { exports: unknown },
    exports: unknown,
    require: (id: string) => unknown
  ) => void;
}

const chunkCache = new Map<string, unknown>();
const inflightChunks = new Map<string, Promise<unknown>>();

function getNodeRequire(): NodeRequireFn | null {
  const win = window as unknown as { require?: NodeRequireFn };
  if (typeof win?.require === "function") return win.require;
  return null;
}

export function getPluginDir(plugin: Plugin): string {
  const manifestDir = (plugin.manifest as { dir?: string } | undefined)?.dir;
  if (manifestDir) return normalizePath(manifestDir);
  return normalizePath(`${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`);
}

export function getPluginFilePath(plugin: Plugin, filename: string): string {
  return normalizePath(`${getPluginDir(plugin)}/${filename}`);
}

function resolveDesktopAbsPath(plugin: Plugin, filename: string): string | null {
  const nodeReq = getNodeRequire();
  if (!nodeReq) return null;
  const adapter = plugin.app.vault.adapter as { getBasePath?: () => string };
  if (typeof adapter?.getBasePath !== "function") return null;
  const pathMod = nodeReq("path") as DesktopPath;
  return pathMod.join(adapter.getBasePath(), getPluginFilePath(plugin, filename));
}

export function readPluginTextSync(plugin: Plugin | null, filename: string): string | null {
  if (plugin) {
    const absPath = resolveDesktopAbsPath(plugin, filename);
    const nodeReq = getNodeRequire();
    if (absPath && nodeReq) {
      const fsMod = nodeReq("fs") as DesktopFs;
      if (fsMod.existsSync(absPath)) {
        return fsMod.readFileSync(absPath, "utf8");
      }
    }
  }
  return null;
}

export async function readPluginTextAsync(plugin: Plugin, filename: string): Promise<string> {
  const relPath = getPluginFilePath(plugin, filename);
  return await plugin.app.vault.adapter.read(relPath);
}

function buildChunkRequire(
  filename: string,
  extraRequireMap?: Record<string, unknown>
): (id: string) => unknown {
  const nodeReq = getNodeRequire();
  return (id: string): unknown => {
    if (id === "obsidian") return obsidianApi;
    if (extraRequireMap && Object.prototype.hasOwnProperty.call(extraRequireMap, id)) {
      return extraRequireMap[id];
    }
    if (nodeReq) return nodeReq(id);
    throw new Error(`Unsupported chunk dependency '${id}' in ${filename}`);
  };
}

function evaluateCjsChunkSync<T>(
  code: string,
  filename: string,
  extraRequireMap?: Record<string, unknown>
): T {
  const nodeReq = getNodeRequire();
  if (!nodeReq) {
    throw new Error(`Desktop vm runtime unavailable for synchronous chunk load: ${filename}`);
  }
  const vmMod = nodeReq("vm") as DesktopVm;
  const mod: { exports: unknown } = { exports: {} };
  const chunkRequire = buildChunkRequire(filename, extraRequireMap);
  const fn = vmMod.runInThisContext(
    `(function(module, exports, require) {\n${code}\n})`,
    { filename }
  );
  fn(mod, mod.exports, chunkRequire);
  return mod.exports as T;
}

async function evaluateCjsChunkAsync<T>(
  code: string,
  filename: string,
  extraRequireMap?: Record<string, unknown>
): Promise<T> {
  const nodeReq = getNodeRequire();
  if (nodeReq) {
    return evaluateCjsChunkSync<T>(code, filename, extraRequireMap);
  }

  const win = window as unknown as {
    __obsChunkReq?: (id: string) => unknown;
    __obsChunkRes?: unknown;
  };
  const prevReq = win.__obsChunkReq;
  const prevRes = win.__obsChunkRes;
  win.__obsChunkReq = buildChunkRequire(filename, extraRequireMap);
  const wrapped = `(function() {\nconst module = { exports: {} };\nconst exports = module.exports;\nconst require = window.__obsChunkReq;\n${code}\nwindow.__obsChunkRes = module.exports;\n})();\n//# sourceURL=${filename}\n`;
  const blobUrl = URL.createObjectURL(new Blob([wrapped], { type: "text/javascript" }));
  const scriptEl = document.head.createEl("script", { attr: { src: blobUrl } });
  try {
    await new Promise<void>((resolve, reject) => {
      scriptEl.addEventListener("load", () => resolve(), { once: true });
      scriptEl.addEventListener(
        "error",
        () => reject(new Error(`Failed to execute chunk ${filename}`)),
        { once: true }
      );
    });
    return win.__obsChunkRes as T;
  } finally {
    scriptEl.remove();
    URL.revokeObjectURL(blobUrl);
    win.__obsChunkReq = prevReq;
    win.__obsChunkRes = prevRes;
  }
}

export async function loadPluginChunkAsync<T>(
  plugin: Plugin,
  filename: string,
  extraRequireMap?: Record<string, unknown>
): Promise<T> {
  const cacheKey = `${plugin.manifest.id}:${filename}`;
  if (chunkCache.has(cacheKey)) {
    return chunkCache.get(cacheKey) as T;
  }
  const existingPromise = inflightChunks.get(cacheKey);
  if (existingPromise) {
    return (await existingPromise) as T;
  }
  const promise = (async () => {
    const code = await readPluginTextAsync(plugin, filename);
    const exportsObj = await evaluateCjsChunkAsync<T>(code, filename, extraRequireMap);
    chunkCache.set(cacheKey, exportsObj);
    return exportsObj;
  })();
  inflightChunks.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightChunks.delete(cacheKey);
  }
}

export function clearLoadedChunks(pluginId?: string): void {
  if (!pluginId) {
    chunkCache.clear();
    return;
  }
  const prefix = `${pluginId}:`;
  for (const key of Array.from(chunkCache.keys())) {
    if (key.startsWith(prefix)) {
      chunkCache.delete(key);
    }
  }
}

export function scheduleIdleTask(fn: () => void, timeoutMs = 2000): () => void {
  const win = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof win.requestIdleCallback === "function") {
    const id = win.requestIdleCallback(fn, { timeout: timeoutMs });
    return () => {
      win.cancelIdleCallback?.(id);
    };
  }
  const timer = window.setTimeout(fn, Math.min(timeoutMs, 1200));
  return () => {
    window.clearTimeout(timer);
  };
}
