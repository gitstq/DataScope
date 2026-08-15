import { test } from 'node:test';
import assert from 'node:assert/strict';
import Parser from '../src/js/parser.js';

test('JSON parse & stringify round-trip', () => {
  const data = { a: 1, b: [true, 'x'], c: { d: null } };
  const s = Parser.JSONStringify(data, 2);
  assert.deepEqual(Parser.JSONParse(s), data);
});

test('JSON minify', () => {
  assert.equal(Parser.JSONMinify({ a: 1, b: 2 }), '{"a":1,"b":2}');
});

test('YAML parse basic mapping', () => {
  const yaml = 'name: JsonLens\nversion: 1.0.0\nactive: true';
  const data = Parser.YAMLParse(yaml);
  assert.equal(data.name, 'JsonLens');
  assert.equal(data.active, true);
});

test('YAML nested + sequence', () => {
  const yaml = `config:\n  theme: dark\nservers:\n  - name: prod\n    port: 443\n  - name: dev\n    port: 8080`;
  const data = Parser.YAMLParse(yaml);
  assert.equal(data.config.theme, 'dark');
  assert.equal(data.servers.length, 2);
  assert.equal(data.servers[1].port, 8080);
});

test('YAML inline array & comments', () => {
  const yaml = 'tags: [a, b, c]  # comment\ncount: 3';
  const data = Parser.YAMLParse(yaml);
  assert.deepEqual(data.tags, ['a', 'b', 'c']);
  assert.equal(data.count, 3);
});

test('YAML stringify round-trip', () => {
  const obj = { name: 'x', list: [1, 2, { k: 'v' }], nested: { deep: true } };
  const yaml = Parser.YAMLStringify(obj);
  const back = Parser.YAMLParse(yaml);
  assert.deepEqual(back, obj);
});

test('TOML basic + table + array of tables', () => {
  const toml = `project = "JsonLens"
version = "1.0.0"
tags = ["a", "b"]

[config]
theme = "dark"
enabled = true

[[servers]]
name = "prod"
port = 443

[[servers]]
name = "dev"
port = 8080`;
  const data = Parser.TOMLParse(toml);
  assert.equal(data.project, 'JsonLens');
  assert.deepEqual(data.tags, ['a', 'b']);
  assert.equal(data.config.theme, 'dark');
  assert.equal(data.servers.length, 2);
  assert.equal(data.servers[0].port, 443);
});

test('TOML inline table', () => {
  const toml = `point = { x = 1, y = 2 }`;
  const data = Parser.TOMLParse(toml);
  assert.deepEqual(data.point, { x: 1, y: 2 });
});

test('CSV parse with header', () => {
  const csv = 'name,role,active\nAlice,admin,true\nBob,dev,false';
  const data = Parser.CSVParse(csv, true);
  assert.equal(data.length, 2);
  assert.equal(data[0].name, 'Alice');
  assert.equal(data[0].active, true);
});

test('CSV stringify round-trip', () => {
  const rows = [{ name: 'a,b', role: 'x' }, { name: 'c', role: 'y' }];
  const csv = Parser.CSVStringify(rows, true);
  const back = Parser.CSVParse(csv, true);
  assert.deepEqual(back, rows);
});

test('typeName detection', () => {
  assert.equal(Parser.typeName(null), 'null');
  assert.equal(Parser.typeName([1]), 'array');
  assert.equal(Parser.typeName({}), 'object');
  assert.equal(Parser.typeName(3), 'number');
});