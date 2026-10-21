import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';

const ARCHIVE_DIRECTORY = path.resolve(__dirname, '../../generated-projects/.downloads');
const EXCLUDED_DIRECTORIES = new Set(['bin', 'obj', '.git', 'node_modules']);

export function getProjectArchivePath(id: string): string | null {
  return /^[a-f0-9]{32}$/.test(id) ? path.join(ARCHIVE_DIRECTORY, `${id}.zip`) : null;
}

export async function createProjectArchive(projectPath: string): Promise<string> {
  const id = randomBytes(16).toString('hex');
  const archivePath = path.join(ARCHIVE_DIRECTORY, `${id}.zip`);
  const files: string[] = [];

  async function addDirectory(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Project archives cannot contain symbolic links');
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) await addDirectory(filePath);
      } else if (entry.isFile()) {
        files.push(filePath);
      }
    }
  }

  await mkdir(ARCHIVE_DIRECTORY, { recursive: true, mode: 0o700 });
  const temporaryPath = `${archivePath}.tmp`;
  try {
    await addDirectory(projectPath);
    const archive = new ZipFile();
    for (const filePath of files) {
      archive.addFile(filePath, path.relative(projectPath, filePath).split(path.sep).join('/'));
    }
    const output = createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 });
    const completion = pipeline(archive.outputStream, output);
    archive.on('error', error => output.destroy(error));
    archive.end();
    await completion;
    await rename(temporaryPath, archivePath);
    return `/downloads/${id}`;
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}
