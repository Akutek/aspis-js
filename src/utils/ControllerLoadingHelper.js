/** @typedef {import("../types/utils.js").LoadingStateProxy} LoadingStateProxy */
import { SchemaService } from "../services/SchemaService.js";
class ControllerLoadingHelper {
  static apply(container, stateProxy, message = "Lade...") {
    if (!stateProxy) {
      return;
    }
    stateProxy.error = null;
    stateProxy.isLoading = true;
    const loaderType = container?.dataset?.loader || "spinner";
    const loaderTemplate = container?.dataset?.loaderTemplate || "loader-spinner";
    stateProxy.view = SchemaService.loader({
      variant: loaderType === "bar" ? "bar" : "spinner",
      layout: loaderTemplate,
      message,
      progress: loaderType === "bar" ? 0 : null
    });
  }
}
export {
  ControllerLoadingHelper
};
