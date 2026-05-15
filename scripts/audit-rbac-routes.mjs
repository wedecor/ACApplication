#!/usr/bin/env node
/**
 * CI guard: every controller handler must declare @Public(), @AllowAuthenticated(),
 * or @RequirePermissions() (or @Roles()).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API_SRC = join(process.cwd(), 'apps/api/src');
const CONTROLLERS_DIR = join(API_SRC, 'modules');

const HANDLER_DECORATORS = /@(Get|Post|Put|Patch|Delete|Head|Options)\(/;
const AUTH_DECORATORS =
  /@(Public|AllowAuthenticated|RequirePermissions|Roles)\(/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

const violations = [];

for (const file of walk(CONTROLLERS_DIR)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!HANDLER_DECORATORS.test(lines[i])) continue;
    const window = lines.slice(Math.max(0, i - 12), i + 8).join('\n');
    if (!AUTH_DECORATORS.test(window)) {
      violations.push(`${file}:${i + 1}`);
    }
  }
}

if (violations.length) {
  console.error('RBAC audit failed — handlers missing auth decorator:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('RBAC route audit passed.');
