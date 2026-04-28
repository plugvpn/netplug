## NetPlug (Go + HTMX)

This project has been rewritten to **Go + HTMX** with SQLite and a background WireGuard sync loop.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🚀 Features

- **Initial Setup Wizard**: Easy 2-step setup for first-time configuration
- **Authentication System**: Secure admin authentication with NextAuth.js
- **Dashboard Overview**: Real-time statistics and monitoring of your VPN infrastructure
- **Multi-Protocol Support**: Configure and manage WireGuard VPN servers
- **Server Management**: Add, configure, and monitor multiple VPN servers
- **User Management**: Manage user accounts, track usage, and control access
- **Active Connections**: Monitor live connections with 15-second refresh
- **Network Analytics**: Visualize bandwidth usage and connection patterns
- **Background Sync**: Automatic sync with WireGuard every 30 seconds
- **Configuration Management**: Easy-to-use interface for VPN settings
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Performance Optimized**: Fast database queries, no command spam

## Run

```bash
go run ./cmd/netplug
```

Open `http://localhost:8080/setup`.

## Docker

```bash
docker compose up --build
```

## Notes

- SQLite DB default path: `./sandbox/data/netplug.sqlite`
- WireGuard config path: `./sandbox/data/wg0.conf`
- WireGuard tools (`wg`, `wg-quick`) are optional unless you want the app to apply config / sync live stats.

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
- Enable and configure WireGuard (interface settings)
- Configure your VPN server settings

### Connecting to Your VPN Server

The setup wizard stores your VPN configuration in the database. To integrate with your actual VPN servers:

1. **WireGuard**: Specify the interface name and config file path
2. Create API routes in `app/api/` to interface with your VPN management interface
3. Update the data fetching logic in the dashboard pages

### Supported VPN Servers

The dashboard is designed to work with:
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

- Built with the amazing Next.js framework
- Icons by Lucide

## 📧 Contact

For questions and support, please open an issue on GitHub.

## 🌟 Star History

If you find this project useful, please consider giving it a star!

---

**Note**: This is an open-source VPN management dashboard project.
