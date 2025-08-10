const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('road', 'sanitation', 'streetlights')),
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open', 'in-progress', 'closed')),
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_issues_location ON issues(latitude, longitude)');

  db.get('SELECT COUNT(*) as count FROM issues', (err, row) => {
    if (err) {
      console.error('Error checking issues count:', err);
      return;
    }

    if (row.count === 0) {
      console.log('Inserting sample data...');
      insertSampleData();
    }
  });
});

function insertSampleData() {
  const sampleIssues = [
    {
      id: '1',
      title: 'Pothole on Main Street',
      description: 'Large pothole causing vehicle damage near intersection',
      category: 'road',
      latitude: 40.7128,
      longitude: -74.0060,
      status: 'open',
      priority: 'high',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      title: 'Broken streetlight on Oak Avenue',
      description: 'Streetlight has been out for a week, creating safety concerns',
      category: 'streetlights',
      latitude: 40.7580,
      longitude: -73.9855,
      status: 'in-progress',
      priority: 'medium',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      title: 'Overflowing trash bins',
      description: 'Multiple trash bins overflowing in residential area',
      category: 'sanitation',
      latitude: 40.6892,
      longitude: -74.0445,
      status: 'open',
      priority: 'medium',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '4',
      title: 'Road closure needed',
      description: 'Construction work requires temporary road closure',
      category: 'road',
      latitude: 40.7282,
      longitude: -73.7949,
      status: 'closed',
      priority: 'low',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '5',
      title: 'Flickering streetlight',
      description: 'Streetlight intermittently flickering, needs maintenance',
      category: 'streetlights',
      latitude: 40.7505,
      longitude: -73.9934,
      status: 'open',
      priority: 'low',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '6',
      title: 'Missed garbage collection',
      description: 'Garbage has not been collected for two weeks',
      category: 'sanitation',
      latitude: 40.7411,
      longitude: -73.9897,
      status: 'open',
      priority: 'high',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO issues (id, title, description, category, latitude, longitude, status, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleIssues.forEach(issue => {
    stmt.run(
      issue.id,
      issue.title,
      issue.description,
      issue.category,
      issue.latitude,
      issue.longitude,
      issue.status,
      issue.priority,
      issue.created_at,
      issue.created_at
    );
  });

  stmt.finalize();
  console.log('Sample data inserted successfully');
}


app.get('/api/issues', (req, res) => {
  const { category, from, to, status, priority, limit = 1000, page = 1 } = req.query;
  
  let query = 'SELECT * FROM issues WHERE 1=1';
  const params = [];


  if (category) {
    const categories = category.split(',').map(c => c.trim());
    const placeholders = categories.map(() => '?').join(',');
    query += ` AND category IN (${placeholders})`;
    params.push(...categories);
  }


  if (from) {
    query += ' AND DATE(created_at) >= DATE(?)';
    params.push(from);
  }

  if (to) {
    query += ' AND DATE(created_at) <= DATE(?)';
    params.push(to);
  }


  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }

  
  query += ' ORDER BY created_at DESC';

  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }


    let countQuery = 'SELECT COUNT(*) as total FROM issues WHERE 1=1';
    const countParams = params.slice(0, -2); 

    if (category) {
      const categories = category.split(',').map(c => c.trim());
      const placeholders = categories.map(() => '?').join(',');
      countQuery += ` AND category IN (${placeholders})`;
    }

    if (from) {
      countQuery += ' AND DATE(created_at) >= DATE(?)';
    }

    if (to) {
      countQuery += ' AND DATE(created_at) <= DATE(?)';
    }

    if (status) {
      countQuery += ' AND status = ?';
    }

    if (priority) {
      countQuery += ' AND priority = ?';
    }

    db.get(countQuery, countParams, (err, countRow) => {
      if (err) {
        console.error('Count query error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({
        data: rows.map(row => ({
          ...row,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        total: countRow.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countRow.total / parseInt(limit))
      });
    });
  });
});

app.post('/api/issues', (req, res) => {
  const { title, description, category, latitude, longitude, priority = 'medium' } = req.body;

  
  if (!title || !description || !category || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validCategories = ['road', 'sanitation', 'streetlights'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const validPriorities = ['low', 'medium', 'high'];
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO issues (id, title, description, category, latitude, longitude, status, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `);

  stmt.run(id, title, description, category, latitude, longitude, priority, now, now, function(err) {
    if (err) {
      console.error('Insert error:', err);
      return res.status(500).json({ error: 'Failed to create issue' });
    }

    res.status(201).json({
      id,
      title,
      description,
      category,
      latitude,
      longitude,
      status: 'open',
      priority,
      createdAt: now,
      updatedAt: now
    });
  });

  stmt.finalize();
});

app.put('/api/issues/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority } = req.body;

  const fields = [];
  const params = [];

  if (title) {
    fields.push('title = ?');
    params.push(title);
  }

  if (description) {
    fields.push('description = ?');
    params.push(description);
  }

  if (status) {
    const validStatuses = ['open', 'in-progress', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    fields.push('status = ?');
    params.push(status);
  }

  if (priority) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    fields.push('priority = ?');
    params.push(priority);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  const query = `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`;

  db.run(query, params, function(err) {
    if (err) {
      console.error('Update error:', err);
      return res.status(500).json({ error: 'Failed to update issue' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json({ message: 'Issue updated successfully' });
  });
});

app.delete('/api/issues/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM issues WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ error: 'Failed to delete issue' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json({ message: 'Issue deleted successfully' });
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
