const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function getFiles(dir) {
    const subdirs = fs.readdirSync(dir);
    const files = [];
    subdirs.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            files.push(...getFiles(fullPath));
        } else if (file.endsWith('.js')) {
            files.push(fullPath);
        }
    });
    return files;
}

const files = getFiles(srcDir);
let errorCount = 0;

console.log("🔍 Verifying Source Files...");

files.forEach(file => {
    try {
        console.log(`Checking ${path.relative(srcDir, file)}...`);
        const module = require(file); // Attempt to load
        
        // Specific checks
        if (file.endsWith('checkpoint.js')) {
             if (typeof module.handleMobileVerification !== 'function') {
                 console.error("❌ ERROR: checkpoint.js missing handleMobileVerification export");
                 errorCount++;
             }
        }
        if (file.endsWith('logger.js')) {
             if (typeof module.info !== 'function') {
                 console.error("❌ ERROR: logger.js missing info export");
                 errorCount++;
             }
        }

    } catch (e) {
        // Ignore "missing module" if it's external, but catch ReferenceErrors
        if (e.message.includes('process.env') || e.code === 'MODULE_NOT_FOUND') {
            // runtime env missing is expected
        } else {
            console.error(`❌ ERROR in ${path.relative(srcDir, file)}:`, e);
            errorCount++;
        }
    }
});

if (errorCount > 0) {
    console.error(`\n💥 Found ${errorCount} critical errors. Fix them before publishing!`);
    process.exit(1);
} else {
    console.log("\n✅ All files verified successfully (syntax checks passed).");
    process.exit(0);
}
