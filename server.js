require('dotenv').config(); // Load environment variables

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('SUPABASE_URL:', supabaseUrl);
console.log('SUPABASE_KEY:', supabaseKey ? 'Loaded' : 'Missing');

// Root route for quick check
app.get('/', (req, res) => res.send('KB server is running'));

// /kb/search endpoint
app.post('/kb/search', async (req, res) => {
  // --- Check Vapi secret ---
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== process.env.VAPI_WEBHOOK_SECRET) {
    console.log('Unauthorized request to KB');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user query
    const query = req.body?.message?.messages
      .filter(m => m.role === 'user')
      .pop()?.content || '';
    const cleanQuery = query.trim();

    console.log('Query received:', cleanQuery);

    // Fetch all documents for logging / fallback
    const { data: allDocs, error: allError } = await supabase
      .from('documents')
      .select('*');

    if (allError) {
      console.error('Supabase fetch all error:', allError);
      return res.status(500).json({ error: allError.message });
    }

    console.log('All documents in table:', allDocs);

    // Multi-word search: match any keyword
    const words = cleanQuery.split(/\s+/);
    const filters = words.map(w => `content.ilike.%${w}%`).join(',');

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .or(filters);

    if (error) {
      console.error('Supabase search error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Fallback: return all documents if nothing matched
    const resultDocs = data.length > 0 ? data : allDocs;

    console.log('Search results:', resultDocs);

    res.json({
      documents: resultDocs.map(doc => ({
        uuid: doc.id,
        title: doc.title,
        content: doc.content,
        similarity: 1 // placeholder
      }))
    });
  } catch (err) {
    console.error('KB search error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Listen on port from env or default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`KB server running on port ${PORT}`));
