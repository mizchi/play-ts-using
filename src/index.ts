/**
 * using and disposable check tests
 * $ pnpm add -D @types/node core-js typescript@5.2.0-beta
 * tsconfig.json - compilerOptions: { target: "es2022", lib: ["esnext", "es2022"], ...}
 * $ pnpm tsc -p . && node --expose-gc lib/index.js
 */

// need runtime polyfill (yet)
import "core-js/modules/esnext.symbol.dispose.js";
import "core-js/modules/esnext.symbol.async-dispose.js";
import "core-js/modules/esnext.disposable-stack.constructor.js";

// ref. https://zenn.dev/ventus/articles/ts5_2-using-preview
import { test } from "node:test";
import { deepEqual } from "node:assert";

function createTestDisposable(onDispose: () => any): Disposable {
  return {
    [Symbol.dispose]() {
      onDispose();
    }
  }
}

function createTestAsyncDisposable(onAsyncDispose: () => any): AsyncDisposable {
  return {
    async [Symbol.asyncDispose]() {
      return new Promise<void>(resolve => setTimeout(() => {
        onAsyncDispose();
        resolve();
      }, 16));
    }
  }
}

test('disposbale', () => {
  const order: string[] = [];
  {
    order.push('start');
    using _d1 = createTestDisposable(() => order.push('d1'));
    using _d2 = createTestDisposable(() => order.push('d2'));
    {
      using _d3 = createTestDisposable(() => order.push('d3'));
    }
    order.push('end')
  }
  deepEqual(order, [
    'start',
    'd3',
    'end',
    'd2',
    'd1',
  ]);
});

test('DisposbaleStack', () => {
  const order: string[] = [];
  {
    order.push('start');
    using stack = new DisposableStack();
    stack.use(
      createTestDisposable(() => order.push('d1'))
    );
    stack.use(
      createTestDisposable(() => order.push('d2'))
    );
    order.push('end')
  }
  deepEqual(order, [
    'start',
    'end',
    'd2',
    'd1',
  ]);
});

test('DisposbaleStack adopt', () => {
  const order: string[] = [];
  {
    order.push('start');
    using stack = new DisposableStack();
    stack.adopt(
      {
        v: 1
      },
      () => {
        order.push('adopted');
      }
    );
    order.push('end')
  }
  deepEqual(order, [
    'start',
    'end',
    'adopted',
  ]);
});

test('async-disposbale', async () => {
  const order: string[] = [];
  {
    order.push('start');
    await using _a1 = createTestAsyncDisposable(() => order.push('a1'));
    order.push("a1-a2");
    await using _a2 = createTestAsyncDisposable(() => order.push('a2'));
    {
      await using _a3 = createTestDisposable(() => order.push('a3'));
    }
    order.push('end')
  }
  order.push('out');
  deepEqual(order, [
    'start',
    'a1-a2',
    'a3',
    'end',
    'a2',
    'a1',
    'out'
  ]);
});

// Just call Symbol.dispose, no gc.
test('expose to parent closure', () => {
  let buf: any = null;
  {
    using d1 = createTestDisposable(() => {});
    // @ts-ignore
    d1.v = 1;
    buf = d1;
  }
  if (globalThis.gc) globalThis.gc();
  deepEqual(buf.v, 1);
});
