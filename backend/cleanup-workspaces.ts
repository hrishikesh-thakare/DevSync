import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function cleanup() {
  try {
    const result = await sql`
      DELETE FROM workspaces 
      WHERE name ILIKE '%CRUD Test%' OR name ILIKE '%E2E Test Workspace%';
    `;
    console.log(`✅ Deleted ${result.count} test workspaces!`);
  } catch (error: any) {
    console.error('Failed to clean up workspaces:', error.message);
  } finally {
    await sql.end();
  }
}

cleanup();
