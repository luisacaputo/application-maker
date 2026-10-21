import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';
import express from 'express';
import { downloadProject } from '../controllers/projectDownloadController';
import { createProjectArchive, getProjectArchivePath } from './projectArchive';

function readZipFiles(buffer: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  const end = buffer.length - 22;
  assert.equal(buffer.readUInt32LE(end), 0x06054b50);
  let offset = buffer.readUInt32LE(end + 16);
  for (let index = 0; index < buffer.readUInt16LE(end + 10); index += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const dataOffset = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const compressed = buffer.subarray(dataOffset, dataOffset + buffer.readUInt32LE(offset + 20));
    const data = buffer.readUInt16LE(offset + 10) === 8 ? inflateRawSync(compressed) : compressed;
    files.set(name, data.toString('utf8'));
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return files;
}

test('creates a downloadable ZIP with project files but no build or dependency folders', async () => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), 'project-archive-test-'));
  let archivePath: string | null = null;
  const app = express();
  app.get('/downloads/:id', downloadProject);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    await writeFile(path.join(projectPath, 'Program.cs'), 'var app = WebApplication.CreateBuilder(args);');
    await writeFile(path.join(projectPath, 'appsettings.json'), '{"ConnectionStrings":{"Default":""}}');
    for (const folder of ['Models', 'bin', 'obj', '.git', 'node_modules']) {
      await mkdir(path.join(projectPath, folder));
      await writeFile(path.join(projectPath, folder, 'test.txt'), folder);
    }
    const downloadUrl = await createProjectArchive(projectPath);
    const id = downloadUrl.split('/').pop();
    archivePath = getProjectArchivePath(id);
    const bytes = await readFile(archivePath);
    const files = readZipFiles(bytes);
    assert.deepEqual([...files.keys()].sort(), ['Models/test.txt', 'Program.cs', 'appsettings.json']);
    assert.equal(files.get('Models/test.txt'), 'Models');
    assert.equal(files.get('appsettings.json'), '{"ConnectionStrings":{"Default":""}}');

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}${downloadUrl}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /attachment;.*\.zip/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await fetch(`${baseUrl}/downloads/invalid`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/downloads/${'0'.repeat(32)}`)).status, 404);
    assert.equal(getProjectArchivePath('../appsettings.json'), null);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (archivePath) await rm(archivePath, { force: true });
    await rm(projectPath, { recursive: true, force: true });
  }
});

test('rejects project symlinks instead of including files outside the project', async () => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), 'project-archive-link-test-'));
  try {
    await symlink('/etc/hosts', path.join(projectPath, 'outside'));
    await assert.rejects(createProjectArchive(projectPath), /cannot contain symbolic links/);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
});
