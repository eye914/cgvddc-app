import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export default function Home() {
  const htmlPath = path.join(process.cwd(), 'public', 'cgv-body.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
