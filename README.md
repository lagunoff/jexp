[![Generic badge](https://img.shields.io/badge/status-experimental-red.svg)](https://shields.io/)
## Installation
```sh
$ yarn add jexp

```
## API reference
#### jeval

`function jeval(expr: unknown, ctx?: Cons<Readonly<Record<string, unknown>>>): unknown;`

Evaluate `JExp`

```ts
 const ex01: JExp = {
   let: {
     one: 1,
     two: 2,
   },
   in: {
     plus: ['one', 'two'],
   }
 };
 assert.deepEqual(jexp.jeval(ex01), 3);
```

```ts
 const ex02: JExp = {
   let: {
     times10: {lambda: 'a', body: {mult:['a', 10]} },
     two: 2,
     twoTimesTen: {times10: 'two'},
   },
   in: ['two', 'twoTimesTen'],
 };
 assert.deepEqual(jexp.jeval(ex02), [2, 20]);
```

```ts
 const ex03: JExp = {
   let: {
     one: 1,
     two: 2,
     onePlusTwo: {plus: ['one', 'two']},
     quotedOnePlusTwo: {$: {plus: ['one', 'two']}},
   },
   in: ['one', 'two', 'onePlusTwo', 'quotedOnePlusTwo'],
 };
 assert.deepEqual(jexp.jeval(ex03), [1, 2, 3, {plus: ['one', 'two']}]);
```

```ts
 const ex04: JExp = {
   let: {
     someThings: {$: [
       {name: 'banana', type: 'fruits'},
       {name: 'teapot', type: 'dishes'},
       {name: 'Sun', type: 'stars'},
     ]},
     expressions: {_$: {
       '1 + 1': {$_: {plus: [1, 1]}},
       '(1 + 2) * 3': {$_: {mult: [{plus: [1, 2]}, 3]}},
       '10 % 3': {$_: {mod: [10, 3]}},
     }},
   },
   in: ['someThings', 'expressions'],
 };
 assert.deepEqual(jexp.jeval(ex04), [
   [{name: 'banana', type: 'fruits'},
    {name: 'teapot', type: 'dishes'},
    {name: 'Sun', type: 'stars'},
   ], {
     '1 + 1': 2,
     '(1 + 2) * 3': 9,
     '10 % 3': 1,
   },
 ]);
```
