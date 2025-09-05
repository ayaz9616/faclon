import fs from 'fs';
import path from 'path';

export async function GET() {
  // Example: Load operational schedule from a JSON file
  try {
    const filePath = path.join(process.cwd(), 'public', 'operational_schedule.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Schedule file not found', details: err.message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
