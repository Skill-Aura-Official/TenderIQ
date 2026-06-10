const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.ts') && filePath !== path.normalize('src/db/schema.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace Date.now() with new Date() where it's assigned to a timestamp field (roughly heuristic)
    content = content.replace(/:\s*Date\.now\(\)/g, ': new Date()');
    content = content.replace(/timestamp:\s*Date\.now\(\)/g, 'timestamp: new Date()');
    
    // For id fields that shouldn't be passed. Let's just comment out id: crypto.randomUUID()
    // and id: 'something_'
    content = content.replace(/id:\s*crypto\.randomUUID\(\),?/g, '');
    content = content.replace(/id:\s*`[a-zA-Z0-9_]+_\$\{Date\.now\(\)\}.*`,?/g, '');
    content = content.replace(/id:\s*`[a-zA-Z0-9_]+_\$\{new Date\(\)\}.*`,?/g, '');
    content = content.replace(/id:\s*crypto\.randomUUID\(\)/g, '');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed', filePath);
    }
  }
});
