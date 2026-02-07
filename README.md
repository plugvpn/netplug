# NetPlug VPN Dashboard

An open-source, free alternative to commercial VPN management dashboards like OpenVPN's Access Server dashboard. Built with Next.js 16, TypeScript, and Tailwind CSS.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🚀 Features

- **Initial Setup Wizard**: Easy 2-step setup for first-time configuration
- **Authentication System**: Secure admin authentication with NextAuth.js
- **Dashboard Overview**: Real-time statistics and monitoring of your VPN infrastructure
- **Multi-Protocol Support**: Configure both OpenVPN and WireGuard simultaneously
- **Server Management**: Add, configure, and monitor multiple VPN servers
- **User Management**: Manage user accounts, track usage, and control access
- **Active Connections**: Monitor live connections with 15-second refresh
- **Network Analytics**: Visualize bandwidth usage and connection patterns
- **Background Sync**: Automatic sync with WireGuard every 30 seconds
- **Configuration Management**: Easy-to-use interface for VPN settings
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Performance Optimized**: Fast database queries, no command spam

## 🛠️ Tech Stack

- **Framework**: Next.js 16.1 with App Router
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js v5
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Handling**: date-fns

## 📋 Prerequisites

- Node.js 20+
- npm or yarn
- A VPN server (OpenVPN, WireGuard, etc.)

No external database required - uses SQLite for lightweight storage!

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/netplug-dashboard.git
cd netplug-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example file
cp .env.example .env

# Generate a secure AUTH_SECRET
openssl rand -base64 32

# Edit .env and replace AUTH_SECRET with the generated value
```

4. Run database migrations (creates SQLite database automatically):
```bash
npx prisma migrate dev --name init
```

5. Run the development server:
```bash
npm run dev
```

   **Important for WireGuard**: If you're using WireGuard, the dashboard needs elevated privileges to read interface statistics. Run with sudo:
   ```bash
   sudo npm run dev
   ```
   See [docs/PERMISSIONS.md](docs/PERMISSIONS.md) for more details.

6. Open [http://localhost:3000](http://localhost:3000) in your browser
   - You'll be automatically redirected to the setup wizard on first launch
   - Follow the 2-step setup process:
     1. Create your admin account
     2. Configure your VPN server(s) (OpenVPN and/or WireGuard)

### Building for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
netplug-dashboard/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard layout with sidebar
│   │   ├── page.tsx             # Main dashboard overview
│   │   ├── servers/             # Server management
│   │   ├── users/               # User management
│   │   ├── connections/         # Active connections
│   │   └── config/              # Configuration settings
│   ├── globals.css              # Global styles
│   └── page.tsx                 # Root page (redirects to dashboard)
├── components/
│   ├── ui/
│   │   └── card.tsx             # Reusable card component
│   ├── sidebar.tsx              # Navigation sidebar
│   ├── stat-card.tsx            # Statistics card component
│   └── network-chart.tsx        # Network usage chart
├── lib/
│   ├── utils.ts                 # Utility functions
│   └── mock-data.ts             # Mock data for development
└── types/
    └── vpn.ts                   # TypeScript type definitions
```

## 🔧 Configuration

### Initial Setup Wizard

On first launch, you'll be guided through a 2-step setup wizard:

**Step 1: Create Admin Account**
- Username (3-20 characters, alphanumeric + underscores)
- Password (8+ characters with uppercase, lowercase, and number)

**Step 2: Configure VPN Servers**
- Enable and configure OpenVPN (management interface)
- Enable and configure WireGuard (interface settings)
- At least one protocol must be enabled

### Connecting to Your VPN Server

The setup wizard stores your VPN configuration in the database. To integrate with your actual VPN servers:

1. **OpenVPN**: Connect to the management interface (typically port 7505)
2. **WireGuard**: Specify the interface name and config file path
3. Create API routes in `app/api/` to interface with your VPN management interface
4. Update the data fetching logic in the dashboard pages

### Supported VPN Servers

The dashboard is designed to work with:
- OpenVPN (via management interface)
- WireGuard (via wg command-line tools)
- SoftEther (future support)
- Any VPN server with a management API

## 🎨 Customization

### Branding

Edit `/components/sidebar.tsx` to customize:
- Logo
- Application name
- Color scheme

### Theme

Modify `/app/globals.css` to change:
- Color palette
- Typography
- Spacing

## 🔐 Security Considerations

- Always use HTTPS in production
- Authentication is implemented with NextAuth.js v5
- Passwords are hashed with bcrypt (12 salt rounds)
- Sessions use JWT tokens with httpOnly cookies
- Use environment variables for sensitive data (AUTH_SECRET)
- Regularly update dependencies
- Implement rate limiting for API endpoints
- Use RBAC (Role-Based Access Control) for user permissions
- Keep your AUTH_SECRET secure and never commit it to version control
- Keep your SQLite database file secure with proper file permissions

## 📊 Features Roadmap

- [x] Initial setup wizard
- [x] User authentication and authorization
- [ ] Real VPN server integration (OpenVPN management interface)
- [ ] Real VPN server integration (WireGuard)
- [ ] Multiple admin accounts
- [ ] Role-Based Access Control (RBAC)
- [ ] Multi-language support
- [ ] Dark mode toggle
- [ ] Email notifications
- [ ] Multi-factor authentication (TOTP)
- [ ] Password reset functionality
- [ ] Certificate management
- [ ] Backup and restore functionality
- [ ] API documentation
- [ ] Docker deployment support
- [ ] Kubernetes manifests
- [ ] Audit logging

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by OpenVPN Access Server
- Built with the amazing Next.js framework
- Icons by Lucide

## 📧 Contact

For questions and support, please open an issue on GitHub.

## 🌟 Star History

If you find this project useful, please consider giving it a star!

---

**Note**: This is an open-source project and is not affiliated with or endorsed by OpenVPN Inc.
