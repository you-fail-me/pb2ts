# pb2ts

A primitive tool to generate JS &amp; TS code from .proto definitions.

## Description

It uses `protoc` and `protoc-gen-ts` plugins to output Javascript code and Typescript type definitions, wrapping the output with an npm package.

Every processed .proto file yields a directory in the output, which is then re-exported from root.

It's just a wrapper, main motivation for which was to generate a package, ready to be used with lerna - API code would be exported to shared packages dir and can then be consumed by any lerna subproject.

## Usage

The package exposes `pb2ts` binary which can be invoked as follows:

```
pb2ts --out-path ../../generated-proto/grpc-server --proto-path ./src/proto
```

where `proto-path` is path to .proto files, relative to cwd, `out-path` - output directory (is created if not exists, overwritten if exists).

### Parameters

- `proto-path` - required, path to source .proto files, relative to cwd;
- `out-path` - required, path to place the output directory, relative to cwd;
- `manifest` - optional, defaults to `true`, if set to false, the `package.json` file is not generated;
- `name` - optional, defaults to package name (as per package.json) of the source project, from where the script is called, name of the generated package;
- `license` - optional, defaults to source project license - license for the generated package;
- `public` - optional, defaults to false, opposite of the "private" field of the generated package.json;
- `scope` - optional, defaults to "pb2ts", scope for the generated package;
- `readme` - optional, defaults to `true`, if set to false the readme is not generated;

## TODO

- [ ] Absolute path support;
- [ ] Use `scope` parameter;
- [ ] Use `manifest` and `readme` flags.
