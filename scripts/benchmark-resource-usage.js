// scripts/benchmark-resource-usage.js
// Samples live CPU and Memory usage for RoboIsland processes across a specified duration
const { execSync } = require('child_process');
const os = require('os');

function getProcesses() {
  try {
    const psScript = `Get-Process | Where-Object { $_.ProcessName -match 'RoboIsland|electron' } | ForEach-Object { $p = $_; $cim = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $p.Id); [PSCustomObject]@{ Id = $p.Id; ProcessName = $p.ProcessName; CPU = $p.CPU; WorkingSet64 = $p.WorkingSet64; CommandLine = if ($cim) { $cim.CommandLine } else { '' } } } | ConvertTo-Json -Compress`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const raw = execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, { encoding: 'utf-8' });
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch (err) {
    return [];
  }
}

function resolveRole(cmd) {
  if (!cmd) return 'Main Process';
  if (cmd.includes('--type=renderer')) return 'Renderer (Island UI)';
  if (cmd.includes('--type=gpu-process')) return 'GPU Process';
  if (cmd.includes('--type=utility')) return 'Utility Process';
  if (cmd.includes('--type=crashpad-handler')) return 'Crashpad';
  return 'Main Process';
}

async function runBenchmark(durationSeconds = 3) {
  const cores = os.cpus().length;
  console.log(`Sampling RoboIsland processes over ${durationSeconds}s (${cores} CPU cores)...`);
  
  const sample1 = getProcesses();
  if (sample1.length === 0) {
    console.log('No RoboIsland processes found running.');
    return;
  }

  await new Promise(r => setTimeout(r, durationSeconds * 1000));
  const sample2 = getProcesses();

  let totalCpu = 0;
  let totalRamMb = 0;

  console.log('\n-------------------------------------------------------------------------------------');
  console.log(' PID    | Role                  | CPU %   | RAM (MB)');
  console.log('-------------------------------------------------------------------------------------');

  for (const p2 of sample2) {
    const p1 = sample1.find(p => p.Id === p2.Id);
    let cpuPercent = 0;
    if (p1 && p2.CPU >= p1.CPU) {
      const cpuDeltaSec = p2.CPU - p1.CPU;
      cpuPercent = Math.round((cpuDeltaSec / (durationSeconds * cores)) * 1000) / 10;
    }
    const ramMb = Math.round((p2.WorkingSet64 / (1024 * 1024)) * 10) / 10;
    totalCpu += cpuPercent;
    totalRamMb += ramMb;
    const role = resolveRole(p2.CommandLine);

    console.log(` ${String(p2.Id).padEnd(6)} | ${role.padEnd(21)} | ${String(cpuPercent + '%').padEnd(7)} | ${ramMb} MB`);
  }

  console.log('-------------------------------------------------------------------------------------');
  console.log(` TOTAL OVERALL:                   ${Math.round(totalCpu * 10) / 10}% CPU | ${Math.round(totalRamMb * 10) / 10} MB RAM`);
  console.log('-------------------------------------------------------------------------------------\n');
}

runBenchmark(3);
