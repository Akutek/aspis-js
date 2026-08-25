async function fileFetch(input, _init) {
  const href = requestHref(input);
  const disk = await hrefToDisk(href);
  if (!disk) {
    return new Response("", { status: 404, statusText: "Not Found" });
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const body = await readFile(disk);
    return new Response(body, {
      status: 200,
      headers: { "content-type": mimeOf(disk) }
    });
  } catch {
    return new Response("", { status: 404, statusText: "Not Found" });
  }
}
function requestHref(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}
async function hrefToDisk(href) {
  if (href.startsWith("file:")) {
    const { fileURLToPath } = await import("node:url");
    return fileURLToPath(href);
  }
  try {
    const { join } = await import("node:path");
    const url = new URL(href, "http://localhost:3000/");
    const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
    if (parts.some((part) => part === "..")) {
      return null;
    }
    return join(process.cwd(), ...parts);
  } catch {
    return null;
  }
}
function mimeOf(path) {
  if (path.endsWith(".json")) {
    return "application/json";
  }
  if (path.endsWith(".html") || path.endsWith(".htm")) {
    return "text/html";
  }
  return "text/plain";
}
export {
  fileFetch
};
