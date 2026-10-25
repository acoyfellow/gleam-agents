# Graders

A grader is any shell command. It runs in the seat's workspace after the agent stops. Exit 0 means pass.

## bench/hard hidden tests

`bench/hard` is 17 TypeScript tasks on a small checkout codebase. Each task has hidden tests in `bench/hard/accept/`. A reference solution passes every hidden test, and the seed fails every one. The grader copies the hidden test in, runs it, and removes it:

```sh
mkdir -p test/accept && cp "$FLEET_ROOT"/bench/hard/accept/<task>.test.ts "$FLEET_ROOT"/bench/hard/accept/fixtures.ts test/accept/ \
  && node --test --test-reporter=dot test/accept/<task>.test.ts; e=$?; rm -rf test/accept; exit $e
```

## cf-build-bench gate

[cf-build-bench](https://github.com/cloudflare/cf-build-bench) asks a model to build a Cloudflare Worker from an empty project. Its gate checks four things: it bundles, it typechecks, hidden tests pass in the Workers runtime, and it uses only allowed bindings. `fleet` hands the seat's `src/` to the gate:

```sh
cd "$CF_BUILD_BENCH" && npx tsx src/cli.ts gate --task kv-crud --candidate "$OLDPWD/src" --run-tests
```

The gate runs each command in a pinned Docker toolchain image. Build it once with `node scripts/build-test-toolchain.mjs` in cf-build-bench.

For this grader the seat's `test_command` is the same gate. The agent sees the gate's output, as it does in cf-build-bench's own loop, but never the hidden test source.

## Writing your own

Keep the grader out of the seed and out of the write list. Read only what the agent produced. Print why it failed: the output is saved as `items/<seat>.grade.txt`.
