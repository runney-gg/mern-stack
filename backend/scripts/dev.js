import 'dotenv/config';
import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const mongoUri = process.env.MONGODB_URI;
let mongoProcess;
let apiProcess;
let startedMongo = false;
let shuttingDown = false;

function localMongoTarget(uri) {
  if (!uri) return null;

  try {
    const parsed = new URL(uri);
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    const port = Number(parsed.port) || 27017;
    return localHosts.has(host) && port === 27017 ? { host, port } : null;
  } catch {
    return null;
  }
}

function canConnect(target) {
  return new Promise((resolveConnection) => {
    const socket = createConnection(target);
    const finish = (available) => {
      socket.destroy();
      resolveConnection(available);
    };

    socket.setTimeout(700, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function mongoConfigPath() {
  const configuredPath = process.env.MONGOD_CONFIG;
  const candidates = configuredPath
    ? [resolve(configuredPath)]
    : ['/opt/homebrew/etc/mongod.conf', '/usr/local/etc/mongod.conf'];
  return candidates.find((path) => existsSync(path));
}

function mongoLogArguments(configPath) {
  const configText = readFileSync(configPath, 'utf8');
  const configuredLogPath = configText.match(/^\s+path:\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');

  if (!configuredLogPath) return [];

  const resolvedLogPath = resolve(configuredLogPath);
  const logTarget = existsSync(resolvedLogPath) ? resolvedLogPath : dirname(resolvedLogPath);
  try {
    accessSync(logTarget, constants.W_OK);
    return [];
  } catch {
    // Use a writable temporary log when the Homebrew log path is missing or owned by another user.
  }

  const fallbackLogPath = join(tmpdir(), `spendwise-mongodb-${process.pid}.log`);
  console.warn(`MongoDB log path is unavailable to this user; using ${fallbackLogPath}.`);
  return ['--logpath', fallbackLogPath, '--logappend'];
}

async function waitForMongo(target) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (mongoProcess.spawnError) throw mongoProcess.spawnError;
    if (mongoProcess.exitCode !== null || mongoProcess.signalCode !== null) {
      throw new Error('The mongod process stopped before MongoDB became ready.');
    }
    if (await canConnect(target)) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  }

  throw new Error('MongoDB did not start listening within 30 seconds.');
}

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;

  if (apiProcess && apiProcess.exitCode === null && apiProcess.signalCode === null) {
    apiProcess.kill('SIGTERM');
  }
  if (startedMongo && mongoProcess && mongoProcess.exitCode === null && mongoProcess.signalCode === null) {
    mongoProcess.kill('SIGTERM');
  }

  const forceStopTimer = setTimeout(() => {
    for (const child of [apiProcess, startedMongo ? mongoProcess : null]) {
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 5_000);
  forceStopTimer.unref();
}

async function start() {
  const target = localMongoTarget(mongoUri);

  if (!mongoUri) {
    console.warn('MONGODB_URI is not set; starting the API without managing MongoDB.');
  } else if (target && await canConnect(target)) {
    console.log(`MongoDB is already available at ${target.host}:${target.port}.`);
  } else if (target) {
    const configPath = mongoConfigPath();
    if (!configPath) {
      throw new Error('Could not find mongod.conf. Set MONGOD_CONFIG to its path or start MongoDB separately.');
    }

    console.log(`Starting local MongoDB with ${configPath}...`);
    mongoProcess = spawn('mongod', ['--config', configPath, ...mongoLogArguments(configPath)], { stdio: 'inherit' });
    mongoProcess.spawnError = null;
    mongoProcess.once('error', (error) => { mongoProcess.spawnError = error; });
    startedMongo = true;
    await waitForMongo(target);
    console.log('MongoDB is ready.');
  } else {
    console.log('Using the configured MongoDB URI; no local mongod process will be started.');
  }

  apiProcess = spawn(process.execPath, ['src/server.js'], { stdio: 'inherit' });
  apiProcess.once('error', (error) => {
    console.error(`Could not start the SpendWise API: ${error.message}`);
    process.exitCode = 1;
    stopChildren();
  });
  apiProcess.once('exit', (code, signal) => {
    if (!shuttingDown) {
      process.exitCode = code ?? (signal ? 1 : 0);
      stopChildren();
    }
  });
}

process.once('SIGINT', () => {
  process.exitCode = 130;
  stopChildren();
});
process.once('SIGTERM', () => {
  process.exitCode = 143;
  stopChildren();
});

start().catch((error) => {
  console.error(`SpendWise development startup failed: ${error.message}`);
  process.exitCode = 1;
  stopChildren();
});
