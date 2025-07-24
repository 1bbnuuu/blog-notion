// netlify/functions/kegiatan-detail.js
const { Client } = require('@notionhq/client');

const notion = new Client({ 
  auth: process.env.NOTION_TOKEN 
});

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

  const pageId = event.queryStringParameters?.id;
  
  if (!pageId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'ID parameter is required' })
    };
  }

  try {
    console.log('Mengambil detail untuk page ID:', pageId);
    
    // Validasi format ID
    if (pageId.length < 32) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'ID halaman tidak valid',
          pageId: pageId 
        })
      };
    }

    const response = await notion.blocks.children.list({ 
      block_id: pageId 
    });

    console.log('Jumlah blok ditemukan:', response.results.length);

    // Fungsi helper untuk memproses rich text dengan formatting
    function processRichText(richTextArray) {
      if (!richTextArray || !Array.isArray(richTextArray)) return '';
      
      return richTextArray.map(rt => {
        let text = rt.plain_text || '';
        
        // Jika ada link
        if (rt.href) {
          text = `<a href="${rt.href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${text}</a>`;
        }
        
        // Apply formatting
        if (rt.annotations) {
          if (rt.annotations.bold) text = `<strong>${text}</strong>`;
          if (rt.annotations.italic) text = `<em>${text}</em>`;
          if (rt.annotations.strikethrough) text = `<del>${text}</del>`;
          if (rt.annotations.underline) text = `<u>${text}</u>`;
          if (rt.annotations.code) text = `<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">${text}</code>`;
        }
        
        return text;
      }).join('');
    }

    const html = response.results.map(block => {
      const type = block.type;
      
      if (type === 'paragraph' && block.paragraph?.rich_text) {
        const text = processRichText(block.paragraph.rich_text);
        return text ? `<p class="mb-4">${text}</p>` : '';
      }
      
      if (type === 'heading_1' && block.heading_1?.rich_text) {
        const text = processRichText(block.heading_1.rich_text);
        return text ? `<h1 class="text-3xl font-bold mb-4 mt-6">${text}</h1>` : '';
      }
      
      if (type === 'heading_2' && block.heading_2?.rich_text) {
        const text = processRichText(block.heading_2.rich_text);
        return text ? `<h2 class="text-2xl font-semibold mb-3 mt-5">${text}</h2>` : '';
      }
      
      if (type === 'heading_3' && block.heading_3?.rich_text) {
        const text = processRichText(block.heading_3.rich_text);
        return text ? `<h3 class="text-xl font-medium mb-2 mt-4">${text}</h3>` : '';
      }
      
      if (type === 'quote' && block.quote?.rich_text) {
        const text = processRichText(block.quote.rich_text);
        return text ? `<blockquote class="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-700">${text}</blockquote>` : '';
      }
      
      if (type === 'code' && block.code?.rich_text) {
        const text = block.code.rich_text.map(rt => rt.plain_text || '').join('');
        const language = block.code.language || '';
        return text ? `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code class="language-${language}">${text}</code></pre>` : '';
      }
      
      if (type === 'image') {
        let imageUrl = '';
        let caption = '';
        
        // Cek apakah gambar dari file upload atau external
        if (block.image.file) {
          imageUrl = block.image.file.url;
        } else if (block.image.external) {
          imageUrl = block.image.external.url;
        }
        
        // Ambil caption jika ada
        if (block.image.caption && block.image.caption.length > 0) {
          caption = processRichText(block.image.caption);
        }
        
        if (imageUrl) {
          return `
            <figure class="my-6">
              <img src="${imageUrl}" 
                   alt="${caption || 'Gambar'}" 
                   class="w-full rounded-lg shadow-md" 
                   loading="lazy" 
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
              <div style="display:none;" class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <p>Gambar tidak dapat dimuat</p>
                ${caption ? `<p class="text-sm mt-2">${caption}</p>` : ''}
              </div>
              ${caption ? `<figcaption class="text-sm text-gray-600 text-center mt-2 italic">${caption}</figcaption>` : ''}
            </figure>
          `;
        }
        return '';
      }

      // Tipe blok embed (misalnya Google Drive, Figma, Maps, dll)
      if (type === 'embed' && block.embed?.url) {
        const url = block.embed.url;

        // Tangani embed Google Drive (contoh: video/file)
        if (url.includes('drive.google.com')) {
          // Ubah URL view menjadi URL embed
          const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (match) {
            const fileId = match[1];
            const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

            return `
              <div class="my-6 aspect-video">
                <iframe src="${embedUrl}" 
                        class="w-full h-full rounded-lg shadow" 
                        frameborder="0" 
                        allowfullscreen 
                        loading="lazy">
                </iframe>
              </div>
            `;
          }
        }

        // Embed lainnya
        return `
          <div class="my-6 aspect-video">
            <iframe src="${url}" 
                    class="w-full h-full rounded-lg shadow" 
                    frameborder="0" 
                    allowfullscreen 
                    loading="lazy">
            </iframe>
          </div>
        `;
      }
      
      if (type === 'video') {
        let videoUrl = '';
        let caption = '';
        
        // Cek apakah video dari file upload atau external
        if (block.video.file) {
          videoUrl = block.video.file.url;
        } else if (block.video.external) {
          videoUrl = block.video.external.url;
        }
        
        // Ambil caption jika ada
        if (block.video.caption && block.video.caption.length > 0) {
          caption = processRichText(block.video.caption);
        }
        
        if (videoUrl) {
          // Cek apakah YouTube, Vimeo, atau video file langsung
          if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
            // Extract YouTube video ID
            const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
            if (videoId) {
              return `
                <figure class="my-6">
                  <div class="relative pb-[56.25%] h-0 overflow-hidden rounded-lg">
                    <iframe src="https://www.youtube.com/embed/${videoId}" 
                            class="absolute top-0 left-0 w-full h-full" 
                            frameborder="0" 
                            allowfullscreen></iframe>
                  </div>
                  ${caption ? `<figcaption class="text-sm text-gray-600 text-center mt-2 italic">${caption}</figcaption>` : ''}
                </figure>
              `;
            }
          }
          
          // Video file langsung
          return `
            <figure class="my-6">
              <video controls class="w-full rounded-lg shadow-md">
                <source src="${videoUrl}" type="video/mp4">
                Browser Anda tidak mendukung video.
              </video>
              ${caption ? `<figcaption class="text-sm text-gray-600 text-center mt-2 italic">${caption}</figcaption>` : ''}
            </figure>
          `;
        }
        return '';
      }
      
      if (type === 'file') {
        let fileUrl = '';
        let fileName = 'File';
        
        if (block.file.file) {
          fileUrl = block.file.file.url;
          fileName = block.file.name || 'File';
        } else if (block.file.external) {
          fileUrl = block.file.external.url;
          fileName = block.file.name || 'File External';
        }
        
        if (fileUrl) {
          return `
            <div class="my-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
              <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" 
                 class="flex items-center text-blue-600 hover:text-blue-800">
                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
                </svg>
                📎 ${fileName}
              </a>
            </div>
          `;
        }
        return '';
      }
      
      if (type === 'bookmark') {
        const url = block.bookmark?.url;
        const caption = block.bookmark?.caption ? processRichText(block.bookmark.caption) : '';
        
        if (url) {
          return `
            <div class="my-4 p-4 border border-gray-300 rounded-lg bg-blue-50">
              <a href="${url}" target="_blank" rel="noopener noreferrer" 
                 class="text-blue-600 hover:text-blue-800 font-medium">
                🔗 ${caption || url}
              </a>
            </div>
          `;
        }
        return '';
      }
      
      if (type === 'divider') {
        return '<hr class="my-6 border-gray-300">';
      }
      
      // Bullet list dan numbered list
      if (type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
        const text = processRichText(block.bulleted_list_item.rich_text);
        return text ? `<li class="mb-2">${text}</li>` : '';
      }
      
      if (type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
        const text = processRichText(block.numbered_list_item.rich_text);
        return text ? `<li class="mb-2">${text}</li>` : '';
      }
      
      // Log tipe block yang tidak dikenali
      console.log('Tipe block tidak dikenali:', type, block);
      return '';
    }).filter(content => content.length > 0);

    // Process list items to wrap them in proper ul/ol tags
    let processedHtml = [];
    let currentList = null;
    
    for (const item of html) {
      if (item.startsWith('<li')) {
        if (!currentList) {
          currentList = 'ul';
          processedHtml.push('<ul class="list-disc list-inside mb-4 ml-4">');
        }
        processedHtml.push(item);
      } else {
        if (currentList) {
          processedHtml.push('</ul>');
          currentList = null;
        }
        processedHtml.push(item);
      }
    }
    
    if (currentList) {
      processedHtml.push('</ul>');
    }

    const finalHtml = processedHtml.join('');

    // Jika tidak ada konten HTML yang dihasilkan
    if (!finalHtml.trim()) {
      console.log('Tidak ada konten HTML yang dihasilkan untuk page:', pageId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          html: '<p class="text-gray-500 italic">Tidak ada konten yang dapat ditampilkan.</p>' 
        })
      };
    }

    console.log('HTML berhasil dihasilkan, panjang:', finalHtml.length);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ html: finalHtml })
    };
    
  } catch (error) {
    console.error('Error saat mengambil detail halaman:', error);
    
    // Cek jenis error
    if (error.code === 'object_not_found') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Halaman tidak ditemukan',
          pageId: pageId 
        })
      };
    }
    
    if (error.code === 'unauthorized') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Token Notion tidak valid atau tidak memiliki akses ke halaman ini',
          pageId: pageId 
        })
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Gagal mengambil detail dari Notion',
        details: error.message,
        pageId: pageId 
      })
    };
  }
};