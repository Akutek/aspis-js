/**
 * Verwaltung für das Registry
 * @public
 */
export class RegistryManager {
    ini(registryPath) {
        const appConfig = await ManifestLoaderService.load(`${registryPath}/app-config.json`);
    }
}