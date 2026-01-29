# Tip Pool Management System - Setup & Deployment Guide

## Overview
This guide will help you set up and deploy your tip pool management system with a database backend.

## System Architecture

```
Frontend (React)  <-->  Backend API (Node.js/Express)  <-->  Database (SQLite)
```

## Prerequisites

1. **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
2. **npm** (comes with Node.js)
3. **Git** (optional, for version control)

## Quick Start (Development)

### 1. Set Up Backend

```bash
# Create a new directory for your project
mkdir tippool-app
cd tippool-app

# Create backend directory
mkdir backend
cd backend

# Copy the server.js and package.json files here
# Then install dependencies
npm install

# Start the backend server
npm start
```

The backend server will run on `http://localhost:3001`

### 2. Set Up Frontend

```bash
# Go back to main directory
cd ..

# Create frontend with React
npx create-react-app frontend
cd frontend

# Install required dependencies
npm install lucide-react

# Replace src/App.js with the tip-pool-system.jsx content
# Update API calls to point to http://localhost:3001/api

# Start the frontend
npm start
```

The frontend will run on `http://localhost:3000`

## Database Schema

The system uses SQLite with the following tables:

### employees
```sql
- id (INTEGER, PRIMARY KEY)
- name (TEXT)
- role (TEXT) - 'bartender' or 'expo'
- color (TEXT) - hex color code
- phone (TEXT)
- teller_account (TEXT)
- created_at (DATETIME)
```

### shifts
```sql
- id (INTEGER, PRIMARY KEY)
- date (TEXT) - YYYY-MM-DD format
- cash_tips (REAL)
- credit_tips (REAL)
- week (INTEGER)
- created_at (DATETIME)
```

### shift_employees
```sql
- id (INTEGER, PRIMARY KEY)
- shift_id (INTEGER, FOREIGN KEY)
- employee_id (INTEGER, FOREIGN KEY)
- hours (REAL)
```

### shift_expos
```sql
- id (INTEGER, PRIMARY KEY)
- shift_id (INTEGER, FOREIGN KEY)
- employee_id (INTEGER, FOREIGN KEY)
```

## API Endpoints

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Shifts
- `GET /api/shifts` - Get all shifts (optional: ?week=X)
- `POST /api/shifts` - Create new shift
- `PUT /api/shifts/:id` - Update shift
- `DELETE /api/shifts/:id` - Delete shift

## Production Deployment Options

### Option 1: Deploy to Heroku (Free tier available)

#### Backend Deployment:
```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create new Heroku app
cd backend
heroku create your-tippool-api

# Add buildpack
heroku buildpacks:set heroku/nodejs

# Deploy
git init
git add .
git commit -m "Initial commit"
git push heroku main

# Note your API URL: https://your-tippool-api.herokuapp.com
```

#### Frontend Deployment:
```bash
cd frontend

# Update API_URL in your code to point to Heroku backend
# Then build for production
npm run build

# Deploy to Netlify, Vercel, or GitHub Pages
```

### Option 2: Deploy to Railway (Recommended)

Railway offers easy deployment with database support:

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create new project
4. Deploy from GitHub repo
5. Add SQLite database
6. Set environment variables
7. Deploy!

### Option 3: Deploy to DigitalOcean App Platform

1. Push code to GitHub
2. Connect DigitalOcean to GitHub
3. Create new App
4. Select your repository
5. Configure build settings
6. Deploy

### Option 4: Self-Host on Your Own Server

```bash
# On your server (Ubuntu/Debian)

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your repository
git clone your-repo-url
cd your-repo

# Install dependencies
cd backend
npm install

# Install PM2 for process management
sudo npm install -g pm2

# Start the server
pm2 start server.js --name tippool-api

# Save PM2 configuration
pm2 save
pm2 startup

# Set up Nginx as reverse proxy
sudo apt-get install nginx

# Configure Nginx (see nginx config below)
```

#### Nginx Configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /var/www/tippool/frontend/build;
        try_files $uri /index.html;
    }
}
```

## Database Backup

### Backup SQLite Database:
```bash
# Manual backup
cp tippool.db tippool-backup-$(date +%Y%m%d).db

# Automated daily backup (add to crontab)
0 2 * * * cp /path/to/tippool.db /path/to/backups/tippool-$(date +\%Y\%m\%d).db
```

### Restore from Backup:
```bash
cp tippool-backup-20260129.db tippool.db
pm2 restart tippool-api
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3001
NODE_ENV=production
DATABASE_PATH=./tippool.db
CORS_ORIGIN=https://your-frontend-url.com
```

Update server.js to use environment variables:
```javascript
require('dotenv').config();
const PORT = process.env.PORT || 3001;
```

## Security Best Practices

1. **Enable HTTPS** - Use Let's Encrypt for free SSL certificates
2. **Add authentication** - Implement JWT or session-based auth
3. **Rate limiting** - Add express-rate-limit to prevent abuse
4. **Input validation** - Validate all user inputs
5. **CORS configuration** - Restrict to your frontend domain only

## Monitoring & Maintenance

### Health Check Endpoint:
```bash
curl http://localhost:3001/api/health
```

### View Logs (PM2):
```bash
pm2 logs tippool-api
```

### Monitor Server:
```bash
pm2 monit
```

## Troubleshooting

### Database locked error:
```bash
# Stop server
pm2 stop tippool-api

# Remove lock file
rm tippool.db-shm tippool.db-wal

# Restart server
pm2 start tippool-api
```

### CORS errors:
Update server.js CORS configuration:
```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### Port already in use:
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

## Upgrading to PostgreSQL (Optional)

For better performance and concurrent access:

1. Install PostgreSQL
2. Replace sqlite3 with pg
3. Update database connection code
4. Migrate data using export/import

## Mobile App (Future Enhancement)

Consider building a mobile app with:
- React Native
- Flutter
- Ionic

All using the same backend API!

## Support & Resources

- [Express.js Documentation](https://expressjs.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [React Documentation](https://react.dev/)
- [Node.js Documentation](https://nodejs.org/docs/)

## License

MIT License - Feel free to modify and use for your business!
