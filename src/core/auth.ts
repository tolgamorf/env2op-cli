/**
 * 1Password authentication helper
 */

import * as p from "@clack/prompts";
import { errors } from "../utils/errors";
import { checkSignedIn, getOpStatus, signIn } from "./onepassword";

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

    const status = await getOpStatus({ verbose });
    if (status === "missing") {
        authSpinner.stop("1Password CLI not found");
        throw errors.opCliNotInstalled();
    }

    if (status === "signed-out") {
        authSpinner.message("Signing in to 1Password...");

        const signInSuccess = await signIn({ verbose });
        if (!signInSuccess) {
            authSpinner.stop();
            throw errors.opSigninFailed();
        }

        // Verify sign-in was successful
        if (!(await checkSignedIn({ verbose }))) {
            authSpinner.stop();
            throw errors.opNotSignedIn();
        }
    }

    authSpinner.stop("1Password CLI ready");
}
