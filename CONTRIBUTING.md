# Contributing to Lord Nine Field Boss Timer Discord Bot

Thank you for your interest in contributing to the L9FBT Discord Bot! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### Reporting Issues
- Use GitHub Issues to report bugs or request features
- Provide detailed information about the issue
- Include steps to reproduce bugs
- Specify your environment (Discord bot version, Discord.js version)

### Feature Requests
- Check existing issues before creating new ones
- Clearly describe the proposed feature
- Explain the use case and benefits
- Consider implementation complexity

### Pull Requests
1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** following the coding standards
4. **Test your changes** thoroughly
5. **Commit with clear messages**: `git commit -m "Add: feature description"`
6. **Push to your fork**: `git push origin feature/your-feature-name`
7. **Create a Pull Request** with detailed description

## 🛠️ Development Setup

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn package manager
- Git for version control
- Discord Developer Application

### Local Development
```bash
# Clone your fork
git clone https://github.com/your-username/L9FBT-DC.git
cd L9FBT-DC

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Add your Discord bot credentials to .env
# DISCORD_TOKEN=your_bot_token
# CLIENT_ID=your_client_id
# GUILD_ID=your_test_guild_id

# Build the project
npm run build

# Start development server
npm run dev
```

## 📝 Coding Standards

### TypeScript Guidelines
- Use TypeScript strict mode
- Follow existing naming conventions
- Add type definitions for new interfaces
- Use meaningful variable and function names

### Code Style
- Use 2 spaces for indentation
- Follow ESLint rules (if configured)
- Keep functions focused and small
- Add comments for complex logic

### File Organization
```
src/
├── commands/     # Slash command implementations
├── database.ts   # Database management
├── bosses.ts     # Boss data and utilities
├── types.ts      # TypeScript type definitions
└── index.ts      # Main bot entry point
```

### Discord.js Best Practices
- Use Discord.js v14 patterns
- Handle interactions properly
- Implement error handling
- Use ephemeral responses when appropriate
- Follow Discord's rate limits

## 🎯 Areas for Contribution

### High Priority
- Bug fixes and stability improvements
- Performance optimizations
- Documentation improvements
- Test coverage expansion

### Medium Priority
- New boss timer features
- UI/UX enhancements
- Additional notification options
- Database optimizations

### Enhancement Ideas
- Boss spawn prediction algorithms
- Integration with other gaming platforms
- Advanced analytics and statistics
- Multi-language support

## 🧪 Testing

### Manual Testing
- Test all slash commands
- Verify timer functionality
- Check database operations
- Validate error handling

### Test Checklist
- [ ] Bot connects successfully
- [ ] Commands register properly
- [ ] Timer notifications work
- [ ] Database operations succeed
- [ ] Error messages are user-friendly
- [ ] Dynamic timers update correctly

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for functions
- Document complex algorithms
- Explain configuration options
- Include usage examples

### README Updates
- Keep feature list current
- Update installation instructions
- Add new configuration options
- Include troubleshooting tips

## 🔒 Security Considerations

### Sensitive Data
- Never commit `.env` files
- Don't include Discord tokens in code
- Sanitize user inputs
- Follow Discord's security guidelines

### Database Security
- Validate all database inputs
- Use parameterized queries
- Implement proper error handling
- Consider data privacy implications

## 📋 Code Review Process

### Review Criteria
- Code follows project standards
- Changes are well-tested
- Documentation is updated
- No security vulnerabilities
- Performance implications considered

### Review Timeline
- Initial review within 48 hours
- Feedback provided constructively
- Approval required before merging
- Continuous integration checks pass

## 🚀 Release Process

### Version Management
- Follow semantic versioning (SemVer)
- Update version in package.json
- Create release notes
- Tag releases appropriately

### Deployment
- Test in development environment
- Build production version
- Update documentation
- Announce changes to users

## 📞 Getting Help

### Resources
- **Discord.js Documentation**: https://discord.js.org/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Node.js Documentation**: https://nodejs.org/docs/

### Community
- Create GitHub Issues for questions
- Tag maintainers for urgent issues
- Be patient and respectful
- Help other contributors when possible

## 🎖️ Recognition

Contributors will be:
- Added to the README contributors section
- Credited in release notes
- Recognized for significant contributions
- Invited to participate in project decisions

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to the Lord Nine Field Boss Timer Discord Bot!** 🎮⚔️
