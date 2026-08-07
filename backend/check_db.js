import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/devsync' });

async function check() {
  const commits = await pool.query("SELECT * FROM github_commits WHERE message_headline LIKE '%FE-13%' OR branch_name LIKE '%FE-13%'");
  console.log('COMMITS:', commits.rows.length);
  const branches = await pool.query("SELECT * FROM github_branches WHERE branch_name LIKE '%FE-13%'");
  console.log('BRANCHES:', branches.rows.length);
  process.exit(0);
}
check();
