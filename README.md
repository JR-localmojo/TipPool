# 💰 Tip Pool Management System

A modern, beautiful web application for managing tip pools with automatic calculations, weekly summaries, and PDF exports.

## ✨ Features

- 📅 **Weekly Calendar View** - Easy shift management across 7 days
- 👥 **Employee Management** - Track bartenders and expo workers
- 💵 **Automatic Calculations** - Hourly tip distribution and 3% CC fee deduction
- 📊 **Weekly Summaries** - Detailed breakdown with days worked and total hours
- 📄 **PDF Export** - Professional weekly summary reports
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 💾 **Database Storage** - Persistent data with SQLite

## 🚀 Quick Start

### 1. Install Backend

```bash
# Navigate to your project directory
cd backend

# Install dependencies
npm install

# Start the server
npm start
```

Server runs on: `http://localhost:3001`

### 2. Open Frontend

**Option A: Simple HTML (No build required)**
```bash
# Just open standalone.html in your browser
# Make sure backend is running first!
```

**Option B: React Development**
```bash
cd frontend
npm install
npm start
```

Frontend runs on: `http://localhost:3000`

## 📖 How to Use

### Adding Employees
1. Go to **Employees** tab
2. Enter name and select role (Bartender or Expo)
3. Click **Add**
4. Click edit to add phone number and Teller account

### Managing Shifts
1. Go to **Shifts** tab
2. Navigate to your desired week using arrows
3. Click edit (pencil icon) on any day
4. Select employees who worked
5. Enter hours for bartenders
6. Enter cash and credit card tips
7. Click save (checkmark icon)

### CSV Import
1. Export your scheduling software as CSV
2. Click **Import CSV**
3. Select employee roles (Bartender/Expo)
4. Shifts are automatically created!

### Weekly Summary
1. Go to **Weekly Summary** tab
2. Select your week
3. View breakdown by employee:
   - Days worked
   - Total hours
   - Cash tips
   - Credit tips (after 3% fee)
   - Credit card fee deduction
4. Click **Export PDF** to download

## 🎨 Design Features

- **Modern Dark Theme** - Easy on the eyes
- **Blue/Green/Gray Palette** - Professional and clean
- **Smooth Animations** - Delightful interactions
- **Clear Typography** - Readable at any size

## 📊 Tip Calculations

### Bartenders
- Tips split by hours worked
- Hourly rate = Total bartender tips ÷ Total hours
- Each bartender gets: Hours × Hourly rate

### Expo Workers
- Each expo gets 10% of total daily tips
- Split equally if multiple expos work

### Credit Card Fees
- 3% automatically deducted from CC tips
- Clearly shown in weekly summary

## 🗄️ Database

Uses SQLite for simple, file-based storage:
- `tippool.db` - Main database file
- Automatic backups recommended (see SETUP_GUIDE.md)

## 📁 File Structure

```
tippool-app/
├── backend/
│   ├── server.js          # API server
│   ├── package.json       # Dependencies
│   └── tippool.db        # Database (auto-created)
├── frontend/
│   └── src/
│       └── App.js        # React app
├── standalone.html       # Simple version
└── SETUP_GUIDE.md       # Detailed setup
```

## 🔧 Configuration

Edit `server.js` to change:
- Port number (default: 3001)
- Database location
- CORS settings

Edit frontend to change:
- API URL
- Color scheme
- Employee roles

## 🚢 Deployment

See `SETUP_GUIDE.md` for detailed deployment instructions including:
- Heroku
- Railway
- DigitalOcean
- Self-hosting with Nginx

## 🔐 Security Notes

For production:
1. Add authentication (username/password)
2. Enable HTTPS
3. Restrict CORS to your domain
4. Regular database backups
5. Use environment variables

## 📞 Support

Need help? Check the `SETUP_GUIDE.md` for:
- Troubleshooting
- Advanced configuration
- Backup & restore
- Upgrading options

## 📝 License

MIT License - Free to use and modify!

---

Built with ❤️ for hospitality workers
