// netlify/functions/kegiatan.js
const { Client } = require('@notionhq/client');

const notion = new Client({ 
  auth: process.env.NOTION_TOKEN 
});

const databaseId = process.env.NOTION_DATABASE_ID;

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Mengambil data kegiatan dari database:', databaseId);
    
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const results = response.results.map(page => {
      // Ambil data dasar
      const item = {
        id: page.id,
        name: page.properties.Name?.title?.[0]?.plain_text || 'Tanpa Nama',
        hari: page.properties.Hari?.rich_text?.[0]?.plain_text || '',
        tanggal: page.properties.Tanggal?.date?.start || '',
        embed: page.properties.Embed?.url || page.properties.Embed?.rich_text?.[0]?.plain_text || null,
      };

      // Ambil properti image jika ada
      if (page.properties.Image) {
        if (page.properties.Image.files && page.properties.Image.files.length > 0) {
          const imageFile = page.properties.Image.files[0];
          if (imageFile.file) {
            // Gambar upload ke Notion - gunakan URL langsung (akan expired tapi bisa di-cache)
            item.image = imageFile.file.url;
          } else if (imageFile.external) {
            // Gambar external
            item.image = imageFile.external.url;
          }
        }
      }

      return item;
    });

    console.log('Data berhasil diambil:', results.length, 'item');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results)
    };
    
  } catch (error) {
    console.error('Error saat mengambil data kegiatan:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Gagal mengambil data dari Notion',
        details: error.message 
      })
    };
  }
};