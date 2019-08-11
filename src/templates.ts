const templates = {
  import: {
    cjs: {
      default: (name: string, filePath: string) =>
        `const ${name} = require('${filePath}');`,
    },
    esm: {
      named: (name: string, filePath: string) =>
        `import * as ${name} from '${filePath}';`,
    },
  },
  export: {
    cjs: {
      named: (name: string) => `module.exports.${name} = ${name};`,
      default: (names: string[]) =>
        `module.exports = {${names.map(n => `...${n}`).join(', ')}};`,
    },
    esm: {
      named: (names: string[]) => `export {${names.join(', ')}};`,
      reexport: (filePath: string) => `export * from '${filePath}';`,
    },
  },
};

export interface Entry {
  name: string;
  filePath: string;
}

export interface ManifestParams {
  name: string;
  serviceName: string;
  version: string;
  public: boolean;
  license: string;
}

export interface ReadmeParams {
  serviceName: string;
  proto: string[];
}

export const constructLocalJSEntry = (entries: Entry[]) => `\
${entries.map(e => templates.import.cjs.default(e.name, e.filePath)).join('\n')}

${templates.export.cjs.default(entries.map(e => e.name))}
`;

export const constructLocalTSEntry = (entries: Entry[]) => `\
${entries.map(e => templates.export.esm.reexport(e.filePath)).join('\n')}
`;

export const constructRootJSEntry = (entries: Entry[]) => `\
${entries.map(e => templates.import.cjs.default(e.name, e.filePath)).join('\n')}

${entries.map(e => templates.export.cjs.named(e.name)).join('\n')}
`;

export const constructRootTSEntry = (entries: Entry[]) => `\
${entries.map(e => templates.import.esm.named(e.name, e.filePath)).join('\n')}

${templates.export.esm.named(entries.map(e => e.name))}
`;

export const constructReadme = (params: ReadmeParams) => `\
# Generated Typescript code for \`${params.serviceName}\`.

Source *.proto files:

${params.proto.map(p => `  - \`${p}\`;`).join('\n')}

Generated at \`${new Date().toISOString()}\`
`;

export const constructManifest = (params: ManifestParams) =>
  JSON.stringify(
    {
      name: params.name,
      version: params.version,
      private: !params.public,
      license: params.license,
      description: `Generated protobuf code for the ${params.serviceName} package`,
      main: 'index.js',
      types: 'index.d.ts',
    },
    null,
    2
  );
