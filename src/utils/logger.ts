import * as p from "@clack/prompts";
import pc from "picocolors";

/**
 * Unicode symbols for different message types
 */
const symbols = {
    success: pc.green("\u2713"),
    error: pc.red("\u2717"),
    warning: pc.yellow("\u26A0"),
    info: pc.blue("\u2139"),
    arrow: pc.cyan("\u2192"),
    bullet: pc.dim("\u2022"),
};

/**
 * Logger utility for formatted CLI output using @clack/prompts
 */
export const logger = {
    /**
     * Display CLI intro banner
     */
    intro(name: string, version: string, dryRun = false) {
        const label = dryRun
            ? pc.bgYellow(pc.black(` ${name} v${version} [DRY RUN] `))
            : pc.bgCyan(pc.black(` ${name} v${version} `));
        p.intro(label);
    },

    /**
     * Display section header
     */
    section(title: string) {
        console.log(`\n${pc.bold(pc.underline(title))}`);
    },

    /**
     * Success message
     */
    success(message: string) {
        p.log.success(message);
    },

    /**
     * Error message
     */
    error(message: string) {
        p.log.error(message);
    },

    /**
     * Warning message
     */
    warn(message: string) {
        p.log.warn(message);
    },

    /**
     * Info message
     */
    info(message: string) {
        p.log.info(message);
    },

    /**
     * Step in a process
     */
    step(message: string) {
        p.log.step(message);
    },

    /**
     * Message (neutral)
     */
    message(message: string) {
        p.log.message(message);
    },

    /**
     * Display key-value pair
     */
    keyValue(key: string, value: string, indent = 2) {
        console.log(`${" ".repeat(indent)}${pc.dim(key)}: ${pc.cyan(value)}`);
    },

    /**
     * Display list item
     */
    listItem(item: string, indent = 2) {
        console.log(`${" ".repeat(indent)}${symbols.bullet} ${item}`);
    },

    /**
     * Display arrow item
     */
    arrowItem(item: string, indent = 2) {
        console.log(`${" ".repeat(indent)}${symbols.arrow} ${item}`);
    },

    /**
     * Display dry run indicator
     */
    dryRun(message: string) {
        console.log(`${pc.yellow("[DRY RUN]")} ${message}`);
    },

    /**
     * Create a spinner for async operations
     */
    spinner() {
        return p.spinner();
    },

    /**
     * Display outro message
     */
    outro(message: string) {
        p.outro(pc.green(message));
    },

    /**
     * Display cancellation message
     */
    cancel(message: string) {
        p.cancel(message);
    },

    /**
     * Display a note block
     */
    note(message: string, title?: string) {
        p.note(message, title);
    },

    /**
     * Format a field list for display
     */
    formatFields(fields: string[], max = 3): string {
        if (fields.length <= max) {
            return fields.join(", ");
        }
        return `${fields.slice(0, max).join(", ")}, ... and ${fields.length - max} more`;
    },
};
