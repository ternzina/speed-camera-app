// Supersedes the old unauthenticated R2 -> public Supabase delivery expectations.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync('npm',['--prefix','cloudflare/camera-data','test'],{cwd:path.resolve(__dirname,'..'),stdio:'inherit'});
process.exit(result.status??1);
