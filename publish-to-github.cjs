const fs = require('fs');
const path = require('path');
const readline = require('readline');

// =================================================================
// ⚙️ GitHub 設定區 (您可以在此填寫，或是執行時在終端機互動輸入)
// =================================================================
const CONFIG = {
  username: '', // 您的 GitHub 帳號，例如 'your_username'
  token: '',    // 您的 GitHub Token (PAT)，例如 'ghp_xxxxxxxxxxxx'
  repoName: 'aura-music-app', // 儲存庫名稱
  isPrivate: false            // 是否設為私有庫 (true / false)
};
// =================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Ignore list
const IGNORE_DIRS = ['node_modules', 'dist', '.git', '.github'];
const IGNORE_FILES = ['publish-to-github.js', '.DS_Store'];

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        getFiles(filePath, fileList);
      }
    } else {
      if (!IGNORE_FILES.includes(file)) {
        fileList.push({
          absolutePath: filePath,
          relativePath: relativePath
        });
      }
    }
  }
  return fileList;
}

async function main() {
  console.log('\n=== AURA MUSIC - GitHub Publisher ===\n');

  try {
    let username = CONFIG.username.trim();
    let token = CONFIG.token.trim();
    let repoName = CONFIG.repoName.trim() || 'aura-music-app';
    let isPrivate = CONFIG.isPrivate;

    if (!username || !token) {
      console.log('💡 提示：您可以直接在 IDE 中編輯 publish-to-github.js 檔案，填寫最上方的 CONFIG 設定。');
      console.log('You will need a GitHub Personal Access Token (PAT) with "repo" permission.');
      console.log('Generate one at: https://github.com/settings/tokens\n');

      if (!username) {
        username = (await question('GitHub Username: ')).trim();
        if (!username) throw new Error('Username is required.');
      }
      if (!token) {
        token = (await question('GitHub Personal Access Token (PAT): ')).trim();
        if (!token) throw new Error('Token is required.');
      }
      if (CONFIG.repoName === 'aura-music-app' && !CONFIG.username) {
        repoName = (await question('Repository Name (default: aura-music-app): ')).trim() || 'aura-music-app';
        const isPrivateInput = (await question('Make repository private? (y/N): ')).trim().toLowerCase();
        isPrivate = isPrivateInput === 'y' || isPrivateInput === 'yes';
      }
    }

    console.log(`\n1. Creating repository "${repoName}" on GitHub...`);
    
    // Create Repo
    const createRepoRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'Aura-Music-Publisher'
      },
      body: JSON.stringify({
        name: repoName,
        description: 'Aura Music Web Application featuring YouTube Music and AI Album Covers.',
        private: isPrivate,
        auto_init: false
      })
    });

    if (!createRepoRes.ok) {
      const errData = await createRepoRes.json();
      throw new Error(`Failed to create repository: ${errData.message || createRepoRes.statusText}`);
    }

    const repoData = await createRepoRes.json();
    console.log(`✅ Repository created: ${repoData.html_url}`);

    console.log('\n2. Scanning project files...');
    const filesToUpload = getFiles(__dirname);
    console.log(`Found ${filesToUpload.length} files to upload.`);

    console.log('\n3. Uploading files to GitHub...');
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      console.log(`[${i + 1}/${filesToUpload.length}] Uploading ${file.relativePath}...`);
      
      const fileBuffer = fs.readFileSync(file.absolutePath);
      const contentBase64 = fileBuffer.toString('base64');

      const uploadUrl = `https://api.github.com/repos/${username}/${repoName}/contents/${file.relativePath}`;
      
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'Aura-Music-Publisher'
        },
        body: JSON.stringify({
          message: `Add ${file.relativePath}`,
          content: contentBase64,
          branch: 'main'
        })
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        console.error(`❌ Failed to upload ${file.relativePath}: ${errData.message}`);
        // Ask if want to continue
        const cont = (await question('Do you want to skip this file and continue? (y/N): ')).trim().toLowerCase();
        if (cont !== 'y' && cont !== 'yes') {
          throw new Error('Upload aborted by user.');
        }
      }
    }

    console.log('\n🎉 Successfully published to GitHub!');
    console.log(`Link: ${repoData.html_url}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    rl.close();
  }
}

main();
