/**
 * 1Password authentication helper
 */

import * as p from "@clack/prompts";
import { errors } from "../utils/errors";
import { checkOpCli, checkSignedIn, signIn } from "./onepassword";

export interface AuthOptions {
    verbose: boolean;
}

/**
 * Ensure 1Password CLI is installed and user is authenticated.
 * Shows a spinner during the process.
 *
 * @throws Env2OpError if CLI not installed or authentication fails
 */
export async function ensureOpAuthenticated(options: AuthOptions): Promise<void> {
    const { verbose } = options;

    const authSpinner = p.spinner();
    authSpinner.start("Checking 1Password CLI...");

    const opInstalled = await checkOpCli({ verbose });
    if (!opInstalled) {
        authSpinner.stop("1Password CLI not found");
        throw errors.opCliNotInstalled();
    }

    let signedIn = await checkSignedIn({ verbose });
    if (!signedIn) {
        authSpinner.message("Signing in to 1Password...");

        const signInSuccess = await signIn({ verbose });
        if (!signInSuccess) {
            authSpinner.stop();
            throw errors.opSigninFailed();
        }

        // Verify sign-in was successful
        signedIn = await checkSignedIn({ verbose });
        if (!signedIn) {
            authSpinner.stop();
            throw errors.opNotSignedIn();
        }
    }

    authSpinner.stop("1Password CLI ready");
}
