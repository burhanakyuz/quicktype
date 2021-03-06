import * as fs from "fs";
import { Readable } from "stream";

import { getStream } from "./get-stream";

import { messageError, JSONSchemaStore, JSONSchema, parseJSON, panic } from "../quicktype-core";

// The typings for this module are screwy
const isURL = require("is-url");
const fetch = require("node-fetch");

interface HttpHeaders {
    [key: string]: string;
}

function parseHeaders(httpHeaders?: string[]): HttpHeaders {
    if (!Array.isArray(httpHeaders)) {
        return {};
    }

    return httpHeaders.reduce(
        function(result: HttpHeaders, httpHeader: string) {
            if (httpHeader !== undefined && httpHeader.length > 0) {
                const split = httpHeader.indexOf(":");

                if (split < 0) {
                    return panic(`Could not parse HTTP header "${httpHeader}".`);
                }

                const key = httpHeader.slice(0, split).trim();
                const value = httpHeader.slice(split + 1).trim();
                result[key] = value;
            }

            return result;
        },
        {} as HttpHeaders
    );
}

export async function readableFromFileOrURL(fileOrURL: string, httpHeaders?: string[]): Promise<Readable> {
    try {
        if (fileOrURL === "-") {
            return process.stdin;
        } else if (isURL(fileOrURL)) {
            const response = await fetch(fileOrURL, {
                headers: parseHeaders(httpHeaders)
            });
            return response.body;
        } else if (fs.existsSync(fileOrURL)) {
            return fs.createReadStream(fileOrURL, "utf8");
        }
    } catch (e) {
        const message = typeof e.message === "string" ? e.message : "Unknown error";
        return messageError("MiscReadError", { fileOrURL, message });
    }
    return messageError("DriverInputFileDoesNotExist", { filename: fileOrURL });
}

export async function readFromFileOrURL(fileOrURL: string, httpHeaders?: string[]): Promise<string> {
    const readable = await readableFromFileOrURL(fileOrURL, httpHeaders);
    try {
        return await getStream(readable);
    } catch (e) {
        const message = typeof e.message === "string" ? e.message : "Unknown error";
        return messageError("MiscReadError", { fileOrURL, message });
    }
}

export class FetchingJSONSchemaStore extends JSONSchemaStore {
    constructor(private readonly _httpHeaders?: string[]) {
        super();
    }

    async fetch(address: string): Promise<JSONSchema | undefined> {
        // console.log(`Fetching ${address}`);
        return parseJSON(await readFromFileOrURL(address, this._httpHeaders), "JSON Schema", address);
    }
}
