import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as toolCache from "@actions/tool-cache";

import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

const version = "1.0.6";
const setupZipUrl =
	`https://github.com/SSLcom/eSignerCKA/releases/download/v${version}/SSL.COM-eSigner-CKA_${version}.zip`;

async function run(): Promise<void> {
	try {
		const runnerTemp = process.env.RUNNER_TEMP;
		assert.ok(runnerTemp, "RUNNER_TEMP is not set");
		const tempDir = path.join(runnerTemp, randomUUID());
		await io.mkdirP(tempDir);
		const downloadedZip = path.join(tempDir, "downloaded.zip");
		const extractDir = path.join(tempDir, "extracted");

		let installDir = core.getInput("install-dir");
		if (!installDir) {
			installDir = path.join(tempDir, "install");
		}
		core.setOutput("install-dir", installDir);

		// login options
		const mode = core.getInput("mode"); // sandbox or product
		const username = core.getInput("username");
		const password = core.getInput("password");
		const totpSecret = core.getInput("totp-secret");
		let masterKeyFile = core.getInput("master-key-file"); // output file
		if (!masterKeyFile) {
			masterKeyFile = path.join(installDir, "master.key");
		}

		core.setSecret(mode);
		core.setSecret(username);
		core.setSecret(password);
		core.setSecret(totpSecret);

		// first, download the installer
		await core.group(`Downloading eSignerCKA from ${setupZipUrl}`, async () => {
			const response = await fetch(setupZipUrl);
			if (!response.ok) {
				throw new Error(
					`Failed to download eSignerCKA: ${response.statusText}`,
				);
			}
			if (!response.body) {
				throw new Error("Response body is null");
			}
			const stream = createWriteStream(downloadedZip);
			await finished(Readable.fromWeb(response.body).pipe(stream));
		});

		// then, extract the installer
		const installerName = await core.group(
			`Extracting eSignerCKA to ${extractDir}`,
			async () => {
				await toolCache.extractZip(downloadedZip, extractDir);
				await io.rmRF(downloadedZip);

				// find the installer
				const installerName = await fs
					.readdir(extractDir)
					.then((x) =>
						x.find(
							(n) =>
								n.endsWith(".exe") &&
								n.toLowerCase().includes("eSigner".toLowerCase()),
						),
					);
				if (installerName === undefined) {
					throw new Error("Installer not found");
				}
				return installerName;
			},
		);
		core.info(`Using installer: ${installerName}`);
		const originalInstaller = path.join(extractDir, installerName);
		const installerPath = path.join(extractDir, "installer.exe");
		await io.mv(originalInstaller, installerPath);

		// Setup eSignerCKA in Silent Mode
		await core.group("Running installer in silent mode", async () => {
			await io.mkdirP(installDir);
			await exec.exec(installerPath, [
				"/CURRENTUSER",
				"/VERYSILENT",
				"/SUPPRESSMSGBOXES",
				`/DIR=${installDir}`,
			]);
		});

		const ckaTool = path.join(installDir, "eSignerCKATool.exe");

		// Login SSL.com
		await core.group("Logging in to SSL.com", async () => {
			await exec.exec(ckaTool, [
				"config",
				"-mode",
				mode,
				"-user",
				username,
				"-pass",
				password,
				"-totp",
				totpSecret,
				"-key",
				masterKeyFile,
			]);
		});

		// reload certificate to windows
		core.info("Reloading certificates to Windows");
		await exec.exec(ckaTool, ["unload"]);
		await exec.exec(ckaTool, ["load"]);
	} catch (error) {
		if (error instanceof Error) core.setFailed(error);
		else throw error;
	}
}

run();
