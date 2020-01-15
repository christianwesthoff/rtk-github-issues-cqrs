export interface RequestException {
    errors: Array<string>,
    message: string,
    name: "RequestException",
    toString: () => string
}

export type Request<R = any, P = any> = (payload:P) => Promise<R>;

export const createRequestException = (message:string, errors: Array<string>):RequestException => {
    return {
        message,
        errors,
        name: "RequestException",
        toString: () => name
    }
}