const { spawnSync } = require('child_process');
const run = (f) => spawnSync('node', [`${__dirname}/${f}`], { stdio: 'inherit' }).status;
const a = run('unit.test.js');
const b = run('integration.test.js');
process.exit(a || b ? 1 : 0);
