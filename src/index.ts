export type Ident = string;
export type Bindings = Record<Ident, unknown>;
export type List<T> = null | Cons<T>;
export type Cons<T> = { 0: T, 1: List<T> };
export type JExp = unknown;
export type JVal = unknown;

export function Cons<T>(x: T, xs: List<T>): List<T> {
  return [x, xs];
}

export function car<T>(pair: Cons<T>): T {
  return pair[0];
}

export function cdr<T>(pair: Cons<T>): List<T> {
  return pair[1];
}

export const Nil = null;

export const stdlib: Bindings = {
  'plus': (...xs: number[]) => xs.reduce((acc, x) => acc + x, 0),
  'mult': (...xs: number[]) => xs.reduce((acc, x) => acc * x, 1),
  'minus': (l: number, r?:number) => typeof(r) === 'number' ? l - r : -l,
  'div': (l: number, r:number) => l / r,
  'mod': (l: number, r:number) => l % r,
  'eq': (l: JVal, r: JVal) => l == r,
  'gt': (l: number, r:number) => l > r, 
  'gte': (l: number, r:number) => l >= r,
  'lt': (l: number, r:number) => l < r,
  'lte': (l: number, r:number) => l <= r,
  'and': (...args: unknown[]) => args.reduce((acc, x) => acc && !!x, true),
  'or': (...args: unknown[]) => args.reduce((acc, x) => acc || !!x, true),
  'pick': (keys: string[], o: object) => keys.reduce((acc, k) => (acc[k] = o[k], acc), {}),
  'omit': (keys: string[], o: object) => Object.keys(o).reduce((acc, k) => (keys.indexOf(k) === -1 && (acc[k] = o[k]), acc), {}),
  '$omit': (keys: string[], o: object) => ({ apply: 'omit', args: [{$: keys}, o] }),
  'get': (o: object, ...keys: string[]) => keys.reduce((acc, k) => acc[k], o),
  '$get': (dotexpr: string) => ({ get: dotexpr.split('.').map((a, idx) => idx === 0 ? a : ({$: a })) }),
  '$if': (condition: JExp) => ({ cond: [{if: condition, then: this.then}, {else: this.else}] }),
  '$record': (spec) => ({_$: Object.keys(spec).reduce((acc, key) => (acc[key] = {$_: spec[key]}, acc), {}) }),
};

/**
 * Evaluate `JExp`
 * 
 *     const ex01: JExp = {
 *       let: {
 *         one: 1,
 *         two: 2,
 *       },
 *       in: {
 *         plus: ['one', 'two'],
 *       }
 *     };
 *     assert.deepEqual(jexp.jeval(ex01), 3);
 *
 *     const ex02: JExp = {
 *       let: {
 *         times10: {lambda: 'a', body: {mult:['a', 10]} },
 *         two: 2,
 *         twoTimesTen: {times10: 'two'},
 *       },
 *       in: ['two', 'twoTimesTen'],
 *     };
 *     assert.deepEqual(jexp.jeval(ex02), [2, 20]);
 *
 *     const ex03: JExp = {
 *       let: {
 *         one: 1,
 *         two: 2,
 *         onePlusTwo: {plus: ['one', 'two']},
 *         quotedOnePlusTwo: {$: {plus: ['one', 'two']}},
 *       },
 *       in: ['one', 'two', 'onePlusTwo', 'quotedOnePlusTwo'],
 *     };
 *     assert.deepEqual(jexp.jeval(ex03), [1, 2, 3, {plus: ['one', 'two']}]);
 *
 *     const ex04: JExp = {
 *       let: {
 *         someThings: {$: [
 *           {name: 'banana', type: 'fruits'},
 *           {name: 'teapot', type: 'dishes'},
 *           {name: 'Sun', type: 'stars'},
 *         ]},
 *         expressions: {_$: {
 *           '1 + 1': {$_: {plus: [1, 1]}},
 *           '(1 + 2) * 3': {$_: {mult: [{plus: [1, 2]}, 3]}},
 *           '10 % 3': {$_: {mod: [10, 3]}},
 *         }},
 *       },
 *       in: ['someThings', 'expressions'],
 *     };
 *     assert.deepEqual(jexp.jeval(ex04), [
 *       [{name: 'banana', type: 'fruits'},
 *        {name: 'teapot', type: 'dishes'},
 *        {name: 'Sun', type: 'stars'},
 *       ], {
 *         '1 + 1': 2,
 *         '(1 + 2) * 3': 9,
 *         '10 % 3': 1,
 *       },
 *     ]);
 */
export function jeval(expr: JExp, ctx?: List<Readonly<Bindings>>): JVal {
  return go(Cons(stdlib, ctx || Nil), expr);
}

function go(ctx: List<Readonly<Bindings>>, expr: JExp): JVal {
  if (typeof (expr) === 'string') {
    // Looking for binding `expr` in context
    for (let iter = ctx; iter; iter = cdr(iter)) {
      const bindings = car(iter);
      if (bindings.hasOwnProperty(expr)) {
        return bindings[expr];
      }
    }
    throw new Error('Undefined symbol ' + JSON.stringify(expr));
  }
  
  if (Array.isArray(expr)) {
    return expr.map(e => go(ctx, e));
  }
  
  if (expr === null || typeof (expr) !== 'object') {
    return expr;
  }

  if ('$' in expr) {
    return expr['$'];
  }

  if ('_$' in expr) {
    return quasiquote(ctx, expr['_$']);
  }
    
  if ('let' in expr) {
    if (!('in' in expr)) throw new Error(`Missing "in" property in a "let" form`);
    const rawBindings = expr['let'], acc = {}, newCtx = Cons(acc, ctx);
    Object.keys(rawBindings).reduce((acc, key) => (acc[key] = go(newCtx, rawBindings[key]), acc), acc);
    return go(newCtx, expr['in']);
  }
  
  if ('lambda' in expr) {
    if (!('body' in expr)) throw new Error(`Missing "body" property in a "lambda" form`);
    const argsNames: string[] = promoteArray(expr['lambda']);
    return (...argValues) => {
      const bindings = argsNames.reduce<Bindings>((acc, name, idx) => (acc[name] = argValues[idx], acc), {});
      return go(Cons(bindings, ctx), expr['body']);
    }
  }
  
  if ('cond' in expr) {
    for (const test of expr['cond']) {
      if ('else' in test) return go(ctx, test.else);
      if (go(ctx, test.if)) {
        return go(ctx, test.then);
      }
    }
  }

  if ('apply' in expr) {
    if (!('args' in expr)) throw new Error(`Missing "args" property in an "apply" form`);
    const func = go(ctx, expr['apply']);
    // @ts-ignore
    const params = expr['args'].map(e => go(ctx, e));
    // @ts-ignore
    return func.apply(void 0, params);
  }

  const ident = chooseKey(expr);
  
  // Looking for binding for `key` in context
  for (let iter = ctx; iter; iter = cdr(iter)) {
    const bindings = car(iter);
    if (ident in bindings) {
      // Found bound value
      const func = bindings[ident];
      if (typeof (func) !== 'function') {
        throw new Error('Symbol ' + ident + ' is not a function');
      }
      if (ident[0] === '$') {
        // Macro expansion
        return go(ctx, func.apply(expr, promoteArray(expr[ident])));
      } else {
        // Function call
        const params = promoteArray(expr[ident]).map(e => go(ctx, e));
        return func.apply(void 0, params);
      }
    }
  }
  throw new Error(ident[0] === '$' ? 'Undefined macros ' + ident : 'Undefined function ' + ident);
}

function quasiquote(ctx: List<Readonly<Bindings>>, expr: JExp): JVal {
  if (Array.isArray(expr)) {
    return expr.map(e => quasiquote(ctx, e));
  }

  if (expr === null || typeof(expr) !== 'object') {
    return expr;
  }

  if ('$_' in expr) {
    return go(ctx, expr['$_']);
  }

  return Object.keys(expr).reduce((acc, k) => (acc[k] = quasiquote(ctx, expr[k]), acc), {});
}

function chooseKey(expr: JExp): Ident {
  const keys = Object.keys(expr as object);
  if (keys.length === 1) {
    return keys[0]
  }
  for (const k of keys) {
    if (/^\$/.test(k)) return k;
  }
  
  throw new Error(`Cannot identify the symbol in form {${keys.join(', ')}}`);
}

function promoteArray<T>(maybeArray: T|T[]): T[] {
  return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
}

