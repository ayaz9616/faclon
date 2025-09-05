import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'config', 'network_definition.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Config file not found', details: err.message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
