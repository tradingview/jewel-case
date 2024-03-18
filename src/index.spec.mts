import { describe, expect, it } from '@jest/globals';

import { apply, plan } from './index.mjs';

describe('apply', () => {
	it('should return undefined', () => {
		expect(apply()).toBe(undefined);
	});
});

describe('plan', () => {
	it('should return undefined', async() => {
		expect(await plan({ deployers: [] })).toBe(undefined);
	});
});
