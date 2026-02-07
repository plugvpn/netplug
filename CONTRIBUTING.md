# Contributing to NetPlug VPN Dashboard

Thank you for your interest in contributing to NetPlug VPN Dashboard! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in Issues
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Check if the feature has been suggested in Issues
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following our coding standards
4. Test your changes
5. Commit with clear, descriptive messages
6. Push to your fork
7. Create a Pull Request with:
   - Clear title and description
   - Reference any related issues
   - Screenshots/videos if UI changes

## Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/netplug-dashboard.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types (avoid `any`)
- Use interfaces for object shapes
- Export types from `types/` directory

### React/Next.js

- Use functional components
- Prefer server components unless interactivity is needed
- Use `"use client"` directive only when necessary
- Keep components small and focused
- Use proper semantic HTML

### Styling

- Use Tailwind CSS utility classes
- Follow existing design patterns
- Ensure responsive design
- Test on multiple screen sizes

### Code Organization

```
- Keep files focused on a single responsibility
- Extract reusable logic to `lib/`
- Place types in `types/`
- Create reusable components in `components/`
```

## Testing

- Test your changes manually
- Ensure no TypeScript errors: `npm run build`
- Check for linting issues: `npm run lint`
- Test on multiple browsers if UI changes

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add user authentication
fix: resolve connection timeout issue
docs: update installation instructions
style: format code with prettier
refactor: simplify server management logic
test: add tests for user API
```

## Questions?

Feel free to open an issue for any questions or clarifications needed.

Thank you for contributing!
