import { PipelineWork } from "./PipelineWork.js";
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") {
    return;
  }
  const id = msg.id;
  const type = typeof msg.type === "string" ? msg.type : "";
  try {
    const payload = PipelineWork.handle(type, msg.payload);
    self.postMessage({
      v: 1,
      id,
      type: PipelineWork.responseType(type),
      ok: true,
      payload
    });
  } catch (error) {
    self.postMessage({
      v: 1,
      id,
      type: "res:error",
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
