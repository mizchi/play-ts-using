# typescript 5.2 using and DisposableStack

```bash
$ pnpm install
$ pnpm tsc -p . && node --expose-gc lib/index.js
```

## Reading Polyfill

from

```ts
import "core-js/modules/esnext.symbol.dispose.js";
import "core-js/modules/esnext.symbol.async-dispose.js";
import "core-js/modules/esnext.disposable-stack.constructor.js";
using g = {
  [Symbol.dispose]: () => {
    console.log("dispose")
  }
}
```

to

```js
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object") throw new TypeError("Object expected.");
        var dispose;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        function next() {
            while (env.stack.length) {
                var rec = env.stack.pop();
                try {
                    var result = rec.dispose && rec.dispose.call(rec.value);
                    if (rec.async) return Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                }
                catch (e) {
                    fail(e);
                }
            }
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import "core-js/modules/esnext.symbol.dispose.js";
import "core-js/modules/esnext.symbol.async-dispose.js";
import "core-js/modules/esnext.disposable-stack.constructor.js";
var g;
const env_1 = { stack: [], error: void 0, hasError: false };
try {
    g = __addDisposableResource(env_1, {
        [Symbol.dispose]: () => {
            console.log('dispose');
        }
    }, false);
}
catch (e_1) {
    env_1.error = e_1;
    env_1.hasError = true;
}
finally {
    __disposeResources(env_1);
}
```

---

(Japanese)

### ランタイム部分

```js
var g;
const env_1 = { stack: [], error: void 0, hasError: false };
try {
    g = __addDisposableResource(env_1, {
        [Symbol.dispose]: () => {
            console.log('dispose');
        }
    }, false);
}
catch (e_1) {
    env_1.error = e_1;
    env_1.hasError = true;
}
finally {
    __disposeResources(env_1);
}
```

- try catch で囲って finally で解放
- `__addDisposableResource` にローカルのコンテキストとして登録

### __addDisposableResource

```js
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object") throw new TypeError("Object expected.");
        var dispose;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
```

複数回定義されてないか確認(たぶん tslib 化される)
ほとんどはランタイムエラーチェック。

実質的には `env.stack.push({ value: value, dispose: dispose, async: async });` だけ

### __disposeResources

```js
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        function next() {
            while (env.stack.length) {
                var rec = env.stack.pop();
                try {
                    var result = rec.dispose && rec.dispose.call(rec.value);
                    if (rec.async) return Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                }
                catch (e) {
                    fail(e);
                }
            }
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
```

主に stack を pop して dispose を call している。
async フラグが立っている場合は Promise chain に変換して next で次に渡す。

```js
            while (env.stack.length) {
                var rec = env.stack.pop();
                try {
                    var result = rec.dispose && rec.dispose.call(rec.value);
                    if (rec.async) return Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                }
                catch (e) {
                    fail(e);
                }
            }
```

asyncDispose の場合も async 糖衣構文の finally に解決されるので無事動くという感じだろう。

## LICENSE

MIT