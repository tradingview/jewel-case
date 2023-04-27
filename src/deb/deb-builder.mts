import type { Artifact, ArtifactsProvider } from '../artifacts-provider.mjs';
import { createDir, removeDir } from '../fs.mjs';
import type { IBuilder } from '../ibuilder.mjs';
import { requestRange } from '../http.mjs';
import type { Config } from '../config.mjs';
import * as path from 'path';
import * as fs from 'fs';
import * as tar from 'tar';

export class DebBuilder implements IBuilder {
	private readonly config: Config;
	private readonly artifactsProvider: ArtifactsProvider;

	private readonly pool: string;
    private readonly dists: string;
    private readonly keys: string;

	private debRepo: {
		channel: string,
		debs: {
			version: string,
			url: string,
			arch: string,
			artifact: Artifact
		}[]}[] = [];

	constructor(artifactsProvider: ArtifactsProvider, config: Config) {
		this.config = config;

		this.pool = `${ this.config.base.out }/repo/${ this.config.debBuilder.repoName }/deb/pool`;
        this.dists = `${ this.config.base.out }/repo/${ this.config.debBuilder.repoName }/deb/dists`;
        this.keys = `${ this.config.base.out }/repo/${ this.config.debBuilder.repoName }/deb/keys`;
		this.keys;
		this.artifactsProvider = artifactsProvider;
	}

	public async plan(): Promise<void> {
		for (const entry of this.config.base.repo) {
			let debs: {
				version: string,
				url: string,
				arch: string,
				artifact: Artifact
			}[] = [];

			for (const pack of entry.packages.packages) {
				const debArtifactItems = (await this.artifactsProvider.artifactsByBuildNumber(pack.buildNumber)).filter(artifact => artifact.type === 'deb');

				for (const artifact of debArtifactItems) {
					const arch = 'hui';
					debs.push({
						version: pack.version,
						url: this.artifactsProvider.artifactUrl(artifact),
						arch: arch,
						artifact: artifact
					});
				}
			}

			this.debRepo.push({ channel: entry.channel, debs });
		}

		
		for (const channel of this.debRepo) {
            for (const deb of channel.debs) {
                const debUrl = await this.artifactsProvider.artifactUrl(deb.artifact);
                const controlTarSizeRange = '120-129';

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const cocntrolTarSize = Number((await requestRange(debUrl, controlTarSizeRange)).read().toString().trim());
                const controlTarRange = `132-${ 131 + cocntrolTarSize }`;
                const controlTar = await requestRange(debUrl, controlTarRange);

                const whereExtract = path.join(this.dists, channel.channel, 'main', `binary-${ deb.arch }`, path.basename(debUrl, '.deb'));
        
                createDir(whereExtract);

                await new Promise<void>((resolve) => {
                    controlTar
                        .pipe(tar.extract({ cwd: whereExtract, strip: 1 }, ['./control']))
                        .on('finish', () => {
                            const targetMetaPath = path.join(this.dists, channel.channel, 'main', `binary-${ deb.arch }`, `${ this.debName(deb) }.meta`);
                            fs.renameSync(path.join(whereExtract, 'control'), targetMetaPath);

							removeDir(whereExtract);

                            const fileName = path.relative(`${ this.config.base.out }/repo/${ this.config.debBuilder.repoName }/deb`, path.join(this.pool, 'main', `t/tradingviewdesktop-${ channel.channel }`, this.debName(deb)));
                            const debSize = controlTar.headers['content-range']?.split('/')[1];
                            const sha1 = controlTar.headers['x-checksum-sha1'];
                            const sha256 = controlTar.headers['x-checksum-sha256'];
                            const md5 = controlTar.headers['x-checksum-md5'];

                            if (typeof sha1 !== 'string' || typeof sha256 !== 'string' || typeof md5 !== 'string' || typeof debSize !== 'string') {
                                throw new Error('No checksum was found in headers');
                            }

                            const dataToAppend = `Filename: ${ fileName }\nSize: ${ debSize }\nSHA1: ${ sha1 }\nSHA256: ${ sha256 }\nMD5Sum: ${ md5 }\n`;

                            fs.appendFile(targetMetaPath, dataToAppend, (err) => {
                                if (err) { 
                                    throw err;
                                }

                                resolve();
                            });
                    });
                });
            }
        }

	}

	public apply(): void {

	}

	private debName(deb: { version: string, arch: string }): string {
		return `${ this.config.debBuilder.repoName }-${ deb.version }_${ deb.arch }.deb`;
	}
}
