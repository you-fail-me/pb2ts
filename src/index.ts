#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import execa from 'execa';
import minimist from 'minimist';
import which from 'which';
import glob from 'fast-glob';
import pkgUp from 'pkg-up';
import camelCase from 'camelcase';

import { stripScope } from './utils';
import { defaults } from './defaults';
import {
  constructLocalJSEntry,
  constructLocalTSEntry,
  constructReadme,
  constructManifest,
  constructRootJSEntry,
  constructRootTSEntry,
} from './templates';

enum Errors {
  ENOPROTO = 'No *.proto files found in input directory',
  ENOMANIFEST = 'No NPM package found at working directory',
  ENOPLUGIN = 'Plugin not found',
}

interface Input {
  'proto-path': string;
  'out-path': string;
  name?: string;
  license?: string;
  version?: string;
  public?: boolean;
  scope?: string;
  readme?: boolean;
  manifest?: boolean;
}

const main = async () => {
  const cwd = process.cwd();
  const args = minimist<Input>(process.argv.slice(2));

  const params = {
    protoPath: args['proto-path'],
    outPath: args['out-path'],
    name: args['name'],
    license: args['license'],
    version: args['version'],
    public: !!args['public'],
    scope: defaults.scope,
    readme: args.readme === false ? false : true,
    manifest: args.manifest === false ? false : true,
  };

  // Locate the service's manifest
  const ownerPackagePath = await pkgUp({ cwd });
  if (!ownerPackagePath) {
    throw new Error(Errors.ENOMANIFEST);
  }

  const ownerPackageManifest = JSON.parse(
    fs.readFileSync(ownerPackagePath).toString('utf8')
  );

  params.version =
    params.version || ownerPackageManifest.version || defaults.version;
  params.license =
    params.license || ownerPackageManifest.license || defaults.license;
  params.name = params.name
    ? `@${params.scope}/${stripScope(params.name)}`
    : `@${params.scope}/${stripScope(ownerPackageManifest.name)}`;

  // Use absolute paths for more transparency
  const absoluteInputPath = path.resolve(cwd, params.protoPath);
  const absoluteOutputPath = path.resolve(cwd, params.outPath);

  // Locate the input *.proto
  const protoFiles = await glob(`${absoluteInputPath}/*.proto`);
  if (!protoFiles.length) {
    throw new Error(Errors.ENOPROTO);
  }
  // Clean the output dir
  await execa('rm', ['-fr', absoluteOutputPath]);
  await execa('mkdir', ['-p', absoluteOutputPath]);

  // Locate the necessary protoc pluginss
  const nodeProtocPlugin = which.sync('grpc_tools_node_protoc_plugin');
  if (!nodeProtocPlugin) {
    throw new Error(Errors.ENOPLUGIN);
  }

  const protocGenTsPlugin = which.sync('protoc-gen-ts');
  if (!protocGenTsPlugin) {
    throw new Error(Errors.ENOPLUGIN);
  }

  // Iterate over *.proto creating a subdirectory with JS & TS output for each
  for (const pf of protoFiles) {
    const name = path.parse(pf).name;
    const localAbsoluteOutputPath = path.join(absoluteOutputPath, name);

    fs.mkdirSync(localAbsoluteOutputPath);

    await Promise.all([
      // JS
      execa('grpc_tools_node_protoc', [
        `--proto_path=${absoluteInputPath}`,
        `--js_out=import_style=commonjs,binary:${localAbsoluteOutputPath}`,
        `--grpc_out=${localAbsoluteOutputPath}`,
        `--plugin=protoc-gen-grpc=${nodeProtocPlugin}`,
        pf,
      ]),
      // TS
      execa('protoc', [
        `--proto_path=${absoluteInputPath}`,
        `--ts_out=${localAbsoluteOutputPath}`,
        `--plugin=${protocGenTsPlugin}`,
        pf,
      ]),
    ]);

    // Construct entry files per *.proto file
    const jsOutput = await glob(`${localAbsoluteOutputPath}/*.js`);
    // Construct local index.js
    const entries = jsOutput.map(o => {
      const { name } = path.parse(o);

      return {
        name: camelCase(name),
        filePath: `./${name}`,
      };
    });

    const indexjs = constructLocalJSEntry(entries);
    fs.writeFileSync(
      path.resolve(localAbsoluteOutputPath, 'index.js'),
      indexjs
    );

    // Construct local index.d.ts
    const indexdts = constructLocalTSEntry(entries);
    fs.writeFileSync(
      path.join(localAbsoluteOutputPath, 'index.d.ts'),
      indexdts
    );
  }

  // Construct root index.js and index.d.ts
  const submodules = protoFiles.map(f => {
    const fname = path.parse(f).name;
    const name = camelCase(fname, { pascalCase: true });
    const filePath =
      './' +
      path.relative(absoluteOutputPath, path.join(absoluteOutputPath, fname));

    return { name, filePath };
  });

  // Construct root index.js
  const rootIndexjs = constructRootJSEntry(submodules);
  fs.writeFileSync(path.join(absoluteOutputPath, 'index.js'), rootIndexjs);
  // Construct root index.d.ts
  const rootIndexdts = constructRootTSEntry(submodules);
  fs.writeFileSync(path.join(absoluteOutputPath, 'index.d.ts'), rootIndexdts);

  // Construct generated package manifest
  const manifest = constructManifest({
    serviceName: ownerPackageManifest.name,
    name: params.name,
    public: params.public,
    version: params.version!,
    license: params.license!,
  });
  fs.writeFileSync(path.join(absoluteOutputPath, 'package.json'), manifest);

  // Construct readme
  const readme = constructReadme({
    serviceName: ownerPackageManifest.name,
    proto: protoFiles,
  });
  fs.writeFileSync(path.join(absoluteOutputPath, 'README.md'), readme);
};

main().catch(e => {
  console.log(e);
  process.exit(1);
});
