# Health Companion API

Backend API server for the Health Companion platform, built with Node.js, Express, and PostgreSQL.

## Features

- **Authentication** - JWT-based user registration and login
- **Blood Pressure Tracking** - Log and retrieve BP readings
- **Mood Tracking** - Daily mood and wellness logging
- **Water Intake** - Track daily water consumption
- **Steps Counter** - Log daily step counts
- **Weight Management** - Track weight history
- **User Preferences** - Theme, units, and notification settings
- **Dashboard Statistics** - Aggregated health metrics

## Tech Stack

- **Node.js** + **Express** - Server framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **CORS** - Cross-origin resource sharing

## API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/logout` | POST | Logout |

### Health Tracking
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bp` | GET/POST | Blood pressure entries |
| `/api/bp/:id` | GET/PUT/DELETE | Single BP entry |
| `/api/mood` | GET/POST | Mood entries |
| `/api/mood/:id` | GET/PUT/DELETE | Single mood entry |
| `/api/water` | GET/POST | Water intake entries |
| `/api/water/:id` | GET/PUT/DELETE | Single water entry |
| `/api/steps` | GET/POST | Steps entries |
| `/api/steps/:id` | GET/PUT/DELETE | Single steps entry |
| `/api/weight` | GET/POST | Weight entries |
| `/api/weight/:id` | GET/PUT/DELETE | Single weight entry |

### User Data
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/preferences` | GET/PUT | User preferences |
| `/api/settings` | GET/PUT | User settings |
| `/api/stats` | GET | Dashboard statistics |
| `/api/health` | GET | API health check |

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database (PostgreSQL)
PG_HOST=your-postgres-host.com
PG_PORT=5432
PG_USER=your_db_user
PG_PASSWORD=your_db_password
PG_DATABASE=healthapp

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# CORS Origin
CORS_ORIGIN=*

# Server Port
PORT=38257
```

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or run directly
node server/index.js
```

## Docker Deployment

### Option 1: DockerManager (Recommended)

1. **Upload files** to your Hostinger VPS:
   ```bash
   scp -r bp-tracker user@your-server:/var/www/
   ```

2. **SSH into your server** and navigate to the app directory:
   ```bash
   cd /var/www/bp-tracker
   ```

3. **Create .env file** with your database credentials:
   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

4. **In Hostinger DockerManager**, select "Compose Manually" and paste the contents of `docker-compose.yml`

5. **Deploy** - The API will be available at `http://YOUR_SERVER_IP:38257`

### Option 2: Manual Docker Commands

```bash
# SSH into your server
ssh user@your-server

# Navigate to app directory
cd /var/www/bp-tracker

# Create .env file
cp .env.example .env
nano .env

# Build and start
docker build -t health-companion-api .
docker run -d --name health-companion-api -p 38257:38257 --env-file .env --restart unless-stopped health-companion-api
```

### Option 3: Using the deploy script

```bash
chmod +x deploy-hostinger.sh
./deploy-hostinger.sh
```

### Health Check

After deployment, verify the API is running:
```
http://YOUR_SERVER_IP:38257/api/health
```

## Database Setup

The API expects a PostgreSQL database. Make sure your `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, and `PG_DATABASE` environment variables are correctly set.

### Database Schema

The database schema is automatically created when the API starts (if tables don't exist). Key tables:

- `users` - User accounts
- `bp_entries` - Blood pressure readings
- `mood_entries` - Mood and wellness logs
- `water_entries` - Water intake logs
- `steps_entries` - Step count logs
- `weight_entries` - Weight logs
- `preferences` - User preferences
- `settings` - User settings

## Repository

https://github.com/raghuraminnet/health-companion-flutter (Flutter frontend)
https://github.com/raghuraminnet/health-companion (React frontend + backend)

## License

MIT License