import { describe, expect, it } from '@jest/globals';

import { apply, plan } from './index.mjs';
import type { Deployer } from './deployer.mjs';

describe('apply', () => {
	it('should return undefined', () => {
		expect(apply()).toBe(undefined);
	});
});

describe('plan', () => {
	it('should return undefined', async() => {
		const dummyDeployer: Deployer = {
			plan: () => Promise.resolve(),
			// eslint-disable-next-line no-empty-function
			apply: () => {},
		};
		expect(await plan({ deployers: [dummyDeployer] })).toBe(undefined);
	});
});
