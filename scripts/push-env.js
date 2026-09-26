const fs = require('fs');
const { execSync } = require('child_process');

const envFile = fs.readFileSync('.env', 'utf8');
const lines = envFile.split('\n');

for (const line of lines) {
  if (line.trim() && !line.startsWith('#')) {
    const splitIndex = line.indexOf('=');
    if (splitIndex === -1) continue;
    
    const key = line.slice(0, splitIndex).trim();
    let value = line.slice(splitIndex + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && value) {
      console.log(`Adding ${key} to Vercel...`);
      try {
        execSync(`vercel env add ${key} production,preview,development --value "${value.replace(/"/g, '\\"')}" --force --yes`, { stdio: 'inherit' });
      } catch (err) {
        console.error(`Failed to add ${key}`);
      }
    }
  }
}
console.log('All env vars pushed to Vercel!');
