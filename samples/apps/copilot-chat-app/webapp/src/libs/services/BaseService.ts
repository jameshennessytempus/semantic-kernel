import { AdditionalApiRequirements, AuthHeaderTags } from '../../redux/features/plugins/PluginsState';

interface ServiceRequest {
    commandPath: string;
    method?: string;
    body?: unknown;
}
const noResponseBodyStatusCodes = [202];

export class BaseService {
    // eslint-disable-next-line @typescript-eslint/space-before-function-paren
    constructor(protected readonly serviceUrl: string) {}

    protected readonly getResponseAsync = async <T>(
        request: ServiceRequest,
        accessToken: string,
        enabledPlugins?: {
            headerTag: AuthHeaderTags;
            authData: string;
            apiRequirements?: AdditionalApiRequirements;
        }[],
    ): Promise<T> => {
        const { commandPath, method, body } = request;
        const headers = new Headers({
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        });

        // For each enabled plugin, pass its auth information as a customer header
        // to the backend so the server can authenticate to the plugin
        if (enabledPlugins && enabledPlugins.length > 0) {
            for (var idx in enabledPlugins) {
                var plugin = enabledPlugins[idx];
                headers.append(`x-sk-copilot-${plugin.headerTag}-auth`, plugin.authData);
                if (plugin.apiRequirements) {
                    const apiRequirments = plugin.apiRequirements;
                    for (var property in apiRequirments) {
                        headers.append(`x-sk-copilot-${plugin.headerTag}-${property}`, apiRequirments[property].value!);
                    }
                }
            }
        }

        try {
            const requestUrl = new URL(commandPath, this.serviceUrl);
            const response = await fetch(requestUrl, {
                method: method ?? 'GET',
                body: JSON.stringify(body),
                headers: headers,
            });

            if (!response.ok) {
                const responseText = await response.text();
                const errorMessage = `${response.status}: ${response.statusText}` + (responseText ? ` => ${responseText}` : '');

                throw Object.assign(new Error(errorMessage));
            }

            return noResponseBodyStatusCodes.includes(response.status) ? ({} as T) : ((await response.json()) as T);
        } catch (e) {
            var additional_error_msg = '';
            if (e instanceof TypeError) {
                // fetch() will reject with a TypeError when a network error is encountered.
                additional_error_msg =
                    '\n\nPlease check that your backend is running and that it is accessible by the app';
            }
            throw Object.assign(new Error(e + additional_error_msg));
        }
    };
}
