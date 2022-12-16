import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

export interface Package {
	version: string,
	buildNumber: string,
}

interface Release {
	packages: Package[],
	highest: Package,
}

type Channel = string;
export type Repo = Map<Channel, Release>;

export interface RepoBuilder {
	build(): Promise<void>;
}

export async function scanSourceDir(sourceDir: string): Promise<Repo> {
	console.log(`Prepearing meta repo from "${sourceDir}"`);
	const repo: Repo = new Map<Channel, Release>();

	const processChannelDirectory = async(srcPath: string, channel: string): Promise<void> => {
		const fullChannelPath = path.resolve(srcPath, channel);
		const list: string[] = await fs.promises.readdir(fullChannelPath);
		const packages: Package[] = [];

		const findHighestVersion = (packs: Package[]): Package => {
			let highest: Package = {
				version: '0.0.0',
				buildNumber: '',
			};

			for (const pack of packs) {
				if (semver.compare(pack.version, highest.version) > 0) {
					highest = pack;
				}
			}

			if (highest.version === '0.0.0') {
				throw new Error('Could not find highest version');
			}

			return highest;
		};

		if (list.length === 0) {
			throw new Error(`Channel directory "${fullChannelPath}" is empty`);
		}

		for (const releasePath of list) {
			const fullReleasePath = path.resolve(fullChannelPath, releasePath);
			const key = path.relative(sourceDir, fullReleasePath);
			const stats = fs.lstatSync(fullReleasePath);

			console.log(`${key} found`);

			const version = path.basename(releasePath, '.txt');

			if (stats.isDirectory()) {
				console.log(`Skipping directory - ${fullReleasePath}`);
			} else if (stats.isFile()) {
				const buildNumber = fs.readFileSync(fullReleasePath).toString();
				packages.push({ version, buildNumber });
			}
		}

		repo.set(channel, { packages, highest: findHighestVersion(packages) });
	};

	const iterateDirectory = async(dirPath: string): Promise<void> => {
		const list: string[] = await fs.promises.readdir(dirPath);

		if (list.length === 0) {
			throw new Error(`Source directory "${dirPath}" is empty`);
		}

		const processResults: Promise<void>[] = [];
		for (const channel of list) {
			processResults.push(processChannelDirectory(dirPath, channel));
		}

		await Promise.all(processResults);
	};

	await iterateDirectory(sourceDir);

	return repo;
}


