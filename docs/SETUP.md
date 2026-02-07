# Setup Guide

This guide will walk you through setting up the NetPlug VPN Dashboard from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+**: [Download](https://nodejs.org/)
- **Git**: [Download](https://git-scm.com/)

No external database required - SQLite is used for lightweight, file-based storage!

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/netplug-dashboard.git
cd netplug-dashboard
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Run Database Migrations

This creates the SQLite database automatically with all necessary tables:

```bash
npx prisma migrate dev --name init
```

You should see output confirming the migration was successful and that `dev.db` was created.

**Note on Environment Variables:**

Before running migrations, make sure you have set up your `.env` file:

```bash
# Copy the example file
cp .env.example .env

# Generate a secure AUTH_SECRET
openssl rand -base64 32

# Edit .env and replace AUTH_SECRET with the generated value
```

Your `.env` should contain:
- **DATABASE_URL**: `file:./dev.db` (SQLite database file)
- **AUTH_SECRET**: Your generated secret (do NOT use the placeholder!)
- **AUTH_URL**: `http://localhost:3000`

## Step 4: Start the Development Server

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000).

## Step 5: Complete the Setup Wizard

1. **Open your browser** and navigate to `http://localhost:3000`

2. **You'll be redirected to the setup wizard** (`/setup`)

3. **Step 1: Create Admin Account**
   - Enter a username (3-20 characters, alphanumeric + underscores)
   - Create a strong password (8+ characters with uppercase, lowercase, and number)
   - Confirm your password
   - Click "Continue to VPN Configuration"

4. **Step 2: Configure VPN Servers**

   **OpenVPN Configuration** (if you have an OpenVPN server):
   - Toggle "Enable" to ON
   - Management Host: `localhost` (or your OpenVPN server IP)
   - Management Port: `7505` (default OpenVPN management port)
   - Management Password: Your OpenVPN management password

   **WireGuard Configuration** (if you have a WireGuard server):
   - Toggle "Enable" to ON
   - Interface Name: `wg0` (or your WireGuard interface name)
   - Config Path: `$DATA_DIR/wg0.conf` (automatically uses DATA_DIR environment variable)

   **Note**: You must enable at least one protocol to complete setup.

5. **Click "Complete Setup"** and you'll be redirected to the dashboard

## Step 6: Access the Dashboard

After completing setup:
- You're automatically logged in
- Access the dashboard at `http://localhost:3000/dashboard`
- Use the logout button in the sidebar when needed

## Troubleshooting

### Database Issues

**Error**: `Can't find database file`

**Solution**:
1. Ensure you ran migrations: `npx prisma migrate dev --name init`
2. Check that `dev.db` file exists in your project root
3. Verify DATABASE_URL in .env: `file:./dev.db`

**Error**: `Database is locked`

**Solution**:
1. Stop the development server
2. Close any SQLite browser/viewer applications
3. Restart the development server

### Migration Errors

**Error**: `Migration failed`

**Solution**:
1. Delete the database: `rm dev.db dev.db-journal`
2. Run migrations again: `npx prisma migrate dev --name init`

### Setup Wizard Issues

**Error**: Setup wizard keeps showing even after completion

**Solution**:
1. Check database using Prisma Studio: `npx prisma studio`
2. Verify `isSetupComplete` is `true` in SystemConfig table
3. Clear the cache by restarting the dev server
4. If needed, delete `dev.db` and run migrations again

### Authentication Issues

**Error**: Can't login after creating admin account

**Solution**:
1. Check the database with: `npx prisma studio`
2. Verify the User table has your admin account
3. Check AUTH_SECRET is set in .env
4. Try deleting `dev.db` and starting fresh

## Production Deployment

### Environment Configuration

For production, update your `.env` or use environment variables:

```bash
DATABASE_URL="file:./prod.db"
AUTH_SECRET="your-production-secret-here"
AUTH_URL="https://your-domain.com"
NODE_ENV="production"
```

**Important**: Backup your SQLite database file (`prod.db`) regularly!

### Build and Run

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Security Checklist

- [ ] Use HTTPS (SSL/TLS certificate)
- [ ] Use a strong, unique AUTH_SECRET
- [ ] Set secure environment variables (never commit .env)
- [ ] Set proper file permissions on SQLite database (chmod 600 prod.db)
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Backup database file regularly (automated backups recommended)
- [ ] Use a reverse proxy (nginx/Apache)
- [ ] Enable CORS properly
- [ ] Implement monitoring and logging
- [ ] Keep database file in a secure location with restricted access

## Docker Deployment (Coming Soon)

Docker support will be added in a future update. See the [roadmap](../README.md#-features-roadmap) for details.

## Need Help?

- Check the [main README](../README.md) for more information
- Open an issue on [GitHub](https://github.com/yourusername/netplug-dashboard/issues)
- Review the [Contributing Guide](../CONTRIBUTING.md)

## Next Steps

After setup is complete:

1. **Configure VPN Integration**: Connect to your actual VPN servers
2. **Add VPN Users**: Import or create VPN client accounts
3. **Customize Branding**: Update logos and colors in the sidebar
4. **Set Up Monitoring**: Integrate with your monitoring tools
5. **Configure Backups**: Set up automated database backups

Congratulations! Your NetPlug VPN Dashboard is now set up and ready to use. 🎉
