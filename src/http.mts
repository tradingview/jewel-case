import { request as httpRequest } from 'https';
import type { IncomingMessage } from 'http';

export interface RequestBody {
	content: string | Buffer;
	contentType?: string;
}

export interface RequestData {
	headers?: Record<string, string>;
	body?: RequestBody;
	redirectHandler?: (url: string) => string | undefined;
}

export function requestStream(url: URL, method: string, requestData?: RequestData): Promise<IncomingMessage> {
	return new Promise((resolve, reject) => {
		try {
			const req = httpRequest(url, { method });

			req
				.on('response', (incomingMessage: IncomingMessage) => {
					if (incomingMessage.statusCode !== 200) {
						const stCode = incomingMessage.statusCode ?? 'NO_CODE';
						const stMessage = incomingMessage.statusMessage ?? 'NO_MESSAGE';
						const message = `[${method} ${url.toString()}]:${stCode}/${stMessage}`;
						reject(new Error(message));
					}

					resolve(incomingMessage);
				})
				.on('error', (err: Error) => {
					const errno = (err as {errno?: string}).errno ?? '';
					if (errno === 'ETIMEDOUT') {
						reject(new Error(`Request (${url.toString()}) timeout.`));
					} else {
						reject(err);
					}
				});

			if (requestData?.headers) {
				for (const key of Object.getOwnPropertyNames(requestData.headers)) {
					const value = requestData.headers[key];

					if (value) {
						req.setHeader(key, value);
					}
				}
			}

			if (requestData?.body) {
				if (requestData.body.contentType) {
					req.setHeader('Content-Type', requestData.body.contentType);
				}
				req.write(requestData.body.content);
			}

			req.end();
		} catch (err) {
			reject(err);
		}
	});
}

export async function request(url: URL, method: string, requestData?: RequestData): Promise<Buffer> {
	const responseStream = await requestStream(url, method, requestData);

	let buffer: Buffer | undefined = undefined;

	for await (const item of responseStream) {
		const chunk = item as Buffer;
		buffer = (typeof buffer === 'undefined') ? chunk : Buffer.concat([buffer, chunk]);
	}

	return buffer ? buffer : Buffer.from('');
}

export function requestRange(url: URL, range: string): Promise<IncomingMessage> {
	return new Promise<IncomingMessage>((resolve, reject) => {
		try {
			const req = httpRequest(url, { method: 'GET' });

			req.on('response', (incomingMessage: IncomingMessage) => {
				if (incomingMessage.statusCode === 206) {
					resolve(incomingMessage);
					return;
				}

				if (incomingMessage.statusCode !== 200) {
					const stCode = incomingMessage.statusCode ?? 'NO_CODE';
					const stMessage = incomingMessage.statusMessage ?? 'NO_MESSAGE';
					const message = `[GET ${url.toString()}]:${stCode}/${stMessage}`;
					reject(new Error(message));
					return;
				}

				resolve(incomingMessage);
			})
				.on('error', (err: Error) => {
					const errno = (err as {errno?: string}).errno ?? '';
					if (errno === 'ETIMEDOUT') {
						reject(new Error(`Request (${url.toString()}) timeout.`));
					} else {
						reject(err);
					}
				});


			req.setHeader('Range', `bytes=${range}`);

			req.end();
		} catch (err) {
			reject(err);
		}
	});
}

export function get(url: URL): Promise<Buffer> {
	return request(url, 'GET', undefined);
}

export function post(url: URL, requestData?: RequestData): Promise<Buffer> {
	return request(url, 'POST', requestData);
}
