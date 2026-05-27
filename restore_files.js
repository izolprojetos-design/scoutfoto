import https from 'https';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const listData = JSON.stringify({ action: 'list' });

const listOptions = {
  hostname: supabaseUrl.replace('https://', ''),
  path: '/functions/v1/archive-old-photos',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Content-Length': listData.length
  }
};

const req = https.request(listOptions, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.files && data.files.length > 0) {
        console.log(`Found ${data.files.length} files. Restoring...`);
        data.files.forEach(file => {
          restoreFile(file.name);
        });
      } else {
        console.log("No files found or error:", body);
      }
    } catch (e) {
      console.error("Failed to parse response:", body);
    }
  });
});

req.on('error', (e) => console.error(e));
req.write(listData);
req.end();

function restoreFile(fileName) {
  const restoreData = JSON.stringify({ action: 'restore', fileName });
  const restoreOptions = {
    hostname: supabaseUrl.replace('https://', ''),
    path: '/functions/v1/archive-old-photos',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Content-Length': restoreData.length
    }
  };

  const rReq = https.request(restoreOptions, (res) => {
    let rBody = '';
    res.on('data', (d) => rBody += d);
    res.on('end', () => console.log(`Restored ${fileName}:`, rBody));
  });
  rReq.on('error', (e) => console.error(`Error restoring ${fileName}:`, e));
  rReq.write(restoreData);
  rReq.end();
}
